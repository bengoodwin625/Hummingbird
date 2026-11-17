/**
 * Digits come from Silkscreen: Pixelify Sans's 5 reads like an S or 8 at small sizes, and a
 * speed quiz lives on numbers (times, scores, answers). "RQ Digits" covers 0–9 only and sits
 * in front of Pixelify Sans in the font stack (see --font-ui in style.css).
 */
import digits400 from "@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2?url";
import digits700 from "@fontsource/silkscreen/files/silkscreen-latin-700-normal.woff2?url";

export function loadDigitFont(): void {
  if (typeof FontFace === "undefined") return;
  const faces = [
    new FontFace("RQ Digits", `url(${digits400}) format("woff2")`, {
      weight: "100 500",
      unicodeRange: "U+0030-0039",
      display: "swap",
    }),
    new FontFace("RQ Digits", `url(${digits700}) format("woff2")`, {
      weight: "600 900",
      unicodeRange: "U+0030-0039",
      display: "swap",
    }),
  ];
  for (const face of faces) {
    document.fonts.add(face);
    void face.load().catch(() => {
      // Falls back to Pixelify Sans digits.
    });
  }
}
