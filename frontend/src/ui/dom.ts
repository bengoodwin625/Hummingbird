/** Minimal DOM helpers. Text always goes in through textContent, never innerHTML. */
import { C, packedPalette } from "../art/palette";
import { Raster } from "../art/raster";
import { targetIcon } from "../art/icons";
import { logo, sprite, type Band } from "../art/sprites";

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string | number | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key === "class") el.className = String(value);
    else if (key === "text") el.textContent = String(value);
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing`);
  return el as T;
}

const packed = packedPalette();

/** A crisp canvas of a raster, scaled by whole pixels. */
function rasterCanvas(r: Raster, scale: number, className?: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = r.width;
  canvas.height = r.height;
  canvas.style.width = `${r.width * scale}px`;
  canvas.style.height = `${r.height * scale}px`;
  canvas.getContext("2d")?.putImageData(r.toImageData(packed), 0, 0);
  canvas.setAttribute("aria-hidden", "true");
  if (className) canvas.className = className;
  return canvas;
}

/** A crisp canvas of an animal's resting sprite, scaled by whole pixels. */
export function animalIcon(band: Band, scale = 2, className?: string): HTMLCanvasElement {
  return rasterCanvas(sprite(band, "rest"), scale, className);
}

/** A copy of a sprite with every colour swapped through `map` (unmapped colours stay). */
function recolour(src: Raster, map: (c: number) => number): Raster {
  const out = new Raster(src.width, src.height);
  for (let i = 0; i < src.pixels.length; i++) {
    const c = src.pixels[i] ?? 0;
    out.pixels[i] = c === 0 ? 0 : map(c);
  }
  return out;
}

/** An animal not caught yet: a dark shape with its outline, for the field guide. */
export function animalSilhouette(band: Band, scale = 2, className?: string): HTMLCanvasElement {
  return rasterCanvas(recolour(sprite(band, "rest"), (c) => (c === C.near0 ? C.near0 : C.mid0)), scale, className);
}

/** The rare golden hummingbird (a Hummingbird answered in 0.3 s or less). */
export function goldenHummingbird(scale = 2, className?: string): HTMLCanvasElement {
  const gold: Record<number, number> = {
    [C.emerald]: C.gold,
    [C.forest]: C.ochre,
    [C.jade]: C.goldHi,
    [C.leafHi]: C.amber,
    [C.leafHi2]: C.goldHi,
    [C.mist1]: C.amber,
    [C.mist0]: C.ochre,
  };
  return rasterCanvas(recolour(sprite("hummingbird", "rest"), (c) => gold[c] ?? c), scale, className);
}

/** The Hummingbird logo (the bird at a heliconia bloom), scaled by whole pixels. */
export function targetCanvas(scale = 2, className?: string): HTMLCanvasElement {
  return rasterCanvas(targetIcon(), scale, className);
}

export function logoIcon(scale = 2, className?: string): HTMLCanvasElement {
  return rasterCanvas(logo(), scale, className);
}

/** Point the page's favicon at the hummingbird, drawn from the same sprite as the game. */
export function setFavicon(): void {
  const bird = sprite("hummingbird", "rest");
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(bird.toImageData(packed), 0, Math.floor((32 - bird.height) / 2));
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) {
    link.type = "image/png";
    link.href = canvas.toDataURL("image/png");
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Small pixel-grid icons, drawn as crisp SVG rectangles. */
const ICONS: Record<"cross" | "tick" | "share", Array<[number, number, number, number]>> = {
  cross: [
    [1, 1, 2, 2], [3, 3, 2, 2], [5, 5, 2, 2], [7, 7, 2, 2], [9, 9, 2, 2], [11, 11, 2, 2],
    [11, 1, 2, 2], [9, 3, 2, 2], [7, 5, 2, 2], [5, 7, 2, 2], [3, 9, 2, 2], [1, 11, 2, 2],
  ],
  tick: [[1, 7, 2, 2], [3, 9, 2, 2], [5, 11, 2, 2], [7, 9, 2, 2], [9, 7, 2, 2], [11, 5, 2, 2], [13, 3, 1, 2]],
  share: [
    [6, 1, 2, 9], [4, 3, 2, 2], [8, 3, 2, 2], [2, 5, 2, 2], [10, 5, 2, 2],
    [1, 8, 2, 6], [11, 8, 2, 6], [1, 12, 12, 2],
  ],
};

export function icon(name: keyof typeof ICONS, colour: string, label?: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 14 14");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }
  for (const [x, y, w, hgt] of ICONS[name]) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(w));
    rect.setAttribute("height", String(hgt));
    rect.setAttribute("fill", colour);
    svg.append(rect);
  }
  return svg;
}
