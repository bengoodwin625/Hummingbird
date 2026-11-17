/**
 * The canvas stage: sizes the scene to whole art pixels, draws the jungle, fireflies and the
 * revealed animal, and plays each animal's run.
 */
import { C, packedPalette } from "../art/palette";
import { Raster } from "../art/raster";
import { MOVE_FRAMES, sprite, type Band } from "../art/sprites";
import { buildJungle, drawFireflies, makeFireflies, type Anchors, type Firefly } from "./jungle";
import { animalPosition, RUN_MS } from "./paths";
import { artSize } from "./sizing";

interface Actor {
  band: Band;
  start: number;
  done: () => void;
  finished: boolean;
}

export class Stage {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly packed = packedPalette();
  private background: Raster | null = null;
  private anchors: Anchors | null = null;
  private frame: Raster | null = null;
  private flies: Firefly[] = [];
  private actor: Actor | null = null;
  /** Animals resting in the forest together (the results scene). */
  private cast: Band[] = [];
  /** A short burst of light where an animal lands. */
  private burst: { x: number; y: number; start: number; grand: boolean } | null = null;
  /** Recent positions of a running hummingbird, for its shimmering trail. */
  private trail: Array<[number, number]> = [];
  private raf = 0;
  private readonly reducedMotion: MediaQueryList;
  private readonly observer: ResizeObserver;

  constructor(private readonly host: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "stage-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    host.prepend(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D isn't available");
    this.ctx = ctx;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  get still(): boolean {
    return this.reducedMotion.matches;
  }

  /** Run an animal through the scene. Resolves when it reaches its resting spot. */
  playAnimal(band: Band): Promise<void> {
    this.actor?.done();
    this.cast = [];
    this.burst = null;
    this.trail = [];
    return new Promise((resolve) => {
      this.actor = {
        band,
        start: performance.now() - (this.still ? RUN_MS[band] : 0),
        done: resolve,
        finished: false,
      };
    });
  }

  clearAnimal(): void {
    this.actor?.done();
    this.actor = null;
    this.cast = [];
    this.burst = null;
  }

  /** Show every earned animal at rest in the forest, each band at its own spot. */
  showCast(bands: Band[]): void {
    this.clearAnimal();
    this.cast = bands;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.canvas.remove();
  }

  private resize(): void {
    const rect = this.host.getBoundingClientRect();
    const { width, height, pixel } = artSize(rect.width, rect.height);
    this.canvas.style.width = `${width * pixel}px`;
    this.canvas.style.height = `${height * pixel}px`;
    if (this.background && this.background.width === width && this.background.height === height) {
      return;
    }
    this.canvas.width = width;
    this.canvas.height = height;
    const jungle = buildJungle(width, height);
    this.background = jungle.raster;
    this.anchors = jungle.anchors;
    this.frame = new Raster(width, height);
    this.flies = makeFireflies(width, height);
    // Resizing a canvas clears it, so draw straight away rather than waiting for a frame.
    this.draw(performance.now());
  }

