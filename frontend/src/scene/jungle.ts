/**
 * The dusk rainforest backdrop, drawn procedurally into an indexed raster. It adapts to any
 * size, and returns the anchor points the animals use (ground, branch, vine, flowers).
 */
import { C, type PaletteIndex } from "../art/palette";
import { Raster, bayer, hash2, mulberry32 } from "../art/raster";

export interface Anchors {
  groundY: number;
  branch: { x0: number; x1: number; y: number };
  vine: { x: number; bottom: number };
  flower: { x: number; y: number };
  frogRest: number;
  jaguarRest: number;
}

export interface Jungle {
  raster: Raster;
  anchors: Anchors;
}

const SKY_STOPS: ReadonlyArray<readonly [number, PaletteIndex]> = [
  [0, C.sky0],
  [0.14, C.sky1],
  [0.25, C.sky2],
  [0.33, C.sky3],
  [0.4, C.sky4],
  [0.46, C.haze0],
  [0.51, C.haze1],
  [0.56, C.haze2],
  [0.6, C.glow],
];

function skyColour(t: number, x: number, y: number): PaletteIndex {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const prev = SKY_STOPS[i - 1];
    const next = SKY_STOPS[i];
    if (!prev || !next) continue;
    if (t <= next[0]) {
      const f = (t - prev[0]) / (next[0] - prev[0]);
      return bayer(x, y) < f ? next[1] : prev[1];
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1]?.[1] ?? C.glow;
}

function canopyLine(
  r: Raster,
  rand: () => number,
  baseY: number,
  colour: PaletteIndex,
  minR: number,
  maxR: number,
): void {
  let x = -maxR;
  while (x < r.width + maxR) {
    const rad = minR + rand() * (maxR - minR);
    const lift = rand() * rad * 0.9;
    r.ellipse(x, baseY - lift, rad, rad * (0.7 + rand() * 0.3), colour);
    x += rad * (0.8 + rand() * 0.6);
  }
  r.rect(0, baseY, r.width, r.height - baseY, colour);
}

function leafCluster(
  r: Raster,
  rand: () => number,
  cx: number,
  cy: number,
  size: number,
  base: PaletteIndex,
  light: PaletteIndex,
  rim: PaletteIndex,
): void {
  const blobs = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < blobs; i++) {
    const bx = cx + (rand() - 0.5) * size * 1.6;
    const by = cy + (rand() - 0.5) * size * 0.7;
    const br = size * (0.25 + rand() * 0.45);
    const squash = 0.5 + rand() * 0.4;
    r.ellipse(bx, by, br, br * squash, base);
    // Leaf texture: grain highlights on the sunlit (right, upper) side and dark gaps.
    for (let k = 0; k < br * 3; k++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * br * 0.9;
      const px = bx + Math.cos(a) * d;
      const py = by + Math.sin(a) * d * squash;
      const lit = Math.cos(a) * 0.6 - Math.sin(a) > 0.2;
      r.set(px, py, lit ? (rand() < 0.3 ? rim : light) : C.near1);
    }
    // Ragged edge: a few leaf tips poking out.
    for (let k = 0; k < 4; k++) {
      const a = rand() * Math.PI * 2;
      r.line(bx + Math.cos(a) * br * 0.8, by + Math.sin(a) * br * squash * 0.8,
        bx + Math.cos(a) * (br + 3), by + Math.sin(a) * (br * squash + 2), base);
    }
  }
}

function trunk(r: Raster, rand: () => number, x: number, top: number, bottom: number, w: number): void {
  // Slight lean and taper, so trunks read as wood rather than posts.
  const lean = (rand() - 0.5) * 3;
  for (let y = top; y < bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top);
    const xx = Math.round(x + lean * (1 - t));
    const ww = Math.max(2, Math.round(w * (0.85 + t * 0.3)));
    r.rect(xx, y, ww, 1, C.bark0);
    // Lit side (the low sun is to the right) and bark grain.
    r.set(xx + ww - 1, y, C.bark1);
    if (ww > 3 && hash2(xx, y) < 0.35) r.set(xx + ww - 2, y, C.bark1);
    if (hash2(xx + 7, y) < 0.18) r.set(xx + 1 + Math.floor(hash2(y, xx) * (ww - 2)), y, C.near1);
    if (ww > 4 && y % 9 === 0) r.set(xx + ww - 1, y, C.bark2);
    // Moss creeping up the shaded side, thicker near the ground.
    if (hash2(xx, y + 31) < 0.15 + t * 0.35) r.set(xx, y, t > 0.6 ? C.mid1 : C.mid0);
  }
  // Root flare with buttress roots.
  r.poly([[x - 6, bottom], [x, bottom - 8], [x + w, bottom - 8], [x + w + 6, bottom]], C.bark0);
  r.line(x - 5, bottom - 1, x + 1, bottom - 7, C.bark1);
  r.line(x + w + 4, bottom - 1, x + w - 1, bottom - 7, C.bark1);
  // An epiphyte (air plant) clinging partway up.
  if (bottom - top > 40) {
    const ey = Math.round(top + (bottom - top) * (0.35 + rand() * 0.3));
    const side = rand() < 0.5 ? -1 : 1;
    const ex = side < 0 ? x - 1 : x + w;
    // A small bromeliad: a tight rosette of strap leaves growing up and out from the bark.
    r.ellipse(ex + side, ey, 2, 1.2, C.mid1);
    for (let k = 0; k < 4; k++) {
      r.line(ex + side, ey, ex + side * (1 + k), ey - 5 + k, k % 2 === 0 ? C.mid2 : C.leafHi);
    }
    r.line(ex, ey, ex - side, ey - 4, C.mid2);
    if (rand() < 0.6) {
      r.set(ex + side, ey - 2, C.ruby);
      r.set(ex + side, ey - 3, C.ruby);
    }
  }
}

