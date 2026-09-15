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
    const linkedId = req.query.linkedEntityId;
    let query = 'SELECT id, title, type, file_size, mime_type, linked_entity_type, linked_entity_id, created_at FROM documents';
    let params = [];
    if (linkedId) {
      query += ' WHERE linked_entity_id = ?';
      params.push(linkedId);
    }
    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params);
    res.json({ documents: rows });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/v1/documents/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: { message: 'Document not found' } });
    }
    res.json({ document: doc });
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

// Lazy-initialized Gemini Client for production AI extraction
let geminiClient = null;
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing');
    }
    const { GoogleGenAI } = require('@google/genai');
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

// Real OCR endpoint using Gemini 3.8 Flash
app.post('/api/v1/ai/extract-bill', async (req, res) => {
  const { imageBase64, mimeType, vendorContext } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: { message: 'imageBase64 is required' } });
  }

  // Clean data URL prefix if present
  let cleanBase64 = imageBase64;
  let resolvedMime = mimeType || 'image/jpeg';
  if (imageBase64.includes('base64,')) {
    const parts = imageBase64.split('base64,');
    cleanBase64 = parts[1];
    const mimeMatch = parts[0].match(/data:([^;]+);/);
    if (mimeMatch) resolvedMime = mimeMatch[1];
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are an expert OCR & retail billing assistant for "Gopeshwar Stationary House".
Analyze this uploaded vendor bill, handwritten parcha, or invoice document.
Extract the structured purchase bill information accurately.
${vendorContext ? `Vendor Context hint: ${vendorContext}` : ''}

Respond ONLY with valid JSON in this exact structure without markdown formatting or code fences:
{
  "vendor": "Name of the vendor/supplier",
  "billNo": "Bill number, voucher number or invoice number, or '-' if not present",
  "billDate": "YYYY-MM-DD or readable date from bill",
  "total": 0,
  "confidence": 95,
  "items": [
    {
      "name": "Item or product description",
      "qty": 10,
      "rate": 15.0,
      "amount": 150.0
    }
  ]
}

Ensure numeric values for total, qty, rate, amount, and confidence (0-100). If handwritten text is faint, make the best conservative estimate and lower the confidence score.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: resolvedMime
              }
            }
          ]
        }
      ]
    });

    let rawText = response.text ? response.text.trim() : '';
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(rawText);
    res.json({ success: true, extraction: parsed });
  } catch (err) {
    console.error('Gemini OCR extraction failed:', err);
    res.status(200).json({
      success: false,
      error: { message: err.message || 'AI extraction failed' },
      fallback: true
    });
  }
});

// Serve dist directory if present, otherwise preview
const distDir = path.resolve(__dirname, 'dist');
const previewDir = path.resolve(__dirname, 'preview');

// PWA Service Worker & Manifest headers
app.get('/sw.js', (req, res) => {
  const filePath = fs.existsSync(path.join(distDir, 'sw.js'))
    ? path.join(distDir, 'sw.js')
    : path.join(previewDir, 'sw.js');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(filePath);
  } else {
    res.status(404).send('SW Not Found');
  }
});

app.get(['/manifest.webmanifest', '/manifest.json'], (req, res) => {
  const filePath = fs.existsSync(path.join(distDir, 'manifest.webmanifest'))
    ? path.join(distDir, 'manifest.webmanifest')
    : path.join(previewDir, 'manifest.webmanifest');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Manifest Not Found');
  }
});

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
