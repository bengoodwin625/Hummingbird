/**
 * Original pixel sprites for the five speed animals, drawn from primitives at art-pixel scale.
 * Each animal has moving frames (its run) and a resting pose (where it ends up in the scene).
 */
import { C } from "./palette";
import { Raster } from "./raster";

export type Band = "hummingbird" | "jaguar" | "toucan" | "tree_frog" | "sloth";
export type Pose = "move" | "rest";

export const BANDS: readonly Band[] = ["hummingbird", "jaguar", "toucan", "tree_frog", "sloth"];

/** Frames in each animal's movement cycle. */
export const MOVE_FRAMES: Record<Band, number> = {
  hummingbird: 2,
  jaguar: 4,
  toucan: 2,
  tree_frog: 2,
  sloth: 2,
};

function hummingbird(pose: Pose, frame: number): Raster {
  const r = new Raster(32, 22);
  const wingUp = pose === "move" ? frame % 2 === 0 : true;
  // forked tail, fanned down and back, with pale tips
  r.poly([[11, 14], [6, 17], [7, 18], [10, 16]], C.forest);
  r.poly([[12, 15], [9, 19], [10, 20], [13, 16]], C.forest);
  r.line(10, 15, 7, 17, C.emerald);
  r.line(12, 16, 10, 18, C.emerald);
  r.set(6, 17, C.ivory);
  r.set(9, 19, C.ivory);
  // slim body, tilted head-up as it hovers
  r.ellipse(14.5, 13.6, 5.5, 2.8, C.emerald);
  r.ellipse(18.2, 11.6, 3.2, 2.5, C.emerald);
  r.line(10, 12, 17, 10, C.leafHi);
  r.line(12, 12, 16, 11, C.jade);
  // pale belly
  r.ellipse(16, 15, 3.4, 1.3, C.sage);
  r.line(12, 15, 14, 16, C.mist1);
  r.set(15, 17, C.near0);
  r.set(17, 17, C.near0);
  // head with a jade crown
  r.ellipse(21.5, 8.4, 2.8, 2.6, C.emerald);
  r.line(20, 6, 23, 6, C.jade);
  r.set(21, 7, C.jade);
  // ruby gorget with a gold glint
  r.ellipse(21.6, 10.8, 2, 1.2, C.ruby);
  r.set(21, 10, C.gold);
  // round eye (a dark disc with its corners cut) with a glint, pale spot behind it
  r.set(21, 7, C.near0);
  r.set(20, 8, C.near0);
  r.set(21, 8, C.near0);
  r.set(22, 8, C.near0);
  r.set(21, 9, C.near0);
  r.set(22, 7, C.ivory);
  r.set(19, 9, C.sage);
  // long, fine bill, lit along its top so it reads on the dark
  r.line(24, 9, 31, 10, C.bark2);
  r.line(24, 8, 28, 9, C.haze2);
  // near wing: solid, fanned primaries and a lit leading edge
  if (wingUp) {
    r.poly([[15, 11], [9, 2], [12, 0], [15, 1], [19, 10]], C.jade);
    r.line(15, 10, 10, 2, C.mist1);
    r.line(16, 10, 12, 1, C.mist1);
    r.line(17, 10, 14, 1, C.mist1);
    r.line(19, 10, 15, 1, C.ivory);
  } else {
    r.poly([[15, 13], [9, 21], [12, 21], [15, 20], [19, 13]], C.jade);
    r.line(15, 14, 10, 20, C.mist1);
    r.line(16, 14, 12, 20, C.mist1);
    r.line(19, 13, 15, 20, C.ivory);
  }
  r.outline(C.near0);
  return r;
}

/** The logo: the hummingbird on its own, from the same sprite the game uses. */
export function logo(): Raster {
  return sprite("hummingbird", "rest");
}