function vine(
  r: Raster,
  rand: () => number,
  x: number,
  top: number,
  bottom: number,
  sway: number,
  colour: PaletteIndex,
  leaf: PaletteIndex,
): void {
  const pts = r.curve(x, top, x + sway, (top + bottom) / 2, x + sway * 0.4, bottom, colour);
  pts.forEach(([px, py], i) => {
    if (i % 3 === 0 && rand() < 0.8) {
      const side = i % 2 === 0 ? 1 : -1;
      r.set(px + side, py, leaf);
      r.set(px + side * 2, py + 1, leaf);
    }
  });
}

function frond(
  r: Raster,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  leafLen: number,
  body: PaletteIndex,
  rim: PaletteIndex,
): void {
  const spine = r.curve(x0, y0, cx, cy, x1, y1, body);
  for (let i = 2; i < spine.length - 1; i += 2) {
    const p = spine[i];
    const q = spine[i + 1];
    if (!p || !q) continue;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const taper = Math.sin((i / spine.length) * Math.PI) * leafLen + 2;
    for (const side of [1, -1]) {
      const tipX = p[0] + nx * taper * side + dx * 1.5;
      const tipY = p[1] + ny * taper * side + Math.abs(ny * taper) * 0.6 + 2;
      r.poly([[p[0], p[1]], [p[0] + dx * 2, p[1] + dy * 2], [tipX, tipY]], body);
      r.line(p[0], p[1], tipX, tipY, side === 1 ? rim : body);
    }
  }
}

function monstera(r: Raster, cx: number, cy: number, rad: number, flip: boolean): void {
  r.ellipse(cx, cy, rad, rad * 0.8, C.near0);
  r.ellipse(cx - (flip ? -1 : 1) * rad * 0.2, cy - rad * 0.25, rad * 0.75, rad * 0.4, C.near1, 0.5);
  // the leaf's slits
  for (let i = -2; i <= 2; i++) {
    const a = (i / 5) * Math.PI * 0.9 + (flip ? Math.PI : 0);
    const sx = cx + Math.cos(a) * rad * 0.45;
    const sy = cy + Math.sin(a) * rad * 0.36;
    const ex = cx + Math.cos(a) * rad * 1.05;
    const ey = cy + Math.sin(a) * rad * 0.85;
    r.line(sx, sy, ex, ey, C.sky1);
  }
  r.line(cx, cy, cx + (flip ? 1 : -1) * rad * 1.1, cy + rad * 0.9, C.near1);
}

