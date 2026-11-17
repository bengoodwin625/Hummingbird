/**
 * Each animal's run through the scene, as a pure function of progress (0–1). Positions are the
 * sprite's bottom-centre in art pixels.
 */
import type { Band, Pose } from "../art/sprites";
import type { Anchors } from "./jungle";

export const RUN_MS: Record<Band, number> = {
  hummingbird: 1000,
  jaguar: 950,
  toucan: 1150,
  tree_frog: 1250,
  sloth: 1400,
};

export interface Placement {
  x: number;
  y: number;
  pose: Pose;
  flip: boolean;
  frameMs: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function along(points: ReadonlyArray<readonly [number, number]>, p: number): [number, number] {
  const segments = points.length - 1;
  const scaled = clamp01(p) * segments;
  const i = Math.min(segments - 1, Math.floor(scaled));
  const local = easeInOut(scaled - i);
  const a = points[i] ?? [0, 0];
  const b = points[i + 1] ?? a;
  return [lerp(a[0], b[0], local), lerp(a[1], b[1], local)];
}

export function animalPosition(
  band: Band,
  progress: number,
  anchors: Anchors,
  width: number,
  height: number,
): Placement {
  const p = clamp01(progress);
  switch (band) {
    case "hummingbird": {
      // It hovers low by the heliconia, below the reveal text, so the rare catch is always seen.
      const target: [number, number] = [anchors.flower.x - 12, anchors.groundY - 6];
      const [x, y] = along(
        [
          [-16, height * 0.42],
          [width * 0.3, height * 0.58],
          [width * 0.42, height * 0.5],
          target,
        ],
        p,
      );
      return { x, y, pose: "move", flip: false, frameMs: 45 };
    }
    case "jaguar": {
      const x = lerp(-30, anchors.jaguarRest, easeOut(p));
      return { x, y: anchors.groundY + 1, pose: p < 1 ? "move" : "rest", flip: false, frameMs: 70 };
    }
    case "toucan": {
      const restX = Math.round((anchors.branch.x0 + anchors.branch.x1) / 2 + 6);
      const t = easeOut(p);
      const x = lerp(width + 24, restX, t);
      const arc = Math.sin(t * Math.PI) * height * 0.12;
      const y = lerp(height * 0.35, anchors.branch.y + 1, t) - arc;
      return { x, y, pose: p < 1 ? "move" : "rest", flip: true, frameMs: 110 };
    }
    case "tree_frog": {
      const hops = 3;
      const hopP = p * hops;
      const hop = Math.min(hops - 1, Math.floor(hopP));
      const local = p >= 1 ? 1 : hopP - hop;
      const startX = -14;
      const step = (anchors.frogRest - startX) / hops;
      const x = startX + step * (hop + easeOut(local));
      const air = local > 0.08 && local < 0.92 && p < 1;
      const y = anchors.groundY + 1 - Math.sin(local * Math.PI) * height * 0.12;
      return { x, y, pose: air ? "move" : "rest", flip: false, frameMs: 1000 };
    }
    case "sloth": {
      const y = lerp(-2, anchors.vine.bottom - 6, easeOut(p)) + 28;
      return { x: anchors.vine.x + 1, y, pose: p < 1 ? "move" : "rest", flip: false, frameMs: 320 };
    }
  }
}
