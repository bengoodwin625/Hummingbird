/**
 * Original pixel icons that aren't animals. Drawn from primitives in the game palette, like
 * the sprites, so they sit with the rest of the art.
 */
import { C } from "./palette";
import { Raster } from "./raster";

/** The How Close quiz: a target with a dart just off the bullseye ("close, but not quite"). */
export function targetIcon(): Raster {
  const r = new Raster(28, 26);
  const cx = 11;
  const cy = 15;
  // Rings, outside in.
  r.ellipse(cx, cy, 9.5, 9.5, C.ruby);
  r.ellipse(cx, cy, 7.5, 7.5, C.cream);
  r.ellipse(cx, cy, 5.5, 5.5, C.ruby);
  r.ellipse(cx, cy, 3.5, 3.5, C.cream);
  r.ellipse(cx, cy, 1.6, 1.6, C.gold);
  // The dart: a fine shaft from the top right, its point landing just off centre.
  r.line(22, 4, 13, 13, C.bark2);
  r.line(23, 4, 14, 13, C.bark1);
  r.set(13, 13, C.ivory);
  r.set(12, 14, C.ivory);
  // Jade flights, clear of the edge so the outline wraps them.
  r.poly([[20, 3], [24, 1], [22, 6]], C.jade);
  r.poly([[22, 6], [26, 4], [24, 8]], C.emerald);
  r.outline(C.near0);
  return r;
}
