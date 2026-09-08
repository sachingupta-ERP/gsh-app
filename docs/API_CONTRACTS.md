# GSH API Contracts

Base: `/api/v1`. All requests except `/auth/*` require `Authorization: Bearer <session token>`.
Every mutating endpoint writes an `AuditLog` row (actor, entity, old/new value, source) — this is enforced
server-side, not left to the client, per spec §36/§43.

## Conventions
- Money fields: integer paise or `Float` rupees — pick one at implementation time and keep it consistent; contracts below use rupees.
- All list endpoints support `?from=&to=` (ISO date) and `?page=&pageSize=`.
- Errors: `{ "error": { "code": string, "message": string, "field"?: string } }`, human-readable per §42.

## Auth (§3)
- `POST /auth/request-otp` `{ mobile }` → `{ challengeId }`
- `POST /auth/verify-otp` `{ challengeId, otp }` → `{ userId, requiresPinSetup }`
- `POST /auth/set-pin` `{ userId, pin }` (first login only)
- `POST /auth/login-pin` `{ userCode, pin, deviceId }` → `{ token, user }`
- `POST /auth/login-biometric` `{ userCode, deviceId, biometricAssertion }` → `{ token, user }`
- `POST /auth/logout`

## Users & Permissions (§4) — ADMIN only
- `GET/POST /users`, `PATCH /users/:id` (status, role, permissions)
- `POST /users/:id/reset-pin`, `POST /users/:id/reset-biometric`
- `GET /credential-requests`, `POST /credential-requests/:id/resolve`

## Products & Inventory (§7–§10, §19–§20)
- `GET /products?query=&category=&lowStockOnly=`
- `POST /products` `{ alias, name, category, brand, domsLine?, unit, minStock, reorderQty }`
  → `409 ALIAS_DUPLICATE` on collision (enforced globally, spec §7)
- `GET /products/:id/360` → stock, rate/margin, vendor history, movement timeline (§8)
- `POST /products/import/preview` (multipart) → column-mapped rows + duplicate/error flags (§37)
- `POST /products/import/commit` `{ rows }`
- `POST /inventory/voice-entry` `{ transcript }` → structured draft `{ product, purchaseRate, sellingRate, variants[] }` for CONFIRM/EDIT/CANCEL (§11)
- `POST /inventory/adjust` `{ productId, variantId?, delta, reason, source }` (§19)
- `GET /inventory/low-stock` → priority-scored list (§20)

## Vendors (§15–§16)
- `GET/POST /vendors`, `GET /vendors/:id/360`
- `GET /vendors/:id/rate-history?productId=`
- `POST /vendors/:id/bills` (multipart image) → OCR pipeline result (§14)
- `PATCH /bills/:id` (manual correction after AI_REVIEW_REQUIRED)
- `GET /bills/:id` (full document + confidence + linked purchase)

## Purchases (§11–§13, §21–§23)
- `POST /purchases` (draft) → status machine DRAFT→SENT→RECEIVED→REVIEW→VERIFIED→POSTED
- `POST /purchases/voice-receive` `{ transcript }` → structured preview (§12)
- `POST /purchases/parse-whatsapp` `{ text }` → line items preview (§23)
- `PATCH /purchases/:id/status` `{ status }` — POSTED triggers inventory + vendor ledger + reports fan-out (§35)
- `GET /purchase-strategist?availableFunds=` → prioritized recommendations with rationale (§21)

## Sales & Money (§17–§18, §24–§25)
- `POST /sales/quick-total` `{ date, amount, sourceImage? }`
- `POST /sales/scan` (multipart) → OCR total + confidence, image discarded unless `keepImage:true`
- `POST /closing` `{ date, actualCash, ... }` → computes variance, requires `varianceReason` if nonzero
- `GET/POST /expenses`

## Seasonal (§26)
- `GET/POST /seasonal-campaigns`
- `POST /seasonal-campaigns/:id/items|expenses|sales`
- `GET /seasonal-campaigns/:id/summary` → purchase/expense/sales/net-profit rollup

## Reports (§27)
- `GET /reports/:type?range=&from=&to=` — type ∈ sales|profit|purchases|expenses|vendor-spend|vendor-rates|inventory-valuation|fast-movers|slow-movers|low-stock|cash-flow|upi|closings|seasonal|product-profitability
- `GET /reports/:type/export?format=csv|pdf`

## AI Assistant (§28–§29)
- `POST /ai/ask` `{ query, lang }` → `{ answer, citedRefs: [{type, id}] }` — server resolves citedRefs against real tables, never fabricates (§28)
- `POST /ai/what-if` `{ scenario }` → `{ estimate, assumptions[], labeledAsEstimate: true }`

## Notifications & Tagging (§30–§32)
- `GET /notifications`, `POST /notifications/:id/read`
- `POST /tags` `{ addressedToId, refType, refId, message }`, `POST /tags/:id/reply`
- `GET/POST /notes`

## Search (§33)
- `GET /search?q=` → mixed-type results `{ products[], vendors[], bills[], purchases[], reports[] }`

## Sync (production local-first architecture — see docs/SYNC_PROTOCOL.md)
- `POST /sync/push` `{ deviceId, entries: [{collection, data, clientVersion}] }` → per-collection accept/conflict results
- `GET /sync/pull?since=<iso>` → every collection snapshot changed since that timestamp
