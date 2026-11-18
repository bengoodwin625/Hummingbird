/**
 * The How Close quiz on the page: five obscure-number guesses. It uses the same areas, styles
 * and rhythm as the speed quiz (ready → read → answer → reveal → results), through a small
 * shell the App hands it.
 */
import {
  ApiError,
  api,
  type NumbersQuestion,
  type NumbersResults,
  type NumbersReveal,
  type NumbersToday,
} from "../api";
import { BANDS, type Band } from "../art/sprites";
import type { Stage } from "../scene/stage";
import { animalIcon, h, icon } from "./dom";
import {
  BAND_INFO,
  NUMBERS_BAND_INFO,
  categoryLabel,
  formatCountdown,
  formatMultiplier,
  formatPoints,
  formatSeconds,
  numbersBandForTime,
} from "./format";
import { disclosure, scoreCompare, scoreCurve, speedSection, standingText, stat } from "./resultparts";
import { buildNumbersShareText } from "./share";
import { drawShareCard, shareCard } from "./sharecard";

export type ShellPhase = "serving" | "reading" | "answering" | "submitting" | "reveal" | "results";

/** What the How Close quiz needs from the App: the shared page areas and helpers. */
export interface Shell {
  root: HTMLElement;
  questionEl: HTMLElement;
  answersEl: HTMLElement;
  actionEl: HTMLElement;
  overlayEl: HTMLElement;
  progressEl: HTMLElement;
  scoreEl: HTMLElement;
  stage: Stage;
  setPhase(phase: ShellPhase): void;
  phase(): string;
  announce(text: string): void;
  actionButton(label: string, onClick: () => void, quiet?: boolean): HTMLButtonElement;
  renderStatus(text: string): void;
  setScore(total: number, animate: boolean): void;
  setQuizNo(text: string): void;
  backToMenu(): void;
  showError(error: unknown, retry: () => void): void;
}

const READ_MS = 3000;
const GRACE_MS = 1150;

/** Show a guess the way answers are shown ("4000" → "4,000"); anything odd is left as typed. */
export function formatGuess(raw: string | null): string {
  if (raw === null) return "None";
  const plain = raw.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(plain)) return raw;
  return Number(plain).toLocaleString("en-GB", { maximumFractionDigits: 6 });
}

export class NumbersGame {
  private question: NumbersQuestion | null = null;
  private timers: number[] = [];
  private results = new Map<number, { band: Band | null; closeness: number }>();
  private total = 5;

  constructor(private readonly shell: Shell) {}