function jaguar(pose: Pose, frame: number): Raster {
  const r = new Raster(46, 24);
  const legY = 14;
  const leg = (hipX: number, footX: number, footY: number, colour: number) => {
    r.line(hipX, legY, footX, footY, colour);
    r.line(hipX + 1, legY, footX + 1, footY, colour);
    r.line(hipX + 2, legY, footX + 2, footY, C.ochre);
    r.set(footX + 1, footY, C.cream);
  };
  // legs behind the body first
  if (pose === "rest") {
    leg(12, 11, 21, C.ochre);
    leg(31, 31, 21, C.ochre);
  } else {
    const back = [[6, 20], [11, 21], [16, 20], [10, 18]][frame % 4] ?? [10, 20];
    const front = [[38, 19], [33, 21], [28, 20], [34, 18]][frame % 4] ?? [33, 20];
    leg(12, back[0] ?? 10, back[1] ?? 20, C.ochre);
    leg(31, front[0] ?? 33, front[1] ?? 20, C.ochre);
  }
  // tail
  const tail = r.curve(9, 10, 2, 7, 1, pose === "rest" ? 16 : 6, C.amber);
  for (const [x, y] of tail) r.set(x, y + 1, C.ochre);
  const tip = tail[tail.length - 1];
  if (tip) r.set(tip[0], tip[1], C.near0);
  // body
  r.ellipse(21, 12, 13, 5, C.amber);
  r.ellipse(21, 9, 12, 2, C.ochre, 0.5);
  r.ellipse(21, 15, 10, 1.8, C.cream);
  // rosettes
  const rosettes: Array<[number, number]> = [
    [12, 10], [16, 8], [20, 11], [24, 8], [28, 11], [15, 13], [23, 13], [31, 9], [9, 12],
  ];
  for (const [x, y] of rosettes) {
    r.set(x - 1, y, C.bark0);
    r.set(x + 1, y, C.bark0);
    r.set(x, y - 1, C.bark0);
    r.set(x, y + 1, C.bark0);
    r.set(x, y, C.ochre);
  }
  // near legs
  if (pose === "rest") {
    leg(15, 15, 22, C.amber);
    leg(28, 29, 22, C.amber);
  } else {
    const back = [[12, 22], [17, 22], [20, 21], [14, 20]][frame % 4] ?? [15, 22];
    const front = [[41, 20], [36, 22], [31, 22], [37, 19]][frame % 4] ?? [36, 22];
    leg(15, back[0] ?? 15, back[1] ?? 22, C.amber);
    leg(28, front[0] ?? 36, front[1] ?? 22, C.amber);
  }
  // head
  r.ellipse(37, 9, 5, 4, C.amber);
  r.poly([[34, 6], [35, 3], [37, 5]], C.ochre);
  r.set(35, 4, C.bark0);
  r.ellipse(41, 11, 2.6, 2, C.cream);
  r.set(43, 10, C.near0);
  r.set(39, 8, C.goldHi);
  r.set(38, 8, C.near0);
  r.set(36, 11, C.bark0);
  r.set(34, 9, C.bark0);
  r.outline(C.near0);
  return r;
}

function toucan(pose: Pose, frame: number): Raster {
  const r = new Raster(36, 24);
  // tail
  r.poly([[9, 13], [2, 18], [4, 20], [11, 15]], C.near1);
  r.set(10, 16, C.ruby);
  r.set(9, 16, C.ruby);
  // body
  r.ellipse(14, 12, 6.5, 5, C.near1);
  r.ellipse(13, 9, 5, 1.3, C.mist0, 0.6);
  // bib
  r.ellipse(18.5, 10.5, 3, 3, C.cream);
  // head
  r.ellipse(18, 7, 3.6, 3, C.near1);
  r.ellipse(19.5, 6.5, 1.6, 1.4, C.blue);
  r.set(20, 6, C.near0);
  // bill
  r.poly([[21, 4], [34, 7], [32, 10], [21, 9]], C.amber);
  r.line(21, 4, 33, 6, C.gold);
  r.line(22, 9, 31, 9, C.ochre);
  r.set(33, 7, C.ruby);
  r.set(32, 8, C.ruby);
  r.set(33, 8, C.ruby);
  // wing
  if (pose === "rest") {
    r.ellipse(12, 12, 5, 3.4, C.near0);
    r.line(9, 11, 15, 11, C.mist0);
    r.line(13, 17, 13, 20, C.ochre);
    r.line(16, 17, 16, 20, C.ochre);
  } else if (frame % 2 === 0) {
    r.poly([[10, 10], [3, 1], [9, 2], [16, 10]], C.near1);
    r.line(10, 9, 5, 2, C.mist1);
  } else {
    r.poly([[10, 13], [5, 22], [11, 21], [16, 13]], C.near1);
    r.line(10, 14, 7, 21, C.mist1);
  }
  r.outline(C.near0);
  return r;
}

