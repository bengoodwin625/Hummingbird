/**
 * The picture share card: the day's animals resting in the forest, with the score and a few
 * stats, as a 1200×630 image (the size link previews and social posts expect). Drawn from the
 * same pixel art as the game, scaled by whole pixels so it stays crisp.
 */
import { packedPalette } from "../art/palette";
import { Raster } from "../art/raster";
import { sprite, type Band } from "../art/sprites";
import { buildJungle } from "../scene/jungle";
import { castSpots } from "../scene/stage";
import { BAND_INFO, bandForTime, formatPoints, formatSeconds } from "./format";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
const SCALE = 4;

export interface CardInput {
  number: number;
  totalScore: number;
  correct: number;
  total: number;
  avgMs: number | null;
  bands: Band[];
  host: string;
}

function forest(bands: Band[]): Raster {
  const w = Math.ceil(CARD_WIDTH / SCALE);
  const h = Math.ceil(CARD_HEIGHT / SCALE);
  const jungle = buildJungle(w, h, 4242);
  const frame = new Raster(w, h);
  frame.blit(jungle.raster, 0, 0);
  const seen = new Map<Band, number>();
  for (const band of bands) {
    const k = seen.get(band) ?? 0;
    seen.set(band, k + 1);
    const spots = castSpots(band, jungle.anchors, w, h);
    const spot = spots[k % spots.length] ?? spots[0];
    if (!spot) continue;
    const s = sprite(band, "rest");
    // Keep the animals on the right, clear of the words.
    const x = Math.max(spot.x, w * 0.5 + s.width / 2);
    frame.blit(s, x - s.width / 2, spot.y - s.height, spot.flip);
  }
  return frame;
}

export async function drawShareCard(input: CardInput): Promise<HTMLCanvasElement> {
  await document.fonts.ready.catch(() => undefined);
  const art = forest(input.bands);
  const small = document.createElement("canvas");
  small.width = art.width;
  small.height = art.height;
  small.getContext("2d")?.putImageData(art.toImageData(packedPalette()), 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, art.width * SCALE, art.height * SCALE);

  // A dusk wash on the left for the words.
  const wash = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.62, 0);
  wash.addColorStop(0, "rgba(6, 17, 13, 0.92)");
  wash.addColorStop(0.75, "rgba(6, 17, 13, 0.7)");
  wash.addColorStop(1, "rgba(6, 17, 13, 0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const x = 72;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f6dc96";
  ctx.font = "700 34px 'Pixelify Sans', sans-serif";
  ctx.fillText(`HUMMINGBIRD #${input.number}`, x, 120);

  ctx.fillStyle = "#e8b04a";
  ctx.font = "700 150px 'RQ Digits', 'Pixelify Sans', sans-serif";
  ctx.fillText(formatPoints(input.totalScore), x, 290);
  ctx.fillStyle = "#eef0e2";
  ctx.font = "600 34px 'Atkinson Hyperlegible Next Variable', sans-serif";
  ctx.fillText("points", x + 6, 340);

  const stats = [`${input.correct}/${input.total} correct`];
  if (input.avgMs !== null) {
    stats.push(`avg ${formatSeconds(input.avgMs)}`, `${BAND_INFO[bandForTime(input.avgMs)].name} pace`);
  }
  ctx.fillStyle = "#9fb5a6";
  ctx.font = "600 30px 'Atkinson Hyperlegible Next Variable', sans-serif";
  ctx.fillText(stats.join("  ·  "), x, 420);

  ctx.fillStyle = "#eef0e2";
  ctx.font = "700 28px 'Atkinson Hyperlegible Next Variable', sans-serif";
  ctx.fillText(`Can you beat me? ${input.host}`, x, 560);
  return canvas;
}

/**
 * On phones and tablets, open the share sheet with the image; on computers (where people
 * usually want the file), download it.
 */
export async function shareCard(canvas: HTMLCanvasElement, text: string): Promise<"shared" | "saved"> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't make the picture.");
  const file = new File([blob], "hummingbird.png", { type: "image/png" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hummingbird.png";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "saved";
}
