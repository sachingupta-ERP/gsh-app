// server/production-db.js
// Production-ready database engine for Gopeshwar Stationary House
// Auto-initializes on startup with zero manual SQL required.
// Uses Node 22 native SQLite with Write-Ahead Logging (WAL) for high concurrency and zero external dependencies.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'gsh_production.sqlite');

let dbInstance = null;

function getDatabase() {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);

  // High performance & crash resiliency with WAL mode
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Sync snapshots table for all collections (Inventory, Vendors, Purchases, Expenses, Sales, Closings, Seasons, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_snapshots (
      collection TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      device_origin TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Sync audit/operations history
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT NOT NULL,
      device_origin TEXT,
      client_version INTEGER NOT NULL,
      server_version INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 3. Registered Users table (Owner & Employees)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'STAFF',
      pin_hash TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
  `);

  // 4. Documents & Invoices store (Receipts, Bill Photos, PDF invoices)
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      file_data TEXT,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      linked_entity_type TEXT,
      linked_entity_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 5. System Audit Trail
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // Ensure default Owner user (9457076378) is present
  const checkOwner = db.prepare("SELECT id FROM users WHERE mobile = '9457076378'").get();
  if (!checkOwner) {
    const insertOwner = db.prepare(`
      INSERT INTO users (id, name, mobile, role, active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
    insertOwner.run('u-owner', 'Gopeshwar Owner', '9457076378', 'ADMIN', new Date().toISOString());
  }

  dbInstance = db;
  console.log(`[GSH Database] Production SQLite ready at ${DB_PATH} (WAL mode enabled)`);
  return dbInstance;
}

// Transactional push sync for all collections
function pushSyncEntries(deviceId, entries) {
  const db = getDatabase();
  const results = [];

  const getSnapshot = db.prepare('SELECT collection, data, version FROM sync_snapshots WHERE collection = ?');
  const insertSnapshot = db.prepare(`
    INSERT INTO sync_snapshots (collection, data, device_origin, version, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateSnapshot = db.prepare(`
    UPDATE sync_snapshots
    SET data = ?, device_origin = ?, version = ?, updated_at = ?
    WHERE collection = ?
  `);
  const insertOp = db.prepare(`
    INSERT INTO sync_operations (collection, device_origin, client_version, server_version, outcome, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const entry of entries) {
      const existing = getSnapshot.get(entry.collection);
      const dataStr = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data);
      const now = new Date().toISOString();

      if (!existing) {
        insertSnapshot.run(entry.collection, dataStr, deviceId, 1, now);
        insertOp.run(entry.collection, deviceId, entry.clientVersion || 0, 0, 'accepted', now);
        results.push({ collection: entry.collection, outcome: 'accepted', version: 1 });
      } else if (entry.clientVersion !== existing.version) {
        let parsedServerData;
        try { parsedServerData = JSON.parse(existing.data); } catch { parsedServerData = existing.data; }
        insertOp.run(entry.collection, deviceId, entry.clientVersion || 0, existing.version, 'conflict_rejected', now);
        results.push({
          collection: entry.collection,
          outcome: 'conflict_rejected',
          version: existing.version,
          serverData: parsedServerData
        });
      } else {
        const nextVer = existing.version + 1;
        updateSnapshot.run(dataStr, deviceId, nextVer, now, entry.collection);
        insertOp.run(entry.collection, deviceId, entry.clientVersion, existing.version, 'accepted', now);
        results.push({ collection: entry.collection, outcome: 'accepted', version: nextVer });
      }
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return results;
}

// Pull all latest snapshots
function pullSyncEntries(sinceIso) {
  const db = getDatabase();
  let query = 'SELECT collection, data, version, updated_at FROM sync_snapshots';
  let rows;

  if (sinceIso) {
    const stmt = db.prepare('SELECT collection, data, version, updated_at FROM sync_snapshots WHERE updated_at > ?');
    rows = stmt.all(sinceIso);
  } else {
    rows = db.prepare(query).all();
  }

  const collections = {};
  for (const row of rows) {
    let parsedData;
    try { parsedData = JSON.parse(row.data); } catch { parsedData = row.data; }
    collections[row.collection] = {
      data: parsedData,
      version: row.version,
      updatedAt: row.updated_at
    };
  }

  return {
    pulledAt: new Date().toISOString(),
    collections
  };
}

// Get database status and counts for health checks & dashboard
function getDatabaseStatus() {
  const db = getDatabase();
  const snapshotCount = db.prepare('SELECT COUNT(*) as count FROM sync_snapshots').get()?.count || 0;
  const opCount = db.prepare('SELECT COUNT(*) as count FROM sync_operations').get()?.count || 0;
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
  const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get()?.count || 0;

  const collections = db.prepare('SELECT collection, version, updated_at FROM sync_snapshots').all();

  let fileSize = 0;
  try {
    const stat = fs.statSync(DB_PATH);
    fileSize = stat.size;
  } catch {}

  return {
    status: 'connected',
    engine: 'SQLite 3 (Node 22 WAL)',
    databaseFile: DB_PATH,
    sizeBytes: fileSize,
    counts: {
      collections: snapshotCount,
      operations: opCount,
      users: userCount,
      documents: docCount
    },
    activeCollections: collections
  };
}

module.exports = {
  getDatabase,
  pushSyncEntries,
  pullSyncEntries,
  getDatabaseStatus
};