  private readonly tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    this.draw(now);
  };

  private draw(now: number): void {
    const bg = this.background;
    const frame = this.frame;
    const anchors = this.anchors;
    if (!bg || !frame || !anchors) return;
    frame.pixels.set(bg.pixels);
    drawFireflies(frame, this.flies, now / 1000, this.still);

    const actor = this.actor;
    if (actor) {
      const elapsed = now - actor.start;
      const duration = RUN_MS[actor.band];
      const p = Math.min(1, elapsed / duration);
      const pos = animalPosition(actor.band, p, anchors, frame.width, frame.height);
      let frameIndex = Math.floor(elapsed / pos.frameMs) % MOVE_FRAMES[actor.band];
      let pose = pos.pose;
      if (p >= 1) {
        if (!actor.finished) {
          actor.finished = true;
          actor.done();
          if (!this.still) {
            this.burst = { x: pos.x, y: pos.y - 8, start: now, grand: actor.band === "hummingbird" };
          }
        }
        // The hummingbird keeps hovering; everyone else settles.
        if (actor.band === "hummingbird" && !this.still) {
          pose = "move";
        } else {
          pose = "rest";
          frameIndex = 0;
        }
      }
      const bob = actor.band === "hummingbird" && p >= 1 && !this.still
        ? Math.round(Math.sin(now / 180))
        : 0;
      const s = sprite(actor.band, pose, frameIndex);
      if (actor.band === "hummingbird" && !this.still) this.drawTrail(frame, pos.x, pos.y - 8, p < 1);
      frame.blit(s, pos.x - s.width / 2, pos.y - s.height + bob, pos.flip);
    }
    this.drawCast(frame, anchors, now);
    this.drawBurst(frame, now);
    this.ctx.putImageData(frame.toImageData(this.packed), 0, 0);
  }

  private drawCast(frame: Raster, anchors: Anchors, now: number): void {
    const seen = new Map<Band, number>();
    for (const band of this.cast) {
      const k = seen.get(band) ?? 0;
      seen.set(band, k + 1);
      const spots = castSpots(band, anchors, frame.width, frame.height);
      const spot = spots[k % spots.length] ?? spots[0];
      if (!spot) continue;
      // Each repeat gets its own perch, facing and rhythm, so the gathering looks alive.
      const hovering = band === "hummingbird" && !this.still;
      const frameIndex = hovering ? Math.floor(now / (40 + k * 7) + k) % 2 : 0;
      const s = sprite(band, hovering ? "move" : "rest", frameIndex);
      const bob = hovering ? Math.round(Math.sin(now / (170 + k * 23) + k * 1.7) * 1.5) : 0;
      frame.blit(s, spot.x - s.width / 2, spot.y - s.height + bob, spot.flip);
    }
  }

  /** A shimmering jade-and-gold wake behind a hummingbird mid-dart. */
  private drawTrail(frame: Raster, x: number, y: number, moving: boolean): void {
    if (moving) {
      this.trail.push([x, y]);
      if (this.trail.length > 18) this.trail.shift();
    } else if (this.trail.length) {
      this.trail.shift();
    }
    this.trail.forEach(([tx, ty], i) => {
      const age = (this.trail.length - i) / this.trail.length;
      if (age > 0.85 && i % 2) return;
      frame.set(tx - 4, ty + ((i * 7) % 3) - 1, age < 0.4 ? C.goldHi : i % 2 ? C.jade : C.gold);
    });
  }

  private drawBurst(frame: Raster, now: number): void {
    const burst = this.burst;
    if (!burst || this.still) return;
    // A Hummingbird earns a bigger, longer celebration: three rings, more sparks, and every
    // firefly in the forest flaring at once.
    const duration = burst.grand ? 1400 : 700;
    const t = (now - burst.start) / duration;
    if (t >= 1) {
      this.burst = null;
      return;
    }
    const rings = burst.grand ? 3 : 1;
    for (let ring = 0; ring < rings; ring++) {
      const rt = t * (1 + ring * 0.35) - ring * 0.18;
      if (rt <= 0 || rt >= 1) continue;
      const radius = 4 + rt * (burst.grand ? 30 : 16);
      const rays = burst.grand ? 24 : 14;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + rt + ring;
        const x = burst.x + Math.cos(a) * radius;
        const y = burst.y + Math.sin(a) * radius * 0.7;
        if (rt < 0.6 || i % 2 === 0) {
          frame.set(x, y, rt < 0.35 ? C.goldHi : ring === 1 ? C.jade : C.gold);
        }
      }
    }
    frame.ellipse(burst.x, burst.y, 8 * (1 - t) + 2, 6 * (1 - t) + 1, C.gold, 0.25 * (1 - t));
    if (burst.grand && t < 0.8) drawFireflies(frame, this.flies, 0, true);
  }
}

interface Spot {
  x: number;
  y: number;
  flip: boolean;
}

/**
 * Resting places for repeat animals on the results scene, in order of use. Positions are each
 * sprite's bottom-centre in art pixels; repeats spread across different perches and facings.
 */
export function castSpots(band: Band, a: Anchors, w: number, h: number): Spot[] {
  const first = animalPosition(band, 1, a, w, h);
  const ground = a.groundY + 1;
  switch (band) {
    case "hummingbird":
      return [
        { x: first.x, y: first.y, flip: false },
        { x: w * 0.24, y: h * 0.5, flip: true },
        { x: w * 0.84, y: h * 0.56, flip: true },
        { x: w * 0.44, y: h * 0.38, flip: false },
        { x: w * 0.7, y: h * 0.46, flip: true },
        { x: w * 0.12, y: h * 0.62, flip: false },
        { x: w * 0.56, y: h * 0.6, flip: false },
        { x: w * 0.32, y: h * 0.34, flip: true },
      ];
    case "jaguar":
      return [
        { x: first.x, y: ground, flip: false },
        { x: w * 0.78, y: ground + 2, flip: true },
        { x: w * 0.2, y: ground + 3, flip: false },
        { x: w * 0.92, y: ground, flip: true },
      ];
    case "toucan": {
      const span = a.branch.x1 - a.branch.x0;
      return [
        { x: first.x, y: first.y, flip: true },
        { x: a.branch.x0 + span * 0.25, y: a.branch.y, flip: false },
        { x: w * 0.82, y: ground - 2, flip: true },
        { x: a.branch.x1 - 2, y: a.branch.y - 1, flip: false },
      ];
    }
    case "tree_frog":
      return [
        { x: first.x, y: ground, flip: false },
        { x: w * 0.66, y: ground + 2, flip: true },
        { x: w * 0.82, y: ground - 2, flip: false },
        { x: w * 0.46, y: ground + 3, flip: true },
      ];
    case "sloth":
      return [
        { x: first.x, y: first.y, flip: false },
        { x: w * 0.22, y: h * 0.5 + 24, flip: true },
        { x: w * 0.62, y: h * 0.42 + 24, flip: false },
      ];
  }
}
