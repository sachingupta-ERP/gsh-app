import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateIconPNG(size) {
  // Create RGBA raw image data
  const rowLen = 1 + size * 4; // 1 filter byte + RGBA pixels
  const rawData = Buffer.alloc(rowLen * size);

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background rounded squircle / circle
      // Brand theme: Deep navy to royal blue (#0f172a -> #1e3a8a)
      let r = 15, g = 23, b = 42, a = 255; // #0f172a

      const cornerRadius = size * 0.22;
      const qx = Math.max(0, Math.abs(dx) - (center - cornerRadius));
      const qy = Math.max(0, Math.abs(dy) - (center - cornerRadius));
      const cornerDist = Math.sqrt(qx * qx + qy * qy);

      if (cornerDist > cornerRadius) {
        // Transparent outside
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Inside app icon background: gradient from royal blue to dark navy
      const t = (y / size);
      r = Math.round(30 * (1 - t) + 15 * t);
      g = Math.round(58 * (1 - t) + 23 * t);
      b = Math.round(138 * (1 - t) + 42 * t);

      // Gold accent border
      if (cornerDist > cornerRadius - size * 0.035 && cornerDist <= cornerRadius) {
        r = 245; g = 158; b = 11; // Amber #f59e0b
      }

      // Central symbol: Book/Paper icon + Pen
      // Draw a book shape in center
      const bookLeft = center - size * 0.28;
      const bookRight = center + size * 0.28;
      const bookTop = center - size * 0.18;
      const bookBottom = center + size * 0.26;

      if (x >= bookLeft && x <= bookRight && y >= bookTop && y <= bookBottom) {
        // White page
        r = 255; g = 255; b = 255;
        // Central spine
        if (Math.abs(x - center) < size * 0.02) {
          r = 203; g = 213; b = 225; // spine divider
        }
        // Book page lines
        if ((y % Math.round(size * 0.07) < Math.round(size * 0.015)) && y > bookTop + size * 0.05 && y < bookBottom - size * 0.05) {
          if (x < center - size * 0.05 || x > center + size * 0.05) {
            r = 148; g = 163; b = 184;
          }
        }
      }

      // Pen nib above
      const penX = center;
      const penY = center - size * 0.24;
      if (Math.abs(x - penX) < size * 0.08 && Math.abs(y - penY) < size * 0.08) {
        r = 245; g = 158; b = 11; // Gold nib
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // ColorType RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Generate files for preview/ and dist/
const p192 = generateIconPNG(192);
const p512 = generateIconPNG(512);

writeFileSync('preview/icon-192.png', p192);
writeFileSync('preview/icon-512.png', p512);
writeFileSync('preview/apple-touch-icon.png', p192);

console.log('Generated PWA icon assets in preview/: icon-192.png, icon-512.png, apple-touch-icon.png');
