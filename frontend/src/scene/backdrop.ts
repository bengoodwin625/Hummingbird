/**
 * The page backdrop: a still, full-window jungle behind everything, so the forest reaches the
 * edges of every screen rather than living only in the stage band. It is drawn once per size
 * (no animation, so it costs nothing per frame); CSS fades it back behind important content.
 */
import { packedPalette } from "../art/palette";
import { buildJungle } from "./jungle";
import { artSize } from "./sizing";

/** A different seed from the stage, so the two forests don't repeat each other. */
const BACKDROP_SEED = 91_190;

export class Backdrop {
  private readonly canvas: HTMLCanvasElement;
  private readonly packed = packedPalette();
  private drawnWidth = 0;
  private drawnHeight = 0;
  private pending = 0;

  constructor(parent: HTMLElement = document.body) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "backdrop";
    this.canvas.setAttribute("aria-hidden", "true");
    parent.prepend(this.canvas);
    this.draw();
    window.addEventListener("resize", this.onResize);
  }

  private readonly onResize = (): void => {
    window.clearTimeout(this.pending);
    this.pending = window.setTimeout(() => this.draw(), 150);
  };

  private draw(): void {
    // Phones resize the viewport as the address bar shows and hides; only redraw for a new
    // width or a taller window, so scrolling never rebuilds the forest.
    const height = Math.max(window.innerHeight, document.documentElement.clientHeight);
    const size = artSize(window.innerWidth, height);
    if (size.width === this.drawnWidth && size.height <= this.drawnHeight) return;
    const jungle = buildJungle(size.width, size.height, BACKDROP_SEED, { sun: false });
    this.canvas.width = size.width;
    this.canvas.height = size.height;
    this.canvas.style.width = `${size.width * size.pixel}px`;
    this.canvas.style.height = `${size.height * size.pixel}px`;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(jungle.raster.toImageData(this.packed), 0, 0);
    this.drawnWidth = size.width;
    this.drawnHeight = size.height;
  }
}
