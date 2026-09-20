/*
 * Bangla Lens — icon generator (dev tool, not part of the extension).
 *
 * Renders the logo with signed-distance-field shapes and encodes PNGs with
 * Node's built-in zlib, so there are no image-library dependencies.
 * Run:  node tools/make-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "bangla-lens", "icons");
mkdirSync(outDir, { recursive: true });

/* ---- PNG encoding ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---- shape math (signed distance fields) ---- */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const coverage = (sdPx) => clamp01(0.5 - sdPx);

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/* Design space is 96×96: rounded gradient square + white speech bubble + tail + dots. */
const GRAD_A = [106, 88, 246];  // indigo
const GRAD_B = [156, 76, 246];  // violet
const BUBBLE = [255, 255, 255];
const DOTS = [109, 77, 244];

function renderRGBA(S) {
  const px = Buffer.alloc(S * S * 4);
  const k = S / 96; // device pixels per design unit

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x + 0.5) / k;
      const ny = (y + 0.5) / k;

      // background rounded square with diagonal gradient
      const sdBg = sdRoundRect(nx, ny, 48, 48, 42, 42, 20);
      const cBg = coverage(sdBg * k);
      const t = clamp01((nx + ny) / 192);
      let r = lerp(GRAD_A[0], GRAD_B[0], t) * cBg;
      let g = lerp(GRAD_A[1], GRAD_B[1], t) * cBg;
      let b = lerp(GRAD_A[2], GRAD_B[2], t) * cBg;
      let a = cBg;

      // speech bubble = rounded rect ∪ tail circle
      const sdBub = Math.min(
        sdRoundRect(nx, ny, 48, 42.5, 24, 17.5, 11),
        sdCircle(nx, ny, 36.5, 60, 8)
      );
      const cBub = coverage(sdBub * k);
      r = BUBBLE[0] * cBub + r * (1 - cBub);
      g = BUBBLE[1] * cBub + g * (1 - cBub);
      b = BUBBLE[2] * cBub + b * (1 - cBub);
      a = cBub + a * (1 - cBub);

      // three "typing" dots
      const sdDot = Math.min(
        sdCircle(nx, ny, 37.5, 42.5, 3.9),
        sdCircle(nx, ny, 48, 42.5, 3.9),
        sdCircle(nx, ny, 58.5, 42.5, 3.9)
      );
      const cDot = coverage(sdDot * k);
      r = DOTS[0] * cDot + r * (1 - cDot);
      g = DOTS[1] * cDot + g * (1 - cDot);
      b = DOTS[2] * cDot + b * (1 - cDot);
      a = cDot + a * (1 - cDot);

      // un-premultiply for straight-alpha storage
      const i = (y * S + x) * 4;
      px[i] = a > 0.0001 ? Math.round(Math.min(255, (r / a) * 255)) : 0;
      px[i + 1] = a > 0.0001 ? Math.round(Math.min(255, (g / a) * 255)) : 0;
      px[i + 2] = a > 0.0001 ? Math.round(Math.min(255, (b / a) * 255)) : 0;
      px[i + 3] = Math.round(clamp01(a) * 255);
    }
  }
  return { data: px, size: S };
}

/* 2× supersampled render, box-filtered down for smooth edges. */
function downsample(img, S) {
  const src = img.data;
  const out = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let pr = 0, pg = 0, pb = 0, pa = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const si = ((y * 2 + dy) * S * 2 + (x * 2 + dx)) * 4;
          const a = src[si + 3] / 255;
          pr += src[si] * a;
          pg += src[si + 1] * a;
          pb += src[si + 2] * a;
          pa += a;
        }
      }
      pa /= 4; pr /= 4; pg /= 4; pb /= 4;
      const oi = (y * S + x) * 4;
      out[oi] = pa > 0.0001 ? Math.round(Math.min(255, pr / pa)) : 0;
      out[oi + 1] = pa > 0.0001 ? Math.round(Math.min(255, pg / pa)) : 0;
      out[oi + 2] = pa > 0.0001 ? Math.round(Math.min(255, pb / pa)) : 0;
      out[oi + 3] = Math.round(clamp01(pa) * 255);
    }
  }
  return out;
}

for (const size of [48, 96, 128]) {
  const rendered = renderRGBA(size * 2);
  const png = encodePNG(size, size, downsample(rendered, size));
  const file = path.join(outDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
