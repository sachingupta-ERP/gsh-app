import { PrismaClient } from '@prisma/client';
import { getDatabase } from './production-db.js';

let prisma: any;
try {
  if (process.env.DATABASE_URL) {
    prisma = new PrismaClient();
  } else {
    throw new Error('No external DATABASE_URL — utilizing production SQLite engine');
  }
} catch {
  // Use persistent SQLite production database
  const db = getDatabase();

  prisma = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(prisma),
    syncSnapshot: {
      findUnique: async ({ where }: { where: { collection: string } }) => {
        const row = db.prepare('SELECT collection, data, version, updated_at as updatedAt FROM sync_snapshots WHERE collection = ?').get(where.collection);
        if (!row) return null;
        let data = row.data;
        try { data = JSON.parse(row.data); } catch {}
        return { ...row, data };
      },
      create: async ({ data }: { data: { collection: string; data: any; deviceOrigin: string; version: number } }) => {
        const dataStr = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO sync_snapshots (collection, data, device_origin, version, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(data.collection, dataStr, data.deviceOrigin || 'system', data.version || 1, now);
        return { collection: data.collection, data: data.data, version: data.version || 1, updatedAt: now };
      },
      update: async ({ where, data }: { where: { collection: string }; data: { data: any; deviceOrigin: string; version: number } }) => {
        const dataStr = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE sync_snapshots
          SET data = ?, device_origin = ?, version = ?, updated_at = ?
          WHERE collection = ?
        `).run(dataStr, data.deviceOrigin || 'system', data.version, now, where.collection);
        return { collection: where.collection, data: data.data, version: data.version, updatedAt: now };
      },
      findMany: async ({ where }: { where?: { updatedAt?: { gt?: Date } } } = {}) => {
        const rows = where?.updatedAt?.gt
          ? db.prepare('SELECT collection, data, version, updated_at as updatedAt FROM sync_snapshots WHERE updated_at > ?').all(where.updatedAt.gt.toISOString())
          : db.prepare('SELECT collection, data, version, updated_at as updatedAt FROM sync_snapshots').all();
        return rows.map((r: any) => {
          let parsed = r.data;
          try { parsed = JSON.parse(r.data); } catch {}
          return { ...r, data: parsed };
        });
      }
    },
    syncOperation: {
      create: async ({ data }: { data: { collection: string; deviceOrigin: string; clientVersion: number; serverVersion: number; outcome: string } }) => {
        db.prepare(`
          INSERT INTO sync_operations (collection, device_origin, client_version, server_version, outcome, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(data.collection, data.deviceOrigin || 'system', data.clientVersion, data.serverVersion, data.outcome, new Date().toISOString());
        return { ...data, createdAt: new Date().toISOString() };
      }
    },
    user: {
      findFirst: async ({ where }: any) => {
        if (where?.mobile) {
          return db.prepare('SELECT * FROM users WHERE mobile = ?').get(where.mobile);
        }
        return db.prepare('SELECT * FROM users LIMIT 1').get();
      },
      findUnique: async ({ where }: any) => {
        if (where?.id) return db.prepare('SELECT * FROM users WHERE id = ?').get(where.id);
        if (where?.mobile) return db.prepare('SELECT * FROM users WHERE mobile = ?').get(where.mobile);
        return null;
      },
      findMany: async () => db.prepare('SELECT * FROM users').all(),
      create: async ({ data }: any) => {
        const id = data.id || 'u-' + Date.now().toString(36);
        db.prepare(`
          INSERT INTO users (id, name, mobile, role, pin_hash, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, data.name, data.mobile, data.role || 'STAFF', data.pinHash || null, data.active !== false ? 1 : 0, new Date().toISOString());
        return { id, ...data };
      }
    },
    document: {
      findMany: async () => db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all(),
      create: async ({ data }: any) => {
        const id = data.id || 'doc-' + Date.now().toString(36);
        db.prepare(`
          INSERT INTO documents (id, title, type, file_data, file_size, mime_type, linked_entity_type, linked_entity_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, data.title, data.type, data.fileData || '', data.fileSize || 0, data.mimeType || 'application/pdf', data.linkedEntityType || null, data.linkedEntityId || null, new Date().toISOString());
        return { id, ...data };
      }
    }
  };
}

export { prisma };
