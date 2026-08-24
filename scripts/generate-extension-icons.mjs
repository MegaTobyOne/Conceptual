// Generates deterministic 128x128 Marketplace PNG icons for the five
// extensions using only node:zlib — no image dependencies.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const root = process.cwd();
const SIZE = 128;
const CORNER_RADIUS = 24;
const BACKGROUND = [15, 23, 42, 255]; // dark slate, matches the ecosystem dark-first surface

const PRODUCTS = [
  { pkg: "core", accent: [100, 116, 139] }, // slate
  { pkg: "assurance", accent: [99, 102, 241] }, // muted indigo
  { pkg: "workshop", accent: [20, 184, 166] }, // teal
  { pkg: "shop", accent: [180, 83, 9] }, // bronze
  { pkg: "pub", accent: [162, 28, 175] } // plum
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (SIZE * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function insideRoundedSquare(x, y) {
  const r = CORNER_RADIUS;
  const cx = x < r ? r : x >= SIZE - r ? SIZE - r - 1 : x;
  const cy = y < r ? r : y >= SIZE - r ? SIZE - r - 1 : y;
  if (cx === x && cy === y) return true;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function insideShield(x, y) {
  // Shield glyph: straight-sided body tapering to a point at the base.
  const top = 42;
  const straightBottom = 68;
  const tip = 88;
  const halfWidth = 15;
  if (y < top || y > tip) return false;
  const half = y <= straightBottom ? halfWidth : halfWidth * ((tip - y) / (tip - straightBottom));
  return Math.abs(x - 64) <= half;
}

function renderIcon(accent) {
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  const circleRadiusSq = 40 * 40;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 4;
      if (!insideRoundedSquare(x, y)) {
        continue; // transparent
      }
      let colour = BACKGROUND;
      if ((x - 64) ** 2 + (y - 62) ** 2 <= circleRadiusSq) {
        colour = [...accent, 255];
      }
      if (insideShield(x, y)) {
        colour = [241, 245, 249, 255]; // near-white glyph
      }
      rgba[offset] = colour[0];
      rgba[offset + 1] = colour[1];
      rgba[offset + 2] = colour[2];
      rgba[offset + 3] = colour[3];
    }
  }
  return encodePng(rgba);
}

for (const product of PRODUCTS) {
  const resourcesDir = join(root, "packages", product.pkg, "resources");
  await mkdir(resourcesDir, { recursive: true });
  const png = renderIcon(product.accent);
  assert.ok(png.length > 500, `${product.pkg} icon should be a plausible PNG`);
  await writeFile(join(resourcesDir, "icon.png"), png);
  console.log(`wrote packages/${product.pkg}/resources/icon.png (${png.length} bytes)`);
}

console.log("ok generated Marketplace icons for 5 extensions");
