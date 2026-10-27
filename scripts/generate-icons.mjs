/**
 * Generates the PWA icon set with zero dependencies.
 *
 * Node ships zlib, so we can emit real PNGs (IHDR/IDAT/IEND with CRC32) from
 * raw RGBA pixels. The artwork is an indigo rounded square with a white
 * checkmark — rendered geometrically so it is crisp at every size.
 *
 * Run: npm run icons
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- PNG encoding ---------- */

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- drawing ---------- */

const INDIGO_TOP = [79, 70, 229];
const INDIGO_BOTTOM = [67, 56, 202];
const WHITE = [255, 255, 255];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function roundedRectInside(x, y, size, radius) {
  const half = size / 2;
  const dx = Math.max(half - radius - Math.abs(x - half + 0.5), 0);
  const dy = Math.max(half - radius - Math.abs(y - half + 0.5), 0);
  return Math.hypot(dx, dy) <= radius || Math.abs(x - half + 0.5) <= half - radius || Math.abs(y - half + 0.5) <= half - radius;
}

/**
 * @param {number} size edge length in pixels
 * @param {{ maskable?: boolean }} options maskable fills the full bleed and
 * shrinks the checkmark into the 80% safe zone.
 */
function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const cornerRadius = maskable ? 0 : size * 0.2;
  const content = maskable ? 0.42 : 0.5; // half-extent of the checkmark box

  const points = [
    [-0.55, 0.05],
    [-0.18, 0.42],
    [0.6, -0.38],
  ].map(([x, y]) => [size / 2 + x * content * 2 * 0.72, size / 2 + y * content * 2 * 0.72]);
  const strokeWidth = size * (maskable ? 0.09 : 0.12);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!roundedRectInside(x, y, size, cornerRadius)) continue; // transparent

      const gradient = y / (size - 1);
      let [r, g, b] = [
        lerp(INDIGO_TOP[0], INDIGO_BOTTOM[0], gradient),
        lerp(INDIGO_TOP[1], INDIGO_BOTTOM[1], gradient),
        lerp(INDIGO_TOP[2], INDIGO_BOTTOM[2], gradient),
      ];

      const [p1, p2, p3] = points;
      const d = Math.min(
        distanceToSegment(x + 0.5, y + 0.5, p1[0], p1[1], p2[0], p2[1]),
        distanceToSegment(x + 0.5, y + 0.5, p2[0], p2[1], p3[0], p3[1]),
      );
      // Soft edge keeps the checkmark smooth at small sizes.
      const alpha = Math.max(0, Math.min(1, strokeWidth / 2 + 0.5 - d));
      if (alpha > 0) {
        r = lerp(r, WHITE[0], alpha);
        g = lerp(g, WHITE[1], alpha);
        b = lerp(b, WHITE[2], alpha);
      }

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

/* ---------- output ---------- */

const outputs = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/icon-512-maskable.png", 512, true],
  ["public/icons/apple-touch-icon.png", 180, true],
  ["app/icon.png", 64, false],
];

for (const [relativePath, size, maskable] of outputs) {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, renderIcon(size, { maskable }));
  console.log(`wrote ${relativePath} (${size}x${size}${maskable ? ", maskable" : ""})`);
}
