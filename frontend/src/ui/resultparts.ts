/**
 * The building blocks of a results page, shared by the Speed quiz and the How Close quiz so
 * both read the same: your score against today's average, everyone's scores as a curve, your
 * speed told with the animals, and the stat row. Every block takes plain numbers, never a
 * player count (we never show how many people have played).
 */
import type { Band } from "../art/sprites";
import { animalIcon, h, icon } from "./dom";
import { BAND_INFO, formatPoints, formatSeconds, scorePercent, smoothDistribution, speedGapLine } from "./format";

/** Where a score stands today, as a share of players rather than a head count. */
export function standingText(opts: { others: boolean; top: boolean; betterThan: number | null }): string {
  if (!opts.others) return "You're the first to finish today.";
  if (opts.top) return "Top score of the day so far.";
  if (opts.betterThan !== null && opts.betterThan > 0) return `Better than ${opts.betterThan}% of today's players.`;
  return "Plenty of room to climb tomorrow.";
}

/** You against today's average score, as two bars on one scale (only once others have played). */
export function scoreCompare(score: number, average: number | null): HTMLElement | null {
  if (average === null) return null;
  const max = Math.max(score, average, 1);
  const bar = (label: string, value: number, mine: boolean) => {
    const fill = h("span", { class: "compare-fill" });
    fill.style.width = `${Math.max(2, (value / max) * 100)}%`;
    return h(
      "div",
      { class: `compare-row${mine ? " compare-row--mine" : ""}` },
      h("span", { class: "compare-label", text: label }),
      h("span", { class: "compare-track" }, fill),
      h("span", { class: "compare-value", text: formatPoints(value) }),
    );
  };
  return h(
    "section",
    { class: "compare", "aria-label": "Your score against today's average" },
    bar("You", score, true),
    bar("Average", average, false),
  );
}