  stop(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.question = null;
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  /** Open the game from the menu (or resume a live question after a reload). */
  start(today: NumbersToday): void {
    this.stop();
    this.total = today.total_questions;
    this.results = new Map(today.answered.map((a) => [a.slot, { band: a.band, closeness: a.closeness }]));
    if (today.number) this.shell.setQuizNo(`#${today.number}`);
    this.shell.setScore(today.total_score, false);
    if (today.status === "finished") void this.showResults();
    else void this.serve();
  }

  // ------------------------------------------------------------- progress

  private renderProgress(current: number | null): void {
    const steps: HTMLElement[] = [];
    for (let slot = 1; slot <= this.total; slot++) {
      const step = h("span", { class: "progress-step" });
      const result = this.results.get(slot);
      if (result?.band) {
        step.dataset.band = result.band;
        step.style.setProperty("--band-colour", `var(--band-${result.band})`);
      } else if (result) {
        step.dataset.state = "missed";
      } else if (slot === current) {
        step.dataset.state = "current";
      }
      steps.push(step);
    }
    const el = this.shell.progressEl;
    el.style.gridTemplateColumns = `repeat(${this.total}, minmax(0, 1fr))`;
    el.replaceChildren(...steps);
    el.setAttribute("aria-label", current ? `How Close question ${current} of ${this.total}` : "How Close quiz");
  }

  // ------------------------------------------------------------- serving

  private async serve(): Promise<void> {
    const s = this.shell;
    this.stop();
    s.setPhase("serving");
    s.root.classList.remove("is-results", "is-home");
    const button = s.actionEl.querySelector("button");
    if (button) {
      button.disabled = true;
      button.textContent = "Getting your question…";
    } else {
      s.renderStatus("Getting your question…");
    }
    try {
      const served = await api.numbersReady();
      if (served.kind === "reveal") this.showReveal(served.reveal);
      else this.showQuestion(served.question);
    } catch (error) {
      if (error instanceof ApiError && error.code === "finished") return this.showResults();
      s.showError(error, () => void this.serve());
    }
  }

  private showQuestion(q: NumbersQuestion): void {
    const s = this.shell;
    this.question = q;
    s.stage.clearAnimal();
    s.overlayEl.replaceChildren();
    s.actionEl.replaceChildren();
    s.setPhase("reading");
    this.renderProgress(q.slot);

    const words: Array<Node | string> = [];
    q.text.split(/(\s+)/).forEach((part, i) => {
      if (!part) return;
      if (/^\s+$/.test(part)) return void words.push(part);
      const word = h("span", { class: "q-word", text: part });
      word.style.setProperty("--w", String(Math.floor(i / 2)));
      words.push(word);
    });
    s.questionEl.replaceChildren(
      h(
        "p",
        { class: "question-meta", "aria-hidden": "true" },
        h("span", { class: "q-count" }, `Guess ${q.slot}`, h("span", { class: "q-of", text: ` / ${q.total}` })),
        h("span", { class: "q-cat", text: categoryLabel(q.category) }),
      ),
      h(
        "h1",
        { class: "question-text", id: "question-text" },
        h("span", { class: "sr-only", text: `How Close question ${q.slot} of ${q.total}: ` }),
        ...words,
      ),
    );

    const input = h("input", {
      class: "typed-input",
      id: "typed-input",
      type: "text",
      inputmode: "decimal",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
      enterkeyhint: "go",
      disabled: true,
      placeholder: "Opens in a moment",
      "aria-label": "Your guess (a number)",
    });
    const submit = h("button", { class: "button", type: "submit", disabled: true, text: "Lock in" });
    const message = h("p", { class: "typed-message", id: "typed-message", "aria-live": "polite" });
    const form = h("form", { class: "typed", novalidate: true }, input, submit, message);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.answer(input.value);
    });
    input.addEventListener("focus", () => s.root.classList.add("is-typing"));
    input.addEventListener("blur", () => s.root.classList.remove("is-typing"));

