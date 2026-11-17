import { describe, expect, it } from "vitest";
import { PALETTE, packedPalette } from "./palette";
import { Raster, bayer, mulberry32 } from "./raster";
import { BANDS, MOVE_FRAMES, sprite } from "./sprites";
import { buildJungle } from "../scene/jungle";
import { animalPosition } from "../scene/paths";
import { artSize } from "../scene/sizing";

describe("Raster", () => {
  it("clips writes outside the canvas", () => {
    const r = new Raster(4, 4);
    r.set(-1, 0, 5);
    r.set(4, 4, 5);
    r.rect(-2, -2, 10, 1, 5);
    expect([...r.pixels].every((p) => p === 0)).toBe(true);
  });

  it("fills a rectangle and an ellipse with whole pixels only", () => {
    const r = new Raster(10, 10);
    r.rect(1, 1, 3, 2, 7);
    expect(r.get(1, 1)).toBe(7);
    expect(r.get(3, 2)).toBe(7);
    expect(r.get(4, 1)).toBe(0);
    r.ellipse(5, 5, 3, 3, 9);
    expect(r.get(5, 5)).toBe(9);
    expect(r.get(0, 9)).toBe(0);
  });

  it("draws a polygon and a line", () => {
    const r = new Raster(10, 10);
    r.poly([[0, 0], [10, 0], [0, 10]], 3);
    expect(r.get(1, 1)).toBe(3);
    expect(r.get(9, 9)).toBe(0);
    r.line(0, 9, 9, 9, 4);
    expect(r.get(5, 9)).toBe(4);
  });

  it("outlines shapes", () => {
    const r = new Raster(5, 5);
    r.set(2, 2, 1);
    r.outline(2);
    expect(r.get(1, 2)).toBe(2);
    expect(r.get(2, 1)).toBe(2);
    expect(r.get(1, 1)).toBe(0);
  });

  it("dither thresholds stay inside 0–1", () => {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(bayer(x, y)).toBeGreaterThan(0);
        expect(bayer(x, y)).toBeLessThan(1);
      }
    }
  });

  it("is deterministic", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("art uses only the palette", () => {
  it("every sprite and the jungle stay inside the palette", () => {
    const max = PALETTE.length;
    for (const band of BANDS) {
      for (let f = 0; f < MOVE_FRAMES[band]; f++) {
        expect(Math.max(...sprite(band, "move", f).pixels)).toBeLessThan(max);
      }
      expect(Math.max(...sprite(band, "rest").pixels)).toBeLessThan(max);
    }
    const jungle = buildJungle(195, 170);
    expect(Math.max(...jungle.raster.pixels)).toBeLessThan(max);
    // The scene has no transparent holes.
    expect(jungle.raster.pixels.includes(0)).toBe(false);
  });

  it("packs every colour opaque except transparent", () => {
    const packed = packedPalette();
    expect(packed[0]).toBe(0);
    for (let i = 1; i < packed.length; i++) expect((packed[i] ?? 0) >>> 24).toBe(255);
  });
});

describe("results cast", () => {
  it("gives repeat animals distinct perches inside the scene", async () => {
    const { castSpots } = await import("../scene/stage");
    const { anchors } = buildJungle(200, 170);
    for (const band of BANDS) {
      const spots = castSpots(band, anchors, 200, 170);
      expect(spots.length).toBeGreaterThan(2);
      const keys = new Set(spots.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`));
      expect(keys.size).toBe(spots.length);
      for (const s of spots) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(200);
      }
    }
  });
});

describe("scene sizing and paths", () => {
  it("scales by whole numbers", () => {
    expect(artSize(391, 331)).toEqual({ width: 195, height: 165, pixel: 2 });
    expect(artSize(900, 640)).toEqual({ width: 450, height: 320, pixel: 2 });
    for (const w of [320, 375, 639, 640, 1000]) {
      const { width, pixel } = artSize(w, 300);
      expect(Number.isInteger(pixel)).toBe(true);
      expect(width * pixel).toBeLessThanOrEqual(w);
    }
  });

  it("every animal ends its run inside the scene", () => {
    const { anchors } = buildJungle(200, 170);
    for (const band of BANDS) {
      const end = animalPosition(band, 1, anchors, 200, 170);
      expect(end.x).toBeGreaterThan(0);
      expect(end.x).toBeLessThan(200);
      expect(end.y).toBeGreaterThan(0);
      expect(end.y).toBeLessThanOrEqual(170 + 30);
      expect(end.pose === "rest" || band === "hummingbird").toBe(true);
    }
  });
});
