/**
 * Writes frontend/public/favicon.svg from the game's own hummingbird sprite, so the static
 * icon (used before the page's script runs, in bookmarks and in search results) always matches
 * the logo. Run after changing the hummingbird:
 *
 *   npx esbuild scripts/make_favicon.ts --bundle --platform=node --outfile=<tmp>/favicon.mjs --format=esm
 *   node <tmp>/favicon.mjs
 */
import { writeFileSync } from "node:fs";
import { PALETTE } from "../frontend/src/art/palette";
import { sprite } from "../frontend/src/art/sprites";

const SIZE = 32;
const bird = sprite("hummingbird", "rest");
const dx = Math.floor((SIZE - bird.width) / 2);
const dy = Math.floor((SIZE - bird.height) / 2);
const rects: string[] = [];
for (let y = 0; y < bird.height; y++) {
  for (let x = 0; x < bird.width; x++) {
    const index = bird.pixels[y * bird.width + x] ?? 0;
    if (index === 0) continue;
    rects.push(`<rect x="${x + dx}" y="${y + dy}" width="1" height="1" fill="${PALETTE[index]}"/>`);
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">\n${rects.join("\n")}\n</svg>\n`;
writeFileSync(new URL("../frontend/public/favicon.svg", import.meta.url), svg);
console.log(`favicon.svg written (${rects.length} pixels)`);
