/**
 * The one fixed palette. Scene art and sprites use only these colours (by index), and the UI
 * reads the same values through CSS custom properties (see style.css).
 *
 * Mood: a rainforest at dusk. Dark, rich greens, warm gold haze, jade light.
 */
export const PALETTE = [
  "transparent", // 0  T  transparent
  "#06110d", //  1  sky0  night
  "#0a1913", //  2  sky1
  "#0b1b16", //  3  sky2
  "#10261e", //  4  sky3
  "#183427", //  5  sky4
  "#2a4430", //  6  haze0  olive haze
  "#55583a", //  7  haze1
  "#8c7444", //  8  haze2  amber
  "#c99a52", //  9  glow   low sun
  "#0d1d17", // 10  far0   distant canopy
  "#122a20", // 11  far1
  "#163828", // 12  mid0
  "#1d4a33", // 13  mid1
  "#2a6243", // 14  mid2
  "#08130e", // 15  near0  foreground silhouette
  "#0f2219", // 16  near1
  "#3c7f52", // 17  leafHi rim light
  "#6aa864", // 18  leafHi2
  "#21160f", // 19  bark0
  "#3a291b", // 20  bark1
  "#5c4129", // 21  bark2
  "#2b4d45", // 22  mist0
  "#4a7468", // 23  mist1
  "#e8b04a", // 24  gold   fireflies, UI accent
  "#f6dc96", // 25  goldHi
  "#3fd0b0", // 26  jade   UI accent, hummingbird sheen
  "#eef0e2", // 27  ivory  text, highlights
  "#9fb5a6", // 28  sage   muted text
  "#b8324a", // 29  ruby   hummingbird throat, frog eye, bill tip
  "#d68a35", // 30  amber  jaguar, toucan bill
  "#8f5a22", // 31  ochre  jaguar shade
  "#2f9b62", // 32  emerald hummingbird, frog
  "#1f6a3e", // 33  forest  frog shade
  "#2f5f9e", // 34  blue   frog flank, toucan eye
  "#7b6349", // 35  fur
  "#4e3d2b", // 36  furDark
  "#c4ab83", // 37  furLight
  "#e2cf9e", // 38  cream  jaguar belly
] as const;

export type PaletteIndex = number;

/** Named indices, so drawing code reads as intent rather than numbers. */
export const C = {
  T: 0,
  sky0: 1,
  sky1: 2,
  sky2: 3,
  sky3: 4,
  sky4: 5,
  haze0: 6,
  haze1: 7,
  haze2: 8,
  glow: 9,
  far0: 10,
  far1: 11,
  mid0: 12,
  mid1: 13,
  mid2: 14,
  near0: 15,
  near1: 16,
  leafHi: 17,
  leafHi2: 18,
  bark0: 19,
  bark1: 20,
  bark2: 21,
  mist0: 22,
  mist1: 23,
  gold: 24,
  goldHi: 25,
  jade: 26,
  ivory: 27,
  sage: 28,
  ruby: 29,
  amber: 30,
  ochre: 31,
  emerald: 32,
  forest: 33,
  blue: 34,
  fur: 35,
  furDark: 36,
  furLight: 37,
  cream: 38,
} as const;

/** RGBA packed as little-endian 0xAABBGGRR for direct Uint32Array writes into ImageData. */
export function packedPalette(): Uint32Array {
  const out = new Uint32Array(PALETTE.length);
  PALETTE.forEach((hex, i) => {
    if (hex === "transparent") {
      out[i] = 0;
      return;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    out[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  });
  return out;
}
