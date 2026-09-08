// server/services/sync.ts
// Implements docs/SYNC_PROTOCOL.md Phase 1 exactly: whole-collection snapshots,
// optimistic concurrency by version, reject-on-conflict (server always wins,
// never silently merges). See that doc before changing anything here.

import type { PrismaClient } from '@prisma/client';

export interface PushEntry {
  collection: string;
  data: unknown;
  clientVersion: number;
}
export interface PushResult {
  collection: string;
  outcome: 'accepted' | 'conflict_rejected';
  version: number;
  serverData?: unknown; // present only on conflict, so the client can show/pull the winner
}

export async function pushSync(
  db: PrismaClient,
  deviceId: string,
  entries: PushEntry[]
): Promise<PushResult[]> {
  const results: PushResult[] = [];

  for (const entry of entries) {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.syncSnapshot.findUnique({ where: { collection: entry.collection } });

      if (!existing) {
        const created = await tx.syncSnapshot.create({
          data: { collection: entry.collection, data: entry.data as any, deviceOrigin: deviceId, version: 1 },
        });
        await tx.syncOperation.create({
          data: { collection: entry.collection, deviceOrigin: deviceId, clientVersion: entry.clientVersion, serverVersion: 0, outcome: 'accepted' },
        });
        return { collection: entry.collection, outcome: 'accepted' as const, version: created.version };
      }

      if (entry.clientVersion !== existing.version) {
        await tx.syncOperation.create({
          data: { collection: entry.collection, deviceOrigin: deviceId, clientVersion: entry.clientVersion, serverVersion: existing.version, outcome: 'conflict_rejected' },
        });
        // Server snapshot wins — client must pull and reconcile manually (Phase 1 has no auto-merge).
        return { collection: entry.collection, outcome: 'conflict_rejected' as const, version: existing.version, serverData: existing.data };
      }

      const updated = await tx.syncSnapshot.update({
        where: { collection: entry.collection },
        data: { data: entry.data as any, deviceOrigin: deviceId, version: existing.version + 1 },
      });
      await tx.syncOperation.create({
        data: { collection: entry.collection, deviceOrigin: deviceId, clientVersion: entry.clientVersion, serverVersion: existing.version, outcome: 'accepted' },
      });
      return { collection: entry.collection, outcome: 'accepted' as const, version: updated.version };
    });

    results.push(result);
  }

  return results;
}

export async function pullSync(db: PrismaClient, sinceIso: string | null) {
  const since = sinceIso ? new Date(sinceIso) : new Date(0);
  const snapshots = await db.syncSnapshot.findMany({ where: { updatedAt: { gt: since } } });
  return {
    pulledAt: new Date().toISOString(),
    collections: snapshots.map((s) => ({ collection: s.collection, data: s.data, version: s.version, updatedAt: s.updatedAt })),
  };
}