export function buildJungle(width: number, height: number, seed = 20261117): Jungle {
  const r = new Raster(width, height);
  const w = r.width;
  const h = r.height;
  const rand = mulberry32(seed);
  const groundY = Math.round(h * 0.86);

  // Sky with dithered bands and faint early stars.
  for (let y = 0; y < h; y++) {
    const t = y / h;
    for (let x = 0; x < w; x++) r.set(x, y, skyColour(t, x, y));
  }
  for (let i = 0; i < Math.round((w * h) / 900); i++) {
    const sx = Math.floor(rand() * w);
    const sy = Math.floor(rand() * h * 0.35);
    r.set(sx, sy, rand() < 0.3 ? C.ivory : C.sage);
  }

  // Low sun glowing through the haze.
  const sunX = w * 0.7;
  const sunY = h * 0.54;
  const sunR = Math.max(5, Math.min(w, h) * 0.06);
  r.ellipse(sunX, sunY, sunR * 1.9, sunR * 1.9, C.glow, 0.25);
  r.ellipse(sunX, sunY, sunR * 1.35, sunR * 1.35, C.glow, 0.6);
  r.ellipse(sunX, sunY, sunR, sunR, C.gold);
  r.ellipse(sunX - sunR * 0.15, sunY - sunR * 0.15, sunR * 0.6, sunR * 0.6, C.goldHi);

  // Distant canopy layers and mist.
  canopyLine(r, rand, Math.round(h * 0.6), C.sky4, 6, 14);
  // Mist as drifting wisps: grain-scattered (not an ordered grid), thicker in the middle of
  // each band and broken up along its length, so it veils what is behind it unevenly.
  const mist = (from: number, to: number, peak: number) => {
    const y0 = Math.round(h * from);
    const y1 = Math.round(h * to);
    const phase = rand() * 10;
    for (let y = y0; y < y1; y++) {
      const t = Math.sin(((y - y0) / Math.max(1, y1 - y0)) * Math.PI);
      for (let x = 0; x < w; x++) {
        const drift = 0.55 + 0.45 * Math.sin(x / 23 + phase + y / 9) * Math.sin(x / 61 + phase * 2);
        const d = peak * t * t * drift;
        r.scatter(x, y, d > peak * 0.55 && hash2(x, y + 99) < 0.3 ? C.mist1 : C.mist0, d);
      }
    }
  };
  mist(0.55, 0.7, 0.32);
  canopyLine(r, rand, Math.round(h * 0.68), C.far1, 8, 18);
  mist(0.66, 0.8, 0.26);

  // Mid layer: tall trunks with crowns, a branch for the toucan, hanging vines.
  const trunkXs = [0.12, 0.31, 0.88, 0.55].map((f) => Math.round(w * f + (rand() - 0.5) * 6));
  const crownY = Math.round(h * 0.16);
  trunkXs.forEach((tx, i) => {
    const tw = Math.round(3 + w * 0.014 + rand() * 3) + (i === 0 ? 2 : 0);
    trunk(r, rand, tx, crownY, groundY, tw);
  });
  const branchY = Math.round(h * 0.62);
  const branchX0 = (trunkXs[0] ?? 10) + 3;
  const branchX1 = Math.round(w * 0.42);
  // A living limb: it sags a little, tapers, carries moss and ends in leaves.
  const limb = r.curve(branchX0, branchY - 3, (branchX0 + branchX1) / 2, branchY + 3, branchX1, branchY, C.bark0);
  for (let i = 1; i < limb.length; i++) {
    const a = limb[i - 1];
    const b = limb[i];
    if (!a || !b) continue;
    const thick = Math.max(1, Math.round(3 * (1 - i / limb.length) + 1));
    for (let k = 0; k < thick; k++) r.line(a[0], a[1] + k, b[0], b[1] + k, C.bark0);
    r.line(a[0], a[1], b[0], b[1], C.bark1);
    const mx = Math.round(b[0]);
    if (hash2(mx, 9) < 0.35) r.set(mx, b[1] - 1, C.mid1);
    if (hash2(mx, 13) < 0.15) r.set(mx, b[1] - 2, C.mid2);
  }
  r.ellipse(branchX1 + 2, branchY - 1, 4, 2.5, C.mid0);
  r.ellipse(branchX1 + 1, branchY - 2, 2.5, 1.2, C.mid2, 0.6);

  for (const tx of trunkXs) {
    leafCluster(r, rand, tx + 2, crownY, Math.max(10, w * 0.09), C.mid0, C.mid1, C.mid2);
  }
  leafCluster(r, rand, w * 0.45, h * 0.06, w * 0.12, C.mid0, C.mid1, C.mid2);
  leafCluster(r, rand, w * 0.75, h * 0.04, w * 0.1, C.mid0, C.mid1, C.mid2);

  const vineX = Math.round(w * 0.78);
  const vineBottom = Math.round(h * 0.72);
  vine(r, rand, vineX, 0, vineBottom, 2, C.mid1, C.mid2);
  vine(r, rand, Math.round(w * 0.22), crownY, Math.round(h * 0.5), -3, C.mid1, C.mid2);
  vine(r, rand, Math.round(w * 0.62), 0, Math.round(h * 0.42), 4, C.mid0, C.mid1);

  // Low mist drifting in front of the trunk bases, so the far forest sits behind a veil.
  mist(0.74, 0.9, 0.3);

  // Heliconia flowers for the hummingbird.
  const flowerX = Math.round(w * 0.6);
  const flowerY = Math.round(h * 0.7);
  r.line(flowerX, flowerY, flowerX - 2, groundY, C.mid1);
  for (let i = 0; i < 4; i++) {
    const fy = flowerY + i * 3;
    const side = i % 2 === 0 ? 1 : -1;
    r.poly([[flowerX, fy], [flowerX + side * 5, fy - 2], [flowerX + side * 4, fy + 1]], C.ruby);
    r.set(flowerX + side * 4, fy - 1, C.gold);
  }

  // Forest floor, ferns and a fallen log.
  r.rect(0, groundY, w, h - groundY, C.near1);
  for (let x = 0; x < w; x += 4) {
    r.ellipse(x + rand() * 3, groundY, 3 + rand() * 3, 2 + rand() * 2, C.near1);
  }
  for (let x = 0; x < w; x++) r.dither(x, groundY - 1, C.mid0, 0.4);
  const logX = Math.round(w * 0.82);
  r.ellipse(logX, groundY + 2, w * 0.1, 3, C.bark0);
  r.ellipse(logX - w * 0.02, groundY + 1, w * 0.07, 1, C.bark1, 0.6);
  for (let i = 0; i < Math.max(4, Math.round(w / 28)); i++) {
    const fx = rand() * w;
    if (Math.abs(fx - w * 0.5) < w * 0.12) continue;
    for (let k = -3; k <= 3; k++) {
      r.curve(fx, groundY + 4, fx + k * 2, groundY - 6, fx + k * 4, groundY - 2 + Math.abs(k), k % 2 === 0 ? C.mid1 : C.mid2);
    }
  }

  // Foreground: a palm frond top-left, a monstera bottom-right, and a hanging vine.
  frond(r, -4, h * 0.1, w * 0.18, h * 0.08, w * 0.3, h * 0.36, Math.max(5, w * 0.05), C.near0, C.near1);
  frond(r, w + 4, h * 0.94, w * 0.86, h * 0.72, w * 0.7, h * 0.66, Math.max(4, w * 0.04), C.near0, C.near1);
  monstera(r, w * 0.04, h * 0.96, Math.max(10, w * 0.1), false);
  vine(r, rand, Math.round(w * 0.95), 0, Math.round(h * 0.38), -3, C.near0, C.near1);
  // Dark overhanging leaves along the top edge frame the scene and push it back in depth.
  frond(r, w + 6, -4, w * 0.82, h * 0.02, w * 0.62, h * 0.12, Math.max(4, w * 0.035), C.near0, C.near1);
  for (let x = 0; x < w; x++) {
    const sag = 2 + Math.round(2 * Math.sin(x / 7) + 2 * Math.sin(x / 17 + 1));
    for (let y = 0; y < sag; y++) r.set(x, y, C.near0);
  }

  // Grade the very bottom into darkness so the panel below sits on it cleanly.
  for (let y = h - 6; y < h; y++) {
    for (let x = 0; x < w; x++) r.dither(x, y, C.near0, (y - (h - 6)) / 6);
  }

  return {
    raster: r,
    anchors: {
      groundY,
      branch: { x0: branchX0, x1: branchX1, y: branchY },
      vine: { x: vineX, bottom: vineBottom },
      flower: { x: flowerX, y: flowerY },
      frogRest: Math.round(w * 0.3),
      jaguarRest: Math.round(w * 0.5),
    },
  };
}

