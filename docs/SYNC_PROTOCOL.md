# GSH Sync Protocol

## Why this exists
Every mutation in the app already goes through one chokepoint: `saveKey(collection, value)`
writes to local storage (today: `window.storage` in the browser preview; production:
IndexedDB on-device). That chokepoint is now also the sync boundary — every save
enqueues an outbox entry, and a background/manual sync flushes the outbox against
the server. Nothing about the existing repository logic, screens, or business rules
changes; sync is added *underneath* them.

## Phase 1 (this pass): whole-collection snapshot sync
**Unit of sync = a full collection** (`products`, `vendors`, `purchases`, `expenses`,
`sales`, `closings`, `seasons`, `movements`), matching exactly how the client already
reads/writes them (`PRODUCTS`, `VENDORS`, ... as whole arrays). This is intentionally
the simplest correct thing that can ship without touching any mutation call site.

### Client outbox
Every `saveKey(collection, value)` call:
1. Writes locally immediately (unchanged, instant, works offline).
2. Appends/replaces an outbox entry: `{collection, data: value, updatedAt: Date.now(), deviceId}`.
   Only the latest entry per collection is kept — a newer snapshot supersedes an
   older queued one for the same collection, so the outbox never grows unbounded.
3. Triggers a debounced `attemptSync()`. If no server is configured, or the request
   fails, the entry stays queued — nothing is lost, nothing blocks the UI.

### Push — `POST /api/v1/sync/push`
Request: `{ deviceId, entries: [{ collection, data, clientVersion }] }`
(`clientVersion` = the `SyncSnapshot.version` the client last successfully synced
for that collection, or 0 if never synced.)

Server, per entry:
- If `SyncSnapshot` for that collection doesn't exist yet → create it at version 1, outcome `accepted`.
- If `clientVersion === current server version` → accept, increment version, outcome `accepted`.
- If `clientVersion < current server version` → **reject** with outcome `conflict_rejected`
  and return the current server snapshot. The client does NOT auto-overwrite; see
  Conflict Handling below.

Every push, accepted or rejected, is appended to `SyncOperation` — the audit trail
for sync itself.

### Pull — `GET /api/v1/sync/pull?since=<deviceLastPullAt>`
Returns every `SyncSnapshot` whose `updatedAt > since`, so a second device catches
up to changes made elsewhere.

### Conflict handling (the honest limitation of Phase 1)
Because the sync unit is a whole collection, a conflict means **two devices edited
the same collection while offline, and one whole snapshot would clobber the other's
changes** — not just the one record that actually collided. Phase 1 does not attempt
automatic field-level merging. On conflict, the server's snapshot wins and is pulled
down; the rejected local snapshot's outbox entry is kept flagged so the person can
be shown "changes couldn't sync — one of you was offline" rather than silently
losing data. This is acceptable for GSH's real usage pattern (one shop, mostly one
active device at a time) but is explicitly NOT safe for heavy concurrent multi-device
editing — that needs Phase 2.

## Phase 2 (future): per-record operation log
Replace whole-collection snapshots with individual operations against the already-
normalized tables (`Product`, `Vendor`, `Purchase`, ...): `{entityType, entityId, op:
'create'|'update'|'delete', fields, clientTimestamp, deviceId}`. The server applies
each operation independently with per-record optimistic concurrency (`updatedAt` on
each model, already added to the schema), so two devices editing *different*
products at the same time never conflict, and *the same* product only conflicts on
that one record. This requires rewriting each repository's mutating methods to emit
one operation per change instead of resaving the whole array — a real, scoped
follow-up once Phase 1 is proven in daily use.

## Device identity
Each install generates a random `deviceId` (UUID-ish) once and persists it locally
(`gsh:deviceId`). It's only used for conflict messaging and the `SyncOperation` audit
trail — it is not a security credential and carries no auth weight.

## What Phase 1 does NOT do
- No real-time push (no websockets) — sync is pull-on-open + push-on-change, both
  explicit HTTP calls.
- No automatic conflict merge.
- No partial-collection diffing — every push sends the full current array. Fine at
  GSH's data volumes (products/vendors/purchases are in the hundreds, not millions);
  would need to change before this pattern scales further.
