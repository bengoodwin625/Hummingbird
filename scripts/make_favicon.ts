/**
 * Writes the site's icons straight from the game's hummingbird sprite, so they always match
 * the logo: frontend/public/favicon.svg (shown before the page's script runs, in bookmarks and
 * search results) and the home-screen app icons in frontend/public/icons/. Run after changing
 * the hummingbird:
 *
 *   npx esbuild scripts/make_favicon.ts --bundle --platform=node --format=esm --outfile=scripts/.icons.mjs
 *   node scripts/.icons.mjs && rm scripts/.icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { PALETTE } from "../frontend/src/art/palette";
import { sprite } from "../frontend/src/art/sprites";

const bird = sprite("hummingbird", "rest");
const BACKGROUND = "#06110d";

function hex(colour: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)) as [number, number, number];
}

// ---------------------------------------------------------------- favicon.svg

const SIZE = 32;
const ox = Math.floor((SIZE - bird.width) / 2);
const oy = Math.floor((SIZE - bird.height) / 2);
const rects: string[] = [];
for (let y = 0; y < bird.height; y++) {
  for (let x = 0; x < bird.width; x++) {
    const index = bird.pixels[y * bird.width + x] ?? 0;
    if (index === 0) continue;
    rects.push(`<rect x="${x + ox}" y="${y + oy}" width="1" height="1" fill="${PALETTE[index]}"/>`);
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">\n${rects.join("\n")}\n</svg>\n`;
const publicDir = new URL("../frontend/public/", import.meta.url);
writeFileSync(new URL("favicon.svg", publicDir), svg);

// ---------------------------------------------------------------- app icons (PNG)

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

/** A square PNG: the night background with the bird scaled by whole pixels, centred. */
function iconPng(size: number, scale: number): Buffer {
  const [br, bg, bb] = hex(BACKGROUND);
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set([br, bg, bb, 255], i * 4);
  const w = bird.width * scale;
  const h = bird.height * scale;
  const left = Math.floor((size - w) / 2);
  const top = Math.floor((size - h) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const index = bird.pixels[Math.floor(y / scale) * bird.width + Math.floor(x / scale)] ?? 0;
      if (index === 0) continue;
      const [r, g, b] = hex(PALETTE[index] as string);
      px.set([r, g, b, 255], ((top + y) * size + (left + x)) * 4);
    }
  }
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // no filter
    px.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = new URL("icons/", publicDir);
mkdirSync(iconsDir, { recursive: true });
// The bird fills about two thirds of each icon, inside the safe zone for round "maskable" masks.
writeFileSync(new URL("icon-192.png", iconsDir), iconPng(192, 4));
writeFileSync(new URL("icon-512.png", iconsDir), iconPng(512, 11));
writeFileSync(new URL("apple-touch-icon.png", iconsDir), iconPng(180, 4));
console.log(`favicon.svg (${rects.length} pixels) and 3 app icons written`);
