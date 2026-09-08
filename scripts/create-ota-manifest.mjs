import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const bundlePath = resolve(root, process.env.OTA_BUNDLE_PATH || 'dist.zip');
const outputPath = resolve(root, process.env.OTA_MANIFEST_PATH || 'manifest.json');
const version = process.env.OTA_VERSION;
const bundleUrl = process.env.OTA_BUNDLE_URL;
const minNativeVersion = process.env.OTA_MIN_NATIVE_VERSION || '0.1.0';

if (!version || !bundleUrl) {
  throw new Error('OTA_VERSION and OTA_BUNDLE_URL are required');
}
if (!existsSync(bundlePath)) {
  throw new Error(`OTA bundle not found: ${bundlePath}`);
}
if (!/^https:\/\//i.test(bundleUrl)) {
  throw new Error('OTA_BUNDLE_URL must use HTTPS');
}

const sha256 = createHash('sha256').update(readFileSync(bundlePath)).digest('hex');
const manifest = {
  version,
  bundleUrl,
  sha256,
  minNativeVersion,
  publishedAt: new Date().toISOString(),
};

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Created OTA manifest ${outputPath} for ${version}`);