export interface Firefly {
  x: number;
  y: number;
  phase: number;
  speed: number;
  drift: number;
}

export function makeFireflies(width: number, height: number, seed = 7): Firefly[] {
  const rand = mulberry32(seed);
  const count = Math.max(6, Math.round((width * height) / 2500));
  return Array.from({ length: count }, () => ({
    x: rand() * width,
    y: height * 0.3 + rand() * height * 0.55,
    phase: rand() * Math.PI * 2,
    speed: 0.6 + rand() * 1.2,
    drift: 2 + rand() * 5,
  }));
}

/** Draw fireflies at time `t` seconds. `still` draws them lit and unmoving. */
export function drawFireflies(r: Raster, flies: Firefly[], t: number, still: boolean): void {
  for (const f of flies) {
    const glow = still ? 1 : Math.sin(t * f.speed + f.phase);
    if (glow < 0.15) continue;
    const x = Math.round(f.x + (still ? 0 : Math.sin(t * 0.3 + f.phase) * f.drift));
    const y = Math.round(f.y + (still ? 0 : Math.cos(t * 0.25 + f.phase) * f.drift * 0.6));
    if (glow > 0.6) {
      r.set(x - 1, y, C.gold);
      r.set(x + 1, y, C.gold);
      r.set(x, y - 1, C.gold);
      r.set(x, y + 1, C.gold);
    }
    if (glow > 0.85) {
      // A faint warm halo on the brightest blink.
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]] as const) {
        r.dither(x + dx, y + dy, C.haze2, 0.5);
      }
    }
    r.set(x, y, glow > 0.4 ? C.goldHi : C.gold);
  }
}
