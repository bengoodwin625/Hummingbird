/**
 * One art pixel is always 2 CSS pixels: fine-grained pixel art at every size, and a whole
 * number, so nothing is ever half-pixel scaled. Bigger stages get more art pixels (more forest),
 * not bigger ones.
 */
export const ART_PIXEL = 2;

/** The scene's size in art pixels for a host of the given CSS size. */
export function artSize(
  cssWidth: number,
  cssHeight: number,
): { width: number; height: number; pixel: number } {
  return {
    width: Math.max(1, Math.floor(cssWidth / ART_PIXEL)),
    height: Math.max(1, Math.floor(cssHeight / ART_PIXEL)),
    pixel: ART_PIXEL,
  };
}
