// server/routes/sync.ts
// POST /api/v1/sync/push  { deviceId, entries: PushEntry[] } -> PushResult[]
// GET  /api/v1/sync/pull?since=<iso>                        -> { pulledAt, collections }
//
// No auth/session logic here on purpose — this file assumes the same
// Authorization: Bearer <session token> middleware documented in
// docs/API_CONTRACTS.md already ran and attached the caller's identity.
// Sync itself carries no auth weight (see SYNC_PROTOCOL.md "Device identity").

import type { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { pushSync, pullSync } from '../services/sync';

export function registerSyncRoutes(router: Router, db: PrismaClient) {
  router.post('/sync/push', async (req, res) => {
    const { deviceId, entries } = req.body as { deviceId: string; entries: any[] };
    if (!deviceId || !Array.isArray(entries)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'deviceId and entries[] are required' } });
    }
    const results = await pushSync(db, deviceId, entries);
    res.json({ results });
  });

  router.get('/sync/pull', async (req, res) => {
    const since = typeof req.query.since === 'string' ? req.query.since : null;
    const result = await pullSync(db, since);
    res.json(result);
  });
}