function treeFrog(pose: Pose, _frame: number): Raster {
  const r = new Raster(26, 20);
  if (pose === "rest") {
    // folded back leg
    r.ellipse(8, 14, 3.4, 2.2, C.emerald);
    r.line(5, 17, 10, 17, C.amber);
    r.set(4, 16, C.amber);
    // front leg
    r.line(17, 13, 18, 17, C.emerald);
    r.line(17, 18, 20, 18, C.amber);
  } else {
    // stretched out mid-hop
    r.poly([[8, 12], [1, 17], [2, 18], [9, 14]], C.emerald);
    r.line(0, 17, 2, 19, C.amber);
    r.poly([[17, 12], [23, 15], [22, 16], [16, 13]], C.emerald);
    r.line(23, 15, 25, 16, C.amber);
  }
  // body
  r.ellipse(12, 12, 6.5, 4, C.emerald);
  r.ellipse(11, 10, 5.5, 1.6, C.forest, 0.5);
  r.ellipse(13, 14.5, 4, 1.2, C.cream);
  r.line(7, 13, 14, 14, C.blue);
  r.line(8, 14, 12, 14, C.blue);
  // head and eyes
  r.ellipse(16, 9, 4, 3, C.emerald);
  r.ellipse(12.6, 7, 1.7, 1.7, C.ruby);
  r.ellipse(16.4, 6.4, 2.2, 2.2, C.ruby);
  r.set(16, 6, C.near0);
  r.set(16, 7, C.near0);
  r.set(13, 7, C.near0);
  r.set(19, 10, C.forest);
  r.outline(C.near0);
  return r;
}

function sloth(pose: Pose, frame: number): Raster {
  const r = new Raster(30, 28);
  const reach = pose === "move" ? frame % 2 : 0;
  // arms up to the vine
  r.line(10, 14, 9, 2 + reach, C.furDark);
  r.line(11, 14, 10, 2 + reach, C.furDark);
  r.line(19, 14, 20, 3 - reach, C.furDark);
  r.line(20, 14, 21, 3 - reach, C.furDark);
  r.set(8, 1 + reach, C.near0);
  r.set(9, 1 + reach, C.near0);
  r.set(21, 2 - reach, C.near0);
  r.set(22, 2 - reach, C.near0);
  // body
  r.ellipse(15, 18, 6.5, 7, C.fur);
  r.ellipse(17, 19, 4, 5.5, C.furDark, 0.35);
  r.ellipse(14, 17, 4, 5, C.furLight, 0.18);
  // legs
  r.line(11, 23, 10, 27, C.furDark);
  r.line(19, 23, 20, 27, C.furDark);
  // head and face
  r.ellipse(15, 10, 4.5, 3.8, C.furLight);
  r.line(12, 9, 13, 10, C.bark0);
  r.line(17, 10, 18, 9, C.bark0);
  r.set(13, 10, C.near0);
  r.set(17, 10, C.near0);
  r.set(15, 11, C.near0);
  r.set(14, 12, C.furDark);
  r.set(16, 12, C.furDark);
  r.outline(C.near0);
  return r;
}

const DRAW: Record<Band, (pose: Pose, frame: number) => Raster> = {
  hummingbird,
  jaguar,
  toucan,
  tree_frog: treeFrog,
  sloth,
};

const cache = new Map<string, Raster>();

export function sprite(band: Band, pose: Pose, frame = 0): Raster {
  const f = pose === "rest" ? 0 : frame % MOVE_FRAMES[band];
  const key = `${band}:${pose}:${f}`;
  let found = cache.get(key);
  if (!found) {
    found = DRAW[band](pose, f);
    cache.set(key, found);
  }
  return found;
}