/** Everyone's final scores today as a smoothed curve, with you and the average marked. */
export function scoreCurve(opts: {
  distribution: number[];
  maxScore: number;
  score: number;
  average: number | null;
}): HTMLElement {
  const { distribution, maxScore: max, score, average } = opts;
  const section = h("section", { class: "curve", "aria-labelledby": "curve-title" });
  section.append(h("h2", { class: "section-title", id: "curve-title", text: "Everyone's scores today" }));

  const W = 320;
  const H = 100;
  const ys = smoothDistribution(distribution, 81);
  const pts = ys.map((y, i) => [(i / (ys.length - 1)) * W, H - y * (H - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "curve-svg");
  svg.setAttribute("aria-hidden", "true");
  // Faint bars show the real counts under the smoothed curve.
  const peak = Math.max(...distribution, 1);
  const bw = W / Math.max(distribution.length, 1);
  distribution.forEach((count, i) => {
    if (!count) return;
    const bar = document.createElementNS(NS, "rect");
    const bh = (count / peak) * (H - 6) * 0.92;
    bar.setAttribute("x", (i * bw + 1).toFixed(1));
    bar.setAttribute("y", (H - bh).toFixed(1));
    bar.setAttribute("width", (bw - 2).toFixed(1));
    bar.setAttribute("height", bh.toFixed(1));
    bar.setAttribute("class", "curve-bar");
    svg.append(bar);
  });
  const area = document.createElementNS(NS, "path");
  area.setAttribute("d", `${line} L${W} ${H} L0 ${H} Z`);
  area.setAttribute("class", "curve-area");
  const stroke = document.createElementNS(NS, "path");
  stroke.setAttribute("d", line);
  stroke.setAttribute("class", "curve-line");
  svg.append(area, stroke);

  const chart = h("div", { class: "curve-chart" }, svg);
  const marker = (cls: string, value: number, label: string) => {
    const at = scorePercent(value, max);
    const m = h("span", { class: `curve-marker ${cls}` }, h("span", { class: "curve-marker-label", text: label }));
    m.style.left = `${at}%`;
    if (at < 15) m.dataset.edge = "start";
    else if (at > 85) m.dataset.edge = "end";
    return m;
  };
  if (average !== null) chart.append(marker("curve-marker--avg", average, `Average ${formatPoints(average)}`));
  chart.append(marker("curve-marker--you", score, `You ${formatPoints(score)}`));

  const scale = h("p", { class: "curve-scale", "aria-hidden": "true" });
  for (const v of [0, max / 4, max / 2, (3 * max) / 4, max]) scale.append(h("span", { text: formatPoints(v) }));

  section.append(
    h("p", {
      class: "sr-only",
      text:
        average === null
          ? `Your ${formatPoints(score)} points.`
          : `Your ${formatPoints(score)} points against today's average of ${formatPoints(average)}.`,
    }),
    chart,
    scale,
  );
  return section;
}

/** One answer in the line-up: the animal it earned (or a miss) and its time. */
export interface Lap {
  slot: number;
  band: Band | null;
  elapsedMs: number | null;
  timedOut: boolean;
}

/**
 * Your speed, told with the animals: your pace animal and average up top with one plain line
 * against today's average, then every answer lined up as the animal it earned, each with its
 * time, and the quickest one marked.
 */
export function speedSection(opts: {
  mine: number | null;
  everyone: number | null;
  paceOf: (ms: number) => Band;
  laps: Lap[];
  lapPrefix: string;
  emptyText: string;
}): HTMLElement {
  const section = h("section", { class: "speed", "aria-labelledby": "speed-title" });
  section.append(h("h2", { class: "section-title", id: "speed-title", text: "Your speed" }));
  if (opts.mine !== null) {
    const pace = opts.paceOf(opts.mine);
    const hero = h(
      "div",
      { class: "pace" },
      h("span", { class: "pace-sprite" }, animalIcon(pace, 3)),
      h(
        "div",
        { class: "pace-text" },
        h("p", { class: "pace-name", text: `${BAND_INFO[pace].name} pace` }),
        h("p", { class: "pace-avg" }, h("strong", { text: formatSeconds(opts.mine) }), " average answer"),
      ),
    );
    hero.style.setProperty("--band-colour", `var(--band-${pace})`);
    section.append(hero, h("p", { class: "pace-compare", text: speedGapLine(opts.mine, opts.everyone) }));
  } else {
    section.append(h("p", { class: "pace-compare", text: opts.emptyText }));
  }
  section.append(lineUp(opts.laps, opts.lapPrefix));
  return section;
}

function lineUp(laps: Lap[], prefix: string): HTMLElement {
  const scored = laps.filter((l) => l.band !== null && l.elapsedMs !== null).map((l) => l.elapsedMs as number);
  const best = scored.length ? Math.min(...scored) : null;
  let bestTagged = false;
  const label = laps.map((l) => (l.band ? BAND_INFO[l.band].name : "missed")).join(", ");
  const list = h("ol", { class: `lineup lineup--${laps.length}`, "aria-label": label });
  for (const lap of laps) {
    const ok = lap.band !== null;
    const isBest = ok && !bestTagged && lap.elapsedMs === best;
    if (isBest) bestTagged = true;
    list.append(
      h(
        "li",
        { class: `lap${ok ? "" : " lap--miss"}${isBest ? " lap--best" : ""}` },
        isBest ? h("span", { class: "lap-tag", text: "Fastest" }) : null,
        h(
          "span",
          { class: "lap-art", "aria-hidden": "true" },
          ...(lap.band
            ? [animalIcon(lap.band, 1, "sprite-sm"), animalIcon(lap.band, 2, "sprite-lg")]
            : [icon("cross", "var(--ruby-text)")]),
        ),
        h("span", {
          class: "lap-time",
          text: lap.timedOut ? "Time" : lap.elapsedMs === null ? "–" : formatSeconds(lap.elapsedMs),
        }),
        h("span", { class: "lap-q", text: `${prefix}${lap.slot}` }),
      ),
    );
  }
  return list;
}

export function stat(label: string, value: string, highlight = false): HTMLElement {
  return h("div", { class: `stat${highlight ? " stat--rare" : ""}` }, h("dt", { text: label }), h("dd", { text: value }));
}

/** A Show/Hide list of every answer, as on the speed quiz's results. */
export function disclosure(title: string, list: HTMLElement): HTMLElement {
  return h(
    "details",
    { class: "answers-disclosure" },
    h(
      "summary",
      {},
      h("span", { text: title }),
      h("span", { class: "disclosure-hint when-closed", text: "Show" }),
      h("span", { class: "disclosure-hint when-open", text: "Hide" }),
    ),
    list,
  );
}
