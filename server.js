const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '25mb' }));

// Initialize production database (SQLite with WAL & auto-setup)
const { pushSyncEntries, pullSyncEntries, getDatabaseStatus, getDatabase } = require('./server/production-db');
const db = getDatabase();

// API routes
app.get('/api/health', (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.json({
    status: 'ok',
    app: 'Gopeshwar Stationary House',
    database: dbStatus.status,
    engine: dbStatus.engine,
    records: dbStatus.counts
  });
});

app.get('/api/v1/db/status', (req, res) => {
  try {
    const status = getDatabaseStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: { code: 'DB_ERROR', message: err.message } });
  }
});

app.post('/api/v1/sync/push', (req, res) => {
  const { deviceId, entries } = req.body || {};
  if (!deviceId || !Array.isArray(entries)) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'deviceId and entries[] are required' } });
  }

  try {
    const results = pushSyncEntries(deviceId, entries);
    res.json({ results });
  } catch (err) {
    console.error('Push sync error:', err);
    res.status(500).json({ error: { code: 'SYNC_ERROR', message: err.message } });
  }
});

app.get('/api/v1/sync/pull', (req, res) => {
  try {
    const since = typeof req.query.since === 'string' ? req.query.since : null;
    const result = pullSyncEntries(since);
    res.json(result);
  } catch (err) {
    console.error('Pull sync error:', err);
    res.status(500).json({ error: { code: 'SYNC_ERROR', message: err.message } });
  }
});

// Documents endpoint for unified documents module
app.get('/api/v1/documents', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, title, type, file_size, mime_type, linked_entity_type, linked_entity_id, created_at FROM documents ORDER BY created_at DESC').all();
    res.json({ documents: rows });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.post('/api/v1/documents', (req, res) => {
  try {
    const { id, title, type, fileData, fileSize, mimeType, linkedEntityType, linkedEntityId } = req.body || {};
    if (!title || !type) {
      return res.status(400).json({ error: { message: 'Title and type are required' } });
    }
    const docId = id || 'doc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const stmt = db.prepare(`
      INSERT INTO documents (id, title, type, file_data, file_size, mime_type, linked_entity_type, linked_entity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(docId, title, type, fileData || '', fileSize || 0, mimeType || 'application/pdf', linkedEntityType || null, linkedEntityId || null, new Date().toISOString());
    res.json({ success: true, document: { id: docId, title, type, createdAt: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// Serve dist directory if present, otherwise preview
const distDir = path.resolve(__dirname, 'dist');
const previewDir = path.resolve(__dirname, 'preview');

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
if (fs.existsSync(previewDir)) {
  app.use(express.static(previewDir));
}

// Fallback to index.html for SPA routes
app.use((req, res) => {
  const distIndex = path.join(distDir, 'index.html');
  const previewIndex = path.join(previewDir, 'index.html');
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else if (fs.existsSync(previewIndex)) {
    res.sendFile(previewIndex);
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Gopeshwar Stationary House server listening on http://${HOST}:${PORT}`);
});
