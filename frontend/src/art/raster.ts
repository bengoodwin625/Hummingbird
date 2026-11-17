/**
 * A tiny indexed-colour raster for crisp pixel art. Every primitive writes whole pixels from the
 * palette (no anti-aliasing), so the scene can be scaled up by whole numbers and stay sharp.
 */
import type { PaletteIndex } from "./palette";

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in [0, 1) for a pixel. */
export function bayer(x: number, y: number): number {
  return ((BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
}

export class Raster {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.pixels = new Uint8Array(this.width * this.height);
  }

  get(x: number, y: number): PaletteIndex {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.pixels[y * this.width + x] ?? 0;
  }

  set(x: number, y: number, c: PaletteIndex): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.pixels[y * this.width + x] = c;
  }

  /** Set a pixel only where an ordered-dither pattern at `density` (0–1) allows it. */
  dither(x: number, y: number, c: PaletteIndex, density: number): void {
    if (bayer(Math.round(x), Math.round(y)) < density) this.set(x, y, c);
  }

  /**
   * Set a pixel with probability `density` from a fixed hash of its position: an irregular,
   * grain-like scatter for soft things (mist, moss) where an ordered dither reads as a grid.
   */
  scatter(x: number, y: number, c: PaletteIndex, density: number): void {
    if (hash2(Math.round(x), Math.round(y)) < density) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: PaletteIndex): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + w));
    const y1 = Math.min(this.height, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      this.pixels.fill(c, yy * this.width + x0, yy * this.width + x1);
    }
  }

  /** Filled ellipse, tested at pixel centres. `density` < 1 dithers the fill. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: PaletteIndex, density = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          if (density >= 1) this.set(x, y, c);
          else this.dither(x, y, c, density);
        }
      }
    }
  }

  /** Filled polygon (even-odd rule), sampled at pixel centres. */
  poly(points: ReadonlyArray<readonly [number, number]>, c: PaletteIndex, density = 1): void {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (!a || !b) continue;
        const [ax, ay] = a;
        const [bx, by] = b;
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
          xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const from = Math.ceil((xs[i] ?? 0) - 0.5);
        const to = Math.floor((xs[i + 1] ?? 0) - 0.5);
        for (let x = from; x <= to; x++) {
          if (density >= 1) this.set(x, y, c);
          else this.dither(x, y, c, density);
        }
      }
    }
  }

  /** One-pixel line (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, c: PaletteIndex): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Draw a quadratic curve as connected one-pixel segments. */
  curve(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    c: PaletteIndex,
  ): Array<[number, number]> {
    const steps = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      pts.push([x, y]);
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a && b) this.line(a[0], a[1], b[0], b[1], c);
    }
    return pts;
  }

  /** Copy non-transparent pixels of `src` onto this raster. */
  blit(src: Raster, dx: number, dy: number, flipX = false): void {
    dx = Math.round(dx);
    dy = Math.round(dy);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const c = src.pixels[y * src.width + (flipX ? src.width - 1 - x : x)] ?? 0;
        if (c !== 0) this.set(dx + x, dy + y, c);
      }
    }
  }

  /** Add a one-pixel outline in colour `c` around every non-transparent pixel. */
  outline(c: PaletteIndex): void {
    const copy = this.pixels.slice();
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= this.width || y >= this.height ? 0 : (copy[y * this.width + x] ?? 0);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (at(x, y) !== 0) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
          this.pixels[y * this.width + x] = c;
        }
      }
    }
  }

  /** Convert to RGBA using a packed palette (see packedPalette). */
  toImageData(packed: Uint32Array): ImageData {
    const data = new ImageData(this.width, this.height);
    const out = new Uint32Array(data.data.buffer);
    for (let i = 0; i < this.pixels.length; i++) {
      out[i] = packed[this.pixels[i] ?? 0] ?? 0;
    }
    return data;
  }
}

/** Deterministic value in [0, 1) for a pixel position. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Small deterministic PRNG, so the forest looks the same on every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
