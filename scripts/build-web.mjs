// scripts/build-web.mjs
//
// WHY THIS SCRIPT EXISTS (read before "fixing" it into a bundler):
// The GSH app today is a single self-contained HTML file — preview/index.html —
// with its CSS and JS inline and its one external dependency (SheetJS, for Excel
// import) loaded from a CDN `<script>` tag. There is no React/Vite app wired up
// yet; src/ currently holds only design tokens and repository TypeScript
// interfaces, not components. Pretending otherwise (e.g. leaving `vite build` as
// the build script when there's no vite.config.ts or entry point) would fail in
// CI or silently build nothing.
//
// So: the "build" step for now is exactly what it needs to be — put the real,
// working app where Capacitor's `webDir` (see capacitor.config.ts → "dist")
// expects it. When the app migrates to an actual componentized build (tracked in
// docs/ARCHITECTURE.md), this script is what gets replaced by a real bundler
// step — nothing else about the project structure needs to change to get there.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'preview', 'index.html');
const outDir = resolve(root, 'dist');
const outFile = resolve(outDir, 'index.html');
const envManifest = process.env.OTA_MANIFEST_URL?.trim();
const PRODUCTION_MANIFEST_URL = 'https://github.com/sachingupta-ERP/gsh-app/releases/latest/download/manifest.json';

function isValidProductionUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('https://')) return false;
  const lower = url.toLowerCase();
  if (lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('0.0.0.0') || lower.includes('.run.app') || lower.includes('ai.studio') || lower.includes('secret')) {
    return false;
  }
  return true;
}

const otaManifestUrl = isValidProductionUrl(envManifest) ? envManifest : PRODUCTION_MANIFEST_URL;
const otaEnabled = process.env.OTA_ENABLED !== 'false' && process.env.OTA_ENABLED !== '0';

if (!existsSync(src)) {
  console.error(`Build failed: expected the app at ${src} but it does not exist.`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const html = readFileSync(src, 'utf8')
  .replaceAll('__GSH_OTA_MANIFEST_URL__', otaManifestUrl)
  .replaceAll('__GSH_OTA_ENABLED__', String(otaEnabled));
writeFileSync(outFile, html);

// Copy PWA assets
const pwaAssets = [
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

for (const asset of pwaAssets) {
  const assetSrc = resolve(root, 'preview', asset);
  if (existsSync(assetSrc)) {
    writeFileSync(resolve(outDir, asset), readFileSync(assetSrc));
  }
}

console.log(`Built web app and copied PWA assets: ${src} -> ${outFile}`);