    const pips = h("span", { class: "read-pips", "aria-hidden": "true" });
    for (let i = 1; i <= 3; i++) {
      const pip = h("i", { class: "read-pip" });
      pip.style.setProperty("--i", String(i));
      pips.append(pip);
    }
    const cue = h(
      "div",
      { class: "read-cue", role: "status" },
      h("span", { class: "label read-label", text: "Read the question" }),
      pips,
    );
    cue.style.setProperty("--read-ms", `${Math.max(0, Math.min(READ_MS, q.read_remaining_ms))}ms`);
    s.answersEl.classList.remove("is-open");
    s.answersEl.replaceChildren(cue, form);
    this.later(q.read_remaining_ms, () => this.open(q));
  }

  private open(q: NumbersQuestion): void {
    const s = this.shell;
    if (s.phase() !== "reading" || this.question?.slot !== q.slot) return;
    s.setPhase("answering");
    s.answersEl.classList.add("is-open");
    const label = s.answersEl.querySelector(".read-label");
    if (label) label.textContent = "Your best guess!";
    s.root.classList.add("is-go");
    this.later(900, () => s.root.classList.remove("is-go"));
    if (!s.stage.still && "vibrate" in navigator) navigator.vibrate?.(15);
    const input = s.answersEl.querySelector<HTMLInputElement>("#typed-input");
    const submit = s.answersEl.querySelector<HTMLButtonElement>("button[type=submit]");
    if (input) {
      input.disabled = false;
      input.placeholder = "Type a number";
      input.focus();
    }
    if (submit) submit.disabled = false;
    this.later(q.answer_limit_ms + GRACE_MS, () => void this.checkTimeout(q.slot));
  }

  private setEnabled(enabled: boolean): void {
    const s = this.shell;
    const input = s.answersEl.querySelector<HTMLInputElement>("#typed-input");
    const submit = s.answersEl.querySelector<HTMLButtonElement>("button[type=submit]");
    if (input) input.disabled = !enabled;
    if (submit) submit.disabled = !enabled;
    if (enabled) input?.focus();
  }

  private async answer(value: string, attempt = 0): Promise<void> {
    const s = this.shell;
    const q = this.question;
    if (!q || (s.phase() !== "answering" && attempt === 0)) return;
    const message = s.answersEl.querySelector("#typed-message");
    if (value.trim() === "") {
      if (message) message.textContent = "Type a guess first.";
      return;
    }
    s.setPhase("submitting");
    this.setEnabled(false);
    try {
      this.showReveal(await api.numbersAnswer(q.slot, value));
    } catch (error) {
      if (error instanceof ApiError && (error.code === "not_a_number" || error.code === "blank")) {
        // Not a number: it doesn't use the go, so the question stays live.
        if (message) message.textContent = error.message;
        s.setPhase("answering");
        this.setEnabled(true);
        return;
      }
      if (error instanceof ApiError && (error.code === "network" || error.status >= 500) && attempt < 3) {
        this.later(600 * (attempt + 1), () => void this.answer(value, attempt + 1));
        return;
      }
      s.showError(error, () => void this.serve());
    }
  }

  private async checkTimeout(slot: number): Promise<void> {
    const s = this.shell;
    if (s.phase() !== "answering" || this.question?.slot !== slot) return;
    s.setPhase("submitting");
    this.setEnabled(false);
    try {
      this.showReveal(await api.numbersTimeout(slot));
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_yet") {
        s.setPhase("answering");
        this.setEnabled(true);
        this.later(Math.max(50, Number(error.extra.retry_after_ms ?? 250)), () => void this.checkTimeout(slot));
        return;
      }
      if (error instanceof ApiError && (error.code === "network" || error.status >= 500)) {
        s.setPhase("answering");
        this.later(1000, () => void this.checkTimeout(slot));
        return;
      }
      s.showError(error, () => void this.serve());
    }
  }

  // ------------------------------------------------------------- reveal

  private showReveal(r: NumbersReveal): void {
    const s = this.shell;
    this.stop();
    s.setPhase("reveal");
    s.root.classList.remove("is-typing", "is-go");
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.results.set(r.slot, { band: r.band, closeness: r.closeness });
    this.renderProgress(null);

    // Under the question: your guess against the answer.
    const rows = [
      h(
        "div",
        { class: "typed-result-row" },
        h("span", { class: "label", text: "Your guess" }),
        h("strong", { class: r.closeness > 0 ? "is-right" : "is-wrong", text: formatGuess(r.your_guess) }),
      ),
      h("div", { class: "typed-result-row" }, h("span", { class: "label", text: "Answer" }), h("strong", { text: r.answer })),
    ];
    s.answersEl.replaceChildren(h("div", { class: "typed-result" }, ...rows));

    // Over the scene: closeness is the headline, then the animal's multiplier and the points.
    const still = s.stage.still;
    const card = h("div", { class: `reveal${r.band ? " reveal--correct" : ""}` });
    if (r.band) card.style.setProperty("--band-colour", `var(--band-${r.band})`);
    const later = h("div", { class: "reveal-later" });
    if (r.outcome === "timeout") {
      card.append(h("p", { class: "reveal-time reveal-time--words", text: "Out of time" }));
      later.append(h("p", { class: "reveal-detail" }, "The answer was ", h("strong", { text: r.answer })));
      s.announce(`Out of time. The answer was ${r.answer}. No points.`);
    } else {
      const big = h("p", { class: "reveal-time", text: `${still ? r.closeness : 0}%` });
      card.append(big, h("p", { class: "reveal-sub", text: "close" }));
      if (r.band) {
        later.append(
          h("p", { class: "reveal-band", text: `${BAND_INFO[r.band].name} ${formatMultiplier(r.multiplier)}` }),
          h(
            "p",
            { class: "reveal-detail" },
            r.elapsed_ms !== null ? `${formatSeconds(r.elapsed_ms)} · ` : "",
            h("strong", { text: `+${formatPoints(r.points)}` }),
            " points",
          ),
        );
        if (r.band === "hummingbird") card.classList.add("reveal--rare");
        s.announce(`${r.closeness}% close. ${BAND_INFO[r.band].name}, times ${r.multiplier}. ${r.points} points.`);
      } else {
        later.append(
          h("p", { class: "reveal-band reveal-band--miss", text: "Way off" }),
          h("p", { class: "reveal-detail" }, "The answer was ", h("strong", { text: r.answer })),
        );
        s.announce(`Way off. The answer was ${r.answer}. No points.`);
      }
      if (!still) {
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / 700);
          big.textContent = `${Math.round(r.closeness * (1 - Math.pow(1 - p, 2)))}%`;
          if (p < 1 && s.phase() === "reveal") requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }
    card.append(later);
    s.overlayEl.replaceChildren(card);

    const next = r.slot + 1;
    const button =
      r.finished || next > this.total
        ? s.actionButton("See your results", () => void this.showResults(), true)
        : s.actionButton(`Ready for guess ${next}`, () => void this.serve(), true);
    const actions: HTMLElement[] = [];
    if (r.band) {
      const ladder = h("div", { class: "reveal-ladder", "aria-hidden": "true" });
      for (const band of BANDS) {
        const rung = h("span", { class: `reveal-rung${band === r.band ? " is-on" : ""}` }, animalIcon(band, 1));
        rung.style.setProperty("--band-colour", `var(--band-${band})`);
        ladder.append(rung);
      }
      actions.push(ladder);
    }
    s.actionEl.replaceChildren(...actions, button);
    button.focus({ preventScroll: true });

    const land = () => {
      later.classList.add("is-in");
      if (r.band) {
        void s.stage.playAnimal(r.band).then(() => {
          if (s.phase() === "reveal") button.classList.remove("button--quiet");
        });
      } else {
        button.classList.remove("button--quiet");
      }
    };
    if (still || r.outcome === "timeout") land();
    else this.later(700, land);

    s.setScore(r.total_score, true);
    if (r.points > 0 && !still) {
      const fly = h("span", { class: "score-fly", "aria-hidden": "true", text: `+${formatPoints(r.points)}` });
      s.scoreEl.parentElement?.append(fly);
      fly.addEventListener("animationend", () => fly.remove());
    }
  }

  // ------------------------------------------------------------- results

  /**
   * The results page, built from the same blocks as the Speed quiz's: score against today's
   * average, everyone's scores, your speed and line-up, the stat row, then every guess.
   */
  private async showResults(): Promise<void> {
    const s = this.shell;
    this.stop();
    s.setPhase("results");
    s.root.classList.remove("is-home");
    s.root.classList.add("is-results");
    s.renderStatus("Adding up your guesses…");
    let res: NumbersResults;
    try {
      res = await api.numbersResults();
    } catch (error) {
      s.showError(error, () => void this.showResults());
      return;
    }
    s.setQuizNo(`#${res.number}`);
    s.setScore(res.total_score, false);
    this.results = new Map(res.questions.map((q) => [q.slot, { band: q.band, closeness: q.closeness }]));
    this.renderProgress(null);
    s.stage.showCast(res.questions.filter((q) => q.band).map((q) => q.band as Band));

    const average = res.others ? res.average_score : null;
    const top = res.others && res.better_than_percent === 100;
    const spotOn = res.questions.filter((q) => q.closeness === 100).length;
    const caught = res.questions.filter((q) => q.band === "hummingbird").length;

    s.overlayEl.replaceChildren();
    s.questionEl.replaceChildren(
      h(
        "div",
        { class: "summary" },
        h("h1", { class: "sr-only", id: "question-text", text: `Your How Close quiz #${res.number} results` }),
        h(
          "p",
          { class: "summary-score" },
          h("strong", { text: formatPoints(res.total_score) }),
          h("span", { text: `of ${formatPoints(res.max_score)}` }),
        ),
        h("p", { class: "standing", text: standingText({ others: res.others, top, betterThan: res.better_than_percent }) }),
        scoreCompare(res.total_score, average),
        scoreCurve({ distribution: res.distribution, maxScore: res.max_score, score: res.total_score, average }),
        speedSection({
          mine: res.avg_elapsed_ms,
          everyone: res.everyone_avg_ms,
          paceOf: numbersBandForTime,
          laps: res.questions.map((q) => ({
            slot: q.slot,
            band: q.band,
            elapsedMs: q.elapsed_ms,
            timedOut: q.outcome === "timeout",
          })),
          lapPrefix: "G",
          emptyText: "No guesses in time today, so no pace to show. Tomorrow's another go.",
        }),
        h(
          "dl",
          { class: "stat-row" },
          stat("Average closeness", `${res.avg_closeness}%`),
          stat("Spot on", String(spotOn), spotOn > 0),
          stat("Hummingbirds", String(caught), caught > 0),
        ),
      ),
    );

    const list = h("ol", { class: "result-list" });
    for (const q of res.questions) {
      const chips = h("p", { class: "result-stats" });
      if (q.band) {
        const name = h("span", { class: "band", text: `${BAND_INFO[q.band].name} ${formatMultiplier(q.multiplier)}` });
        name.style.color = `var(--band-${q.band})`;
        chips.append(h("span", { text: `${q.closeness}% close` }), name);
      } else {
        chips.append(h("span", { class: "missed", text: q.outcome === "timeout" ? "Out of time" : "Way off" }));
      }
      if (q.elapsed_ms !== null) chips.append(h("span", { text: formatSeconds(q.elapsed_ms) }));
      chips.append(h("span", { text: `${formatPoints(q.points)} pts` }));
      list.append(
        h(
          "li",
          { class: "result-item" },
          h("span", { class: "result-icon" }, q.band ? animalIcon(q.band, 1) : icon("cross", "var(--ruby-text)")),
          h(
            "div",
            { class: "result-body" },
            h("p", { class: "result-q", text: q.text }),
            h(
              "p",
              { class: "result-answers" },
              "You: ",
              h("b", { text: q.your_guess === null ? "no guess" : formatGuess(q.your_guess) }),
              " · Answer: ",
              h("b", { text: q.answer }),
            ),
            chips,
          ),
        ),
      );
    }

    const status = h("p", { class: "share-status", role: "status" });
    const share = s.actionButton("Share your result", () => void this.share(res, status));
    share.prepend(icon("share", "currentColor"));
    const picture = s.actionButton("Share a picture", () => void this.sharePicture(res, status, picture), true);
    const next = h("p", {
      class: "cta-note",
      text: `Next How Close quiz in ${formatCountdown(Date.parse(res.next_unlock_at), Date.now())}.`,
    });
    const menu = s.actionButton("Back to the menu", () => s.backToMenu(), true);
    s.actionEl.replaceChildren(share, picture, status, next, menu);
    s.answersEl.replaceChildren(disclosure("Your guesses", list));
    s.announce(`You scored ${res.total_score} of ${res.max_score}, ${res.avg_closeness}% close on average.`);
  }

  private async sharePicture(res: NumbersResults, status: HTMLElement, button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    status.textContent = "Painting your forest…";
    try {
      const stats = [`${res.avg_closeness}% close on average`];
      if (res.avg_elapsed_ms !== null) stats.push(`${BAND_INFO[numbersBandForTime(res.avg_elapsed_ms)].name} pace`);
      const canvas = await drawShareCard({
        number: res.number,
        totalScore: res.total_score,
        correct: res.questions.filter((q) => q.band).length,
        total: res.questions.length,
        avgMs: res.avg_elapsed_ms,
        bands: res.questions.filter((q) => q.band).map((q) => q.band as Band),
        host: window.location.host,
        title: `HOW CLOSE #${res.number}`,
        stats,
      });
      const how = await shareCard(canvas, `How close can you get? Hummingbird How Close #${res.number}: ${window.location.origin}`);
      status.textContent = how === "saved" ? "Saved. Post it wherever you like." : "";
    } catch (error) {
      status.textContent =
        error instanceof DOMException && error.name === "AbortError" ? "" : "Couldn't make the picture. Please try again.";
    } finally {
      button.disabled = false;
    }
  }

  private async share(res: NumbersResults, status: HTMLElement): Promise<void> {
    const text = buildNumbersShareText({
      number: res.number,
      totalScore: res.total_score,
      maxScore: res.max_score,
      avgCloseness: res.avg_closeness,
      answers: res.questions.map((q) => ({ band: q.band })),
      url: window.location.origin,
    });
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      status.textContent = "Copied. Paste it into your group chat.";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      status.textContent = "Couldn't copy automatically. Here it is to copy by hand:";
      status.after(h("pre", { class: "question-lede", text }));
    }
  }

  // ------------------------------------------------------------- how to play

  info(): HTMLElement {
    const ladder = h("ol", { class: "ladder", "aria-label": "Speed animals and their multipliers, fastest first" });
    for (const band of BANDS) {
      const info = NUMBERS_BAND_INFO[band];
      const item = h(
        "li",
        { class: `ladder-step${band === "hummingbird" ? " ladder-step--rare" : ""}` },
        h("span", { class: "ladder-sprite" }, animalIcon(band, 2)),
        h(
          "span",
          { class: "ladder-text" },
          h("span", { class: "ladder-name", text: BAND_INFO[band].name }),
          h("span", { class: "ladder-range", text: info.range }),
        ),
        h("span", { class: "ladder-points", text: formatMultiplier(info.multiplier) }),
      );
      item.style.setProperty("--band-colour", `var(--band-${band})`);
      ladder.append(item);
    }
    const steps: Array<[string, string]> = [
      ["Five numbers a day", "Each question has a number for an answer, usually one you won't know. Make your best guess."],
      ["Closer scores more", "A spot-on guess scores 100. 10% out scores about 93, double or half about 50, and four times out or more scores nothing."],
      ["Speed multiplies it", "Your speed animal multiplies your closeness score, up to ×2 for a Hummingbird. So the best score on a question is 200, and 1,000 for the day."],
      ["More time to think", "You get three seconds to read and 30 seconds to answer. The clock stays hidden until you lock in."],
      ["Type any number", "Commas and decimals are fine, like 1,500 or 9.6. A blank or something that isn't a number doesn't use your go."],
    ];
    const list = h("ol", { class: "howto" });
    for (const [title, body] of steps) list.append(h("li", { class: "howto-step" }, h("strong", { text: title }), h("span", { text: body })));
    return h(
      "div",
      { class: "info-content" },
      h("p", { class: "info-lede", text: "Guess the number. The closer and the faster, the more you score." }),
      h("h3", { class: "section-title", text: "Speed multipliers" }),
      ladder,
      h("section", { class: "info-section" }, h("h3", { class: "section-title", text: "How to play" }), list),
    );
  }
}
