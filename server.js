const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '10mb' }));

// In-memory sync storage for local / preview environment
const syncSnapshots = new Map();

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Gopeshwar Stationary House' });
});

app.post('/api/v1/sync/push', (req, res) => {
  const { deviceId, entries } = req.body || {};
  if (!deviceId || !Array.isArray(entries)) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'deviceId and entries[] are required' } });
  }

  const results = entries.map(entry => {
    const existing = syncSnapshots.get(entry.collection);
    if (!existing) {
      syncSnapshots.set(entry.collection, {
        collection: entry.collection,
        data: entry.data,
        deviceOrigin: deviceId,
        version: 1,
        updatedAt: new Date().toISOString()
      });
      return { collection: entry.collection, outcome: 'accepted', version: 1 };
    }

    if (entry.clientVersion !== existing.version) {
      return {
        collection: entry.collection,
        outcome: 'conflict_rejected',
        version: existing.version,
        serverData: existing.data
      };
    }

    const nextVer = existing.version + 1;
    syncSnapshots.set(entry.collection, {
      collection: entry.collection,
      data: entry.data,
      deviceOrigin: deviceId,
      version: nextVer,
      updatedAt: new Date().toISOString()
    });
    return { collection: entry.collection, outcome: 'accepted', version: nextVer };
  });

  res.json({ results });
});

app.get('/api/v1/sync/pull', (req, res) => {
  const collections = {};
  for (const [col, snap] of syncSnapshots.entries()) {
    collections[col] = { data: snap.data, version: snap.version };
  }
  res.json({ pulledAt: new Date().toISOString(), collections });
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
