/** The quiz flow: menu → ready → read → answer → reveal (×8) → results. */
import { ApiError, api, rememberPlayer, type Question, type Results, type Reveal, type Today } from "../api";
import { BANDS, type Band } from "../art/sprites";
import { Backdrop } from "../scene/backdrop";
import { Stage } from "../scene/stage";
import { animalIcon, byId, h, icon, logoIcon } from "./dom";
import {
  BAND_INFO,
  TYPING_ALLOWANCE_S,
  categoryLabel,
  formatCountdown,
  formatOrdinal,
  formatPoints,
  formatQuizDate,
  formatSeconds,
  scorePercent,
  smoothDistribution,
  speedTrackPercent,
} from "./format";
import { buildShareText } from "./share";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private windows can refuse storage; the flag is only a nicety.
  }
}

type Phase = "loading" | "intro" | "serving" | "reading" | "answering" | "submitting" | "reveal" | "results" | "closed";

/** Ask the server to resolve a timeout a little after its limit (15 s + 1 s grace). */
const TIMEOUT_CHECK_MS = 16_150;
const COUNT_UP_MS = 700;

export class App {
  private readonly root = byId("app");
  private readonly questionEl = byId("question");
  private readonly answersEl = byId("answers");
  private readonly actionEl = byId("action");
  private readonly overlayEl = byId("overlay");
  private readonly scoreEl = byId("score");
  private readonly quizNoEl = byId("quiz-no");
  private readonly liveEl = byId("live");
  private readonly progressEl = byId("progress");
  private readonly stage: Stage;

  private phase: Phase = "loading";
  private today: Today | null = null;
  private question: Question | null = null;
  private shownScore = 0;
  private timers: number[] = [];
  private countdownTimer = 0;
  /** What happened on each slot so far, for the progress strip. */
  private slotResults = new Map<number, { band: Band | null; correct: boolean }>();

  constructor() {
    this.stage = new Stage(byId("stage"));
    // The whole page sits in the forest; CSS fades it back while a question is live.
    new Backdrop(this.root);
    byId("brand-mark").append(logoIcon(1));
    // The logo goes back to the menu, except while a question is live.
    byId("brand").addEventListener("click", (event) => {
      event.preventDefault();
      if (this.phase === "intro" || this.phase === "closed" || this.phase === "results" || this.phase === "reveal") {
        window.clearInterval(this.countdownTimer);
        void this.start();
      }
    });
    document.addEventListener("keydown", this.onKey);
  }

  async start(): Promise<void> {
    this.setPhase("loading");
    this.clearTimers();
    this.renderStatus("Loading today's quiz…");
    try {
      const today = await api.today();
      this.today = today;
      rememberPlayer(today.player_id);
      this.quizNoEl.textContent = today.number ? `#${today.number}` : "";
      this.setScore(today.total_score, false);
      this.slotResults = new Map(
        today.answered.map((a) => [a.slot, { band: a.band, correct: a.outcome === "correct" }]),
      );
      this.renderProgress(today.status === "finished" ? null : today.next_slot);
      if (today.status === "no_quiz") return this.renderNoQuiz();
      if (today.question_live) return this.serve();
      this.renderMenu(today);
    } catch (error) {
      this.renderError(error, () => void this.start());
    }
  }

  // ------------------------------------------------------------- rendering helpers

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.root.dataset.phase = phase;
  }

  private renderProgress(current: number | null): void {
    const total = this.today?.total_questions ?? 8;
    if (!this.today?.has_quiz) {
      this.progressEl.replaceChildren();
      return;
    }
    const steps: HTMLElement[] = [];
    let correct = 0;
    for (let slot = 1; slot <= total; slot++) {
      const result = this.slotResults.get(slot);
      const step = h("span", { class: "progress-step" });
      if (result?.correct && result.band) {
        correct++;
        step.dataset.band = result.band;
        step.style.setProperty("--band-colour", `var(--band-${result.band})`);
      } else if (result) {
        step.dataset.state = "missed";
      } else if (slot === current) {
        step.dataset.state = "current";
      }
      steps.push(step);
    }
    this.progressEl.replaceChildren(...steps);
    this.progressEl.setAttribute(
      "aria-label",
      current ? `Question ${current} of ${total}. ${correct} correct so far.` : `${correct} of ${total} correct.`,
    );
  }

  private clearTimers(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private announce(text: string): void {
    this.liveEl.textContent = "";
    window.setTimeout(() => (this.liveEl.textContent = text), 50);
  }

  private setScore(total: number, animate: boolean): void {
    const from = this.shownScore;
    this.shownScore = total;
    if (!animate || this.stage.still || from === total) {
      this.scoreEl.textContent = formatPoints(total);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      this.scoreEl.textContent = formatPoints(Math.round(from + (total - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private renderStatus(text: string): void {
    this.questionEl.replaceChildren(h("p", { class: "question-lede", text }));
    this.answersEl.replaceChildren();
    this.actionEl.replaceChildren();
    this.overlayEl.replaceChildren();
  }

  private actionButton(label: string, onClick: () => void, quiet = false): HTMLButtonElement {
    const button = h("button", {
      class: `button button--block${quiet ? " button--quiet" : ""}`,
      type: "button",
      text: label,
    });
    button.addEventListener("click", onClick);
    return button;
  }

  private renderError(error: unknown, retry: () => void): void {
    const message =
      error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
    this.actionEl.replaceChildren(
      h("p", { class: "notice", role: "alert", text: message }),
      this.actionButton("Try again", retry, true),
    );
  }

  private renderNoQuiz(): void {
    this.setPhase("closed");
    this.root.classList.add("is-home");
    this.stage.clearAnimal();
    this.questionEl.replaceChildren(
      h("h1", { class: "question-text", id: "question-text", text: "No quiz today yet" }),
      h("p", {
        class: "question-lede",
        text: "New questions unlock at midnight UK time. Check back soon.",
      }),
    );
    this.answersEl.replaceChildren();
    this.actionEl.replaceChildren();
  }

  // ------------------------------------------------------------- menu

  /**
   * The home page is a menu of game modes. Today there is one, the daily quiz; the list is
   * built so new modes slot in beside it.
   */
  private renderMenu(today: Today): void {
    this.setPhase("intro");
    this.stage.clearAnimal();
    this.root.classList.remove("is-results");
    this.root.classList.add("is-home");
    const finished = today.status === "finished";
    const slot = today.next_slot ?? 1;
    const resuming = !finished && slot > 1;

    this.overlayEl.replaceChildren(
      h(
        "div",
        { class: "hero" },
        logoIcon(3, "hero-logo"),
        h("h1", { class: "hero-title", id: "question-text", text: "How fast is your brain?" }),
        h("p", {
          class: "hero-date",
          text: today.number ? `Quiz #${today.number} · ${formatQuizDate(today.date)}` : formatQuizDate(today.date),
        }),
      ),
    );
    this.questionEl.replaceChildren(
      h("p", {
        class: "hero-lede",
        text: "8 questions. The faster you answer, the faster your animal, and the more points you score.",
      }),
    );

    const daily = finished
      ? { status: `Played today · ${formatPoints(today.total_score)} pts`, cta: "See your results", go: () => void this.showResults() }
      : resuming
        ? { status: `Question ${slot} of ${today.total_questions} is waiting`, cta: "Continue", go: () => void this.serve() }
        : { status: "New questions today", cta: "Play", go: () => void this.serve() };

    // Once you've played, the card carries your day: the animals you caught, in order.
    const answered = [...today.answered].sort((x, y) => x.slot - y.slot);
    const animals = answered.length
      ? h(
          "span",
          {
            class: "mode-animals",
            role: "img",
            "aria-label": answered.map((a) => (a.outcome === "correct" && a.band ? BAND_INFO[a.band].name : "missed")).join(", "),
          },
          ...answered.map((a) =>
            a.outcome === "correct" && a.band ? animalIcon(a.band, 1) : icon("cross", "var(--ruby-text)"),
          ),
        )
      : null;

    const card = h(
      "button",
      { class: `mode${finished ? " mode--done" : ""}`, type: "button" },
      h("span", { class: "mode-art" }, animalIcon("hummingbird", 2)),
      h(
        "span",
        { class: "mode-text" },
        h("span", { class: "mode-name", text: "Daily quiz" }),
        h("span", { class: "mode-desc", text: "Eight questions, one go a day, the same for everyone." }),
        h("span", { class: "mode-status", text: daily.status }),
        animals,
      ),
      h("span", { class: "mode-cta", text: daily.cta }),
    );
    card.addEventListener("click", () => {
      card.disabled = true;
      daily.go();
    });

    // Each game carries its own instructions behind a little "i".
    const firstVisit = !readFlag("hb-seen-howto");
    const info = h(
      "button",
      {
        class: `mode-info${firstVisit && !finished ? " is-new" : ""}`,
        type: "button",
        "aria-label": "How to play the daily quiz",
        "aria-haspopup": "dialog",
      },
      h("span", { "aria-hidden": "true", text: "i" }),
    );
    info.addEventListener("click", () => {
      writeFlag("hb-seen-howto");
      info.classList.remove("is-new");
      this.openInfo("How to play the daily quiz", this.dailyInfo());
    });

    const modes = h(
      "ul",
      { class: "modes" },
      h("li", { class: "mode-item" }, card, info),
      h("li", { class: "mode-soon" }, h("span", { text: "More game modes coming soon" })),
    );

    const note = h("p", { class: "cta-note" });
    window.clearInterval(this.countdownTimer);
    if (finished) {
      const update = () => {
        note.textContent = `Next quiz in ${formatCountdown(Date.parse(today.next_unlock_at), Date.now())}.`;
      };
      update();
      this.countdownTimer = window.setInterval(update, 30_000);
    } else {
      note.textContent = firstVisit ? "New here? Tap the i for how to play." : "New questions every day at midnight UK time.";
    }

    this.actionEl.replaceChildren(
      h(
        "nav",
        { class: "menu", "aria-labelledby": "menu-title" },
        h("h2", { class: "section-title", id: "menu-title", text: "Choose a game" }),
        modes,
      ),
      note,
    );
    this.answersEl.replaceChildren();
  }

  /** A modal sheet for a game's instructions. */
  private openInfo(title: string, body: HTMLElement): void {
    const close = h("button", { class: "info-close", type: "button", "aria-label": "Close" }, icon("cross", "currentColor"));
    const dialog = h(
      "dialog",
      { class: "info-dialog", "aria-labelledby": "info-title" },
      h(
        "div",
        { class: "info-body" },
        h("div", { class: "info-head" }, h("h2", { class: "info-title", id: "info-title", text: title }), close),
        body,
      ),
    );
    close.addEventListener("click", () => dialog.close());
    // A tap on the dimmed backdrop (outside the sheet) closes it too.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  /** The daily quiz's instructions: the speed ladder, then the steps. */
  private dailyInfo(): HTMLElement {
    const ladder = h("ol", { class: "ladder", "aria-label": "Speed animals, fastest first" });
    for (const band of BANDS) {
      const info = BAND_INFO[band];
      const item = h(
        "li",
        { class: `ladder-step${band === "hummingbird" ? " ladder-step--rare" : ""}` },
        h("span", { class: "ladder-sprite" }, animalIcon(band, 2)),
        h(
          "span",
          { class: "ladder-text" },
          h("span", { class: "ladder-name", text: info.name }),
          h("span", { class: "ladder-range", text: info.range }),
        ),
        h("span", { class: "ladder-points", text: formatPoints(info.points) }),
      );
      item.style.setProperty("--band-colour", `var(--band-${band})`);
      ladder.append(item);
    }
    return h(
      "div",
      { class: "info-content" },
      h("p", { class: "info-lede", text: "Eight questions. The faster you answer, the faster your animal, and the more points you score." }),
      h("h3", { class: "section-title", text: "The speed ladder" }),
      ladder,
      this.howToPlay(),
    );
  }

  private howToPlay(): HTMLElement {
    const steps: Array<[string, string]> = [
      ["Start when you're ready", "Nothing is timed until you press the button, and you choose when to begin every question."],
      ["Read the question", "You get three seconds to read it. The answers stay sealed while the three lights fill."],
      ["Answer now!", "The six answers open together. Tap one, or type a number or a word when asked. You only get one go."],
      ["No clock on screen", "Your time stays hidden while you answer. It's revealed the moment you lock in, along with your animal."],
      ["Your speed picks your animal", "The animal sets your points, from a Hummingbird (1,000) down to a Sloth (100). A wrong answer scores nothing."],
      ["Typed answers get a head start", `Typing takes longer than tapping, so numbers get ${TYPING_ALLOWANCE_S.number} s and words get ${TYPING_ALLOWANCE_S.text} s taken off before your animal is chosen.`],
      ["See how you compare", "After eight questions, see your score, your speed and where you rank today, then share your row of animals."],
      ["Come back tomorrow", "There's one quiz a day, and new questions arrive at midnight UK time."],
    ];
    const list = h("ol", { class: "howto" });
    for (const [title, body] of steps) {
      list.append(h("li", { class: "howto-step" }, h("strong", { text: title }), h("span", { text: body })));
    }
    return h("section", { class: "info-section" }, h("h3", { class: "section-title", text: "How to play" }), list);
  }

  // ------------------------------------------------------------- serving a question

  private async serve(): Promise<void> {
    if (this.phase === "serving") return;
    this.setPhase("serving");
    this.clearTimers();
    this.root.classList.remove("is-results", "is-home");
    const button = this.actionEl.querySelector("button");
    if (button) {
      button.disabled = true;
      button.textContent = "Getting your question…";
    }
    try {
      const served = await api.ready();
      if (served.kind === "reveal") {
        this.showReveal(served.reveal, null);
      } else {
        this.showQuestion(served.question);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "finished") return this.showResults();
      this.setPhase("intro");
      this.renderError(error, () => void this.serve());
    }
  }

  private showQuestion(question: Question): void {
    this.question = question;
    this.stage.clearAnimal();
    this.overlayEl.replaceChildren();
    this.actionEl.replaceChildren();
    this.setPhase("reading");

    this.renderProgress(question.slot);
    // Each word rises in turn while the pips fill, so the read beat feels staged, not stalled.
    const words: Array<Node | string> = [];
    question.text.split(/(\s+)/).forEach((part, i) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        words.push(part);
        return;
      }
      const word = h("span", { class: "q-word", text: part });
      word.style.setProperty("--w", String(Math.floor(i / 2)));
      words.push(word);
    });
    this.questionEl.replaceChildren(
      h(
        "p",
        { class: "question-meta", "aria-hidden": "true" },
        h("span", { class: "q-count" }, `Question ${question.slot}`, h("span", { class: "q-of", text: ` / ${question.total}` })),
        question.category ? h("span", { class: "q-cat", text: categoryLabel(question.category) }) : null,
      ),
      h(
        "h1",
        { class: "question-text", id: "question-text" },
        h("span", { class: "sr-only", text: `Question ${question.slot} of ${question.total}: ` }),
        ...words,
      ),
    );

    this.answersEl.classList.remove("is-open");
    if (question.type === "choice") this.renderChoices(question);
    else this.renderTyped(question);
    this.answersEl.prepend(this.readCue(question.read_remaining_ms));

    this.later(question.read_remaining_ms, () => this.openAnswers(question));
  }

  /** The reading beat: three pips light in turn, then the answers open together. */
  private readCue(readMs: number): HTMLElement {
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
    cue.style.setProperty("--read-ms", `${Math.max(0, readMs)}ms`);
    return cue;
  }

  private renderChoices(question: Question): void {
    const grid = h("div", { class: "choices", role: "group", "aria-label": "Answers" });
    question.options.forEach((option, i) => {
      const button = h(
        "button",
        {
          class: "choice choice--locked",
          type: "button",
          disabled: true,
          "data-option": option.id,
          "aria-label": "Answer opening",
          style: `--i: ${i}`,
        },
        h("span", { class: "choice-key", text: String(i + 1) }),
        h("span", { class: "choice-text", text: option.text }),
      );
      button.addEventListener("click", () => void this.answerChoice(option.id));
      grid.append(button);
    });
    this.answersEl.replaceChildren(grid);
  }

  private renderTyped(question: Question): void {
    const isNumber = question.type === "number";
    const input = h("input", {
      class: "typed-input",
      id: "typed-input",
      type: "text",
      inputmode: isNumber ? "decimal" : "text",
      autocomplete: "off",
      autocapitalize: isNumber ? "off" : "words",
      spellcheck: "false",
      enterkeyhint: "go",
      disabled: true,
      placeholder: "Opens in a moment",
      "aria-label": isNumber ? "Your answer (a number)" : "Your answer",
    });
    const submit = h("button", { class: "button", type: "submit", disabled: true, text: "Lock in" });
    const message = h("p", { class: "typed-message", id: "typed-message", "aria-live": "polite" });
    const form = h("form", { class: "typed", novalidate: true }, input, submit, message);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.answerTyped(input.value);
    });
    input.addEventListener("focus", () => this.root.classList.add("is-typing"));
    input.addEventListener("blur", () => this.root.classList.remove("is-typing"));
    this.answersEl.replaceChildren(form);
  }

  private openAnswers(question: Question): void {
    if (this.phase !== "reading" || this.question?.slot !== question.slot) return;
    this.setPhase("answering");
    this.answersEl.classList.add("is-open");
    this.answersEl.querySelector(".choices")?.classList.add("is-opening");
    // The GO moment: the cue turns gold, the stage frame flashes, and phones give a tick.
    const label = this.answersEl.querySelector(".read-label");
    if (label) label.textContent = "Answer now!";
    this.root.classList.add("is-go");
    this.later(900, () => this.root.classList.remove("is-go"));
    if (!this.stage.still && "vibrate" in navigator) navigator.vibrate?.(15);
    if (question.type === "choice") {
      this.answersEl.querySelectorAll<HTMLButtonElement>(".choice").forEach((button) => {
        button.disabled = false;
        button.classList.remove("choice--locked");
        button.removeAttribute("aria-label");
      });
      this.answersEl.querySelector<HTMLButtonElement>(".choice")?.focus({ preventScroll: true });
    } else {
      const input = this.answersEl.querySelector<HTMLInputElement>("#typed-input");
      const submit = this.answersEl.querySelector<HTMLButtonElement>("button[type=submit]");
      if (input) {
        input.disabled = false;
        input.placeholder = question.type === "number" ? "Type a number" : "Type your answer";
        input.focus();
      }
      if (submit) submit.disabled = false;
    }
    this.later(TIMEOUT_CHECK_MS, () => void this.checkTimeout(question.slot));
  }

  private onKey = (event: KeyboardEvent): void => {
    if (this.phase !== "answering" || this.question?.type !== "choice") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = Number.parseInt(event.key, 10) - 1;
    const option = this.question.options[index];
    if (option) {
      event.preventDefault();
      void this.answerChoice(option.id);
    }
  };

  // ------------------------------------------------------------- answering

  private async answerChoice(optionId: number): Promise<void> {
    const question = this.question;
    if (this.phase !== "answering" || !question) return;
    this.setPhase("submitting");
    this.answersEl.querySelectorAll<HTMLButtonElement>(".choice").forEach((button) => {
      button.disabled = true;
      if (Number(button.dataset.option) === optionId) button.classList.add("choice--chosen");
    });
    await this.submit(question, () => api.answerChoice(question.slot, optionId));
  }

  private async answerTyped(value: string): Promise<void> {
    const question = this.question;
    if (this.phase !== "answering" || !question) return;
    const message = this.answersEl.querySelector("#typed-message");
    if (value.trim() === "") {
      if (message) message.textContent = "Type an answer first.";
      return;
    }
    this.setPhase("submitting");
    this.setTypedEnabled(false);
    await this.submit(question, () => api.answerText(question.slot, value));
  }

  private setTypedEnabled(enabled: boolean): void {
    const input = this.answersEl.querySelector<HTMLInputElement>("#typed-input");
    const submit = this.answersEl.querySelector<HTMLButtonElement>("button[type=submit]");
    if (input) input.disabled = !enabled;
    if (submit) submit.disabled = !enabled;
    if (enabled) input?.focus();
  }

  private async submit(question: Question, send: () => Promise<Reveal>, attempt = 0): Promise<void> {
    try {
      const reveal = await send();
      this.showReveal(reveal, question);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === "network" || error.status >= 500 || error.status === 429) {
        if (attempt < 4) {
          this.actionEl.replaceChildren(h("p", { class: "notice", role: "status", text: "Reconnecting…" }));
          this.later(600 * (attempt + 1), () => void this.submit(question, send, attempt + 1));
          return;
        }
        this.renderError(error, () => void this.submit(question, send, 0));
        return;
      }
      if (error.code === "blank" || error.code === "not_a_number") {
        // Not counted as the player's go: the question stays live.
        this.setPhase("answering");
        this.setTypedEnabled(true);
        const message = this.answersEl.querySelector("#typed-message");
        if (message) message.textContent = error.message;
        return;
      }
      if (error.code === "too_early") {
        this.later(250, () => void this.submit(question, send, attempt + 1));
        return;
      }
      this.renderError(error, () => void this.start());
    }
  }

  private async checkTimeout(slot: number): Promise<void> {
    if (this.phase !== "answering" || this.question?.slot !== slot) return;
    this.setPhase("submitting");
    this.answersEl.querySelectorAll<HTMLButtonElement>("button, input").forEach((el) => {
      el.disabled = true;
    });
    try {
      const reveal = await api.timeout(slot);
      this.showReveal(reveal, this.question);
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_yet") {
        const wait = Number(error.extra.retry_after_ms ?? 250);
        this.setPhase("answering");
        this.answersEl.querySelectorAll<HTMLButtonElement>("button, input").forEach((el) => {
          el.disabled = false;
        });
        this.later(Math.max(50, wait), () => void this.checkTimeout(slot));
        return;
      }
      if (error instanceof ApiError && (error.code === "network" || error.status >= 500)) {
        this.setPhase("answering");
        this.later(1000, () => void this.checkTimeout(slot));
        return;
      }
      this.renderError(error, () => void this.start());
    }
  }

  // ------------------------------------------------------------- reveal

  private showReveal(reveal: Reveal, question: Question | null): void {
    this.clearTimers();
    this.setPhase("reveal");
    this.root.classList.remove("is-typing", "is-go");
    this.answersEl.querySelector(".read-cue")?.remove();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    this.slotResults.set(reveal.slot, {
      band: reveal.band,
      correct: reveal.outcome === "correct",
    });
    this.renderProgress(null);
    this.renderAnswerResult(reveal, question);
    const streak = this.streakAt(reveal.slot);

    const next = reveal.slot + 1;
    const total = this.today?.total_questions ?? 8;
    // The button starts quiet and only turns gold once the reveal has landed, so it never
    // outshouts the time and the animal.
    const button = reveal.finished || next > total
      ? this.actionButton("See your results", () => void this.showResults(), true)
      : this.actionButton(`Ready for question ${next}`, () => void this.serve(), true);
    this.actionEl.replaceChildren(button);
    button.focus({ preventScroll: true });

    this.renderRevealCard(reveal, () => button.classList.remove("button--quiet"), streak);
    if (reveal.outcome === "correct" && reveal.band === "hummingbird") {
      // Said under the scene, not over it, so nothing covers the bird itself.
      this.actionEl.prepend(
        h("p", { class: "reveal-rare", text: "Lightning reflexes. The rarest catch in the forest." }),
      );
    }
    if (reveal.outcome === "correct" && reveal.band) {
      // The five animals in a row with yours lit, so you see where your speed landed.
      const ladder = h("div", { class: "reveal-ladder", "aria-hidden": "true" });
      for (const band of BANDS) {
        const rung = h("span", { class: `reveal-rung${band === reveal.band ? " is-on" : ""}` }, animalIcon(band, 1));
        rung.style.setProperty("--band-colour", `var(--band-${band})`);
        ladder.append(rung);
      }
      this.actionEl.prepend(ladder);
    }
    this.setScore(reveal.total_score, true);
    if (reveal.points > 0 && !this.stage.still) {
      const fly = h("span", { class: "score-fly", "aria-hidden": "true", text: `+${formatPoints(reveal.points)}` });
      this.scoreEl.parentElement?.append(fly);
      fly.addEventListener("animationend", () => fly.remove());
    }
  }

  /** How many answers in a row, ending at this slot, were correct. */
  private streakAt(slot: number): number {
    let n = 0;
    for (let k = slot; k >= 1 && this.slotResults.get(k)?.correct; k--) n++;
    return n;
  }

  private renderAnswerResult(reveal: Reveal, question: Question | null): void {
    if (question?.type === "choice" || reveal.correct_option_id !== null) {
      const buttons = this.answersEl.querySelectorAll<HTMLButtonElement>(".choice");
      if (buttons.length) {
        buttons.forEach((button) => {
          const id = Number(button.dataset.option);
          button.disabled = true;
          button.classList.remove("choice--locked", "choice--chosen");
          button.removeAttribute("aria-label");
          if (id === reveal.correct_option_id) {
            button.classList.add("choice--correct");
            button.append(icon("tick", "var(--jade)", "Correct answer"));
            button.lastElementChild?.classList.add("choice-mark");
          } else if (id === reveal.chosen_option_id) {
            button.classList.add("choice--wrong");
            button.append(icon("cross", "var(--ruby-text)", "Your answer"));
            button.lastElementChild?.classList.add("choice-mark");
          } else {
            button.classList.add("choice--dim");
          }
        });
        return;
      }
    }
    const rows = [];
    if (reveal.your_answer !== null) {
      rows.push(
        h(
          "div",
          { class: "typed-result-row" },
          h("span", { class: "label", text: "You said" }),
          h("strong", { class: reveal.outcome === "correct" ? "is-right" : "is-wrong", text: reveal.your_answer }),
        ),
      );
    }
    if (reveal.outcome !== "correct") {
      rows.push(
        h(
          "div",
          { class: "typed-result-row" },
          h("span", { class: "label", text: "Answer" }),
          h("strong", { text: reveal.correct_answer }),
        ),
      );
    }
    this.answersEl.replaceChildren(h("div", { class: "typed-result" }, ...rows));
  }

  private renderRevealCard(reveal: Reveal, onLanded: () => void, streak = 0): void {
    const still = this.stage.still;
    const card = h("div", { class: `reveal${reveal.outcome === "correct" ? " reveal--correct" : ""}` });
    if (reveal.band) card.style.setProperty("--band-colour", `var(--band-${reveal.band})`);
    const later = h("div", { class: "reveal-later" });

    if (reveal.outcome === "timeout") {
      card.append(h("p", { class: "reveal-time reveal-time--words", text: "Out of time" }));
      later.append(
        h("p", { class: "reveal-detail" }, "The answer was ", h("strong", { text: reveal.correct_answer })),
      );
      this.announce(`Out of time. The answer was ${reveal.correct_answer}. No points.`);
    } else {
      const elapsed = reveal.elapsed_ms ?? 0;
      const timeEl = h("p", { class: "reveal-time", text: formatSeconds(still ? elapsed : 0) });
      card.append(timeEl);
      if (reveal.outcome === "correct" && reveal.band) {
        const info = BAND_INFO[reveal.band];
        later.append(
          h("p", { class: "reveal-band", text: `${info.name}!` }),
          h(
            "p",
            { class: "reveal-detail" },
            "Correct · ",
            h("strong", { text: `+${formatPoints(reveal.points)}` }),
            " points",
            streak >= 2 ? h("span", { class: "reveal-streak", text: ` · ${streak} in a row` }) : null,
          ),
        );
        if (reveal.band === "hummingbird") {
          // The rarest catch: it gets its own moment.
          card.classList.add("reveal--rare");
          if (!still && "vibrate" in navigator) navigator.vibrate?.([30, 60, 30, 60, 90]);
        }
        this.announce(`Correct. ${formatSeconds(elapsed)}. ${info.name}. ${reveal.points} points.`);
      } else {
        later.append(
          h("p", { class: "reveal-band reveal-band--miss", text: "Not quite" }),
          h("p", { class: "reveal-detail" }, "The answer was ", h("strong", { text: reveal.correct_answer })),
        );
        this.announce(`Not quite. ${formatSeconds(elapsed)}. The answer was ${reveal.correct_answer}. No points.`);
      }
      if (!still) {
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / COUNT_UP_MS);
          timeEl.textContent = formatSeconds(elapsed * (1 - Math.pow(1 - p, 2)));
          if (p < 1 && this.phase === "reveal") requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }
    card.append(later);
    this.overlayEl.replaceChildren(card);

    const land = () => {
      later.classList.add("is-in");
      if (reveal.outcome === "correct" && reveal.band) {
        void this.stage.playAnimal(reveal.band).then(() => {
          if (this.phase === "reveal") onLanded();
        });
      } else {
        onLanded();
      }
    };
    if (still || reveal.outcome === "timeout") land();
    else this.later(COUNT_UP_MS, land);
  }

  // ------------------------------------------------------------- results

  private async showResults(): Promise<void> {
    this.clearTimers();
    this.setPhase("results");
    this.root.classList.remove("is-home");
    this.root.classList.add("is-results");
    this.renderStatus("Adding up your day…");
    let results: Results;
    try {
      results = await api.results();
    } catch (error) {
      this.renderError(error, () => void this.showResults());
      return;
    }
    this.quizNoEl.textContent = `#${results.number}`;
    this.setScore(results.total_score, false);

    // The day's animals all gather in the forest: the picture the share row stands for.
    this.stage.showCast(
      results.questions.filter((q) => q.outcome === "correct" && q.band).map((q) => q.band as Band),
    );
    this.slotResults = new Map(
      results.questions.map((q) => [q.slot, { band: q.band, correct: q.outcome === "correct" }]),
    );
    this.renderProgress(null);

    const row = h("div", { class: "animal-row", role: "img", "aria-label": this.rowLabel(results) });
    for (const q of results.questions) {
      row.append(
        h(
          "span",
          { class: "animal-cell" },
          ...(q.outcome === "correct" && q.band
            ? [animalIcon(q.band, 1, "sprite-sm"), animalIcon(q.band, 2, "sprite-lg")]
            : [icon("cross", "var(--ruby-text)")]),
        ),
      );
    }

    const avg = results.avg_correct_elapsed_ms;
    const shareStatus = h("p", { class: "share-status", role: "status" });
    const shareButton = this.actionButton("Share your result", () => void this.share(results, shareStatus));
    shareButton.prepend(icon("share", "currentColor"));
    const nextEl = h("p", { class: "cta-note" });
    const updateNext = () => {
      nextEl.textContent = `Next quiz in ${formatCountdown(Date.parse(results.next_unlock_at), Date.now())}.`;
    };
    updateNext();
    window.clearInterval(this.countdownTimer);
    this.countdownTimer = window.setInterval(updateNext, 30_000);

    const caught = results.questions.filter((q) => q.outcome === "correct" && q.band === "hummingbird").length;
    const stats = h(
      "dl",
      { class: "stat-row" },
      this.stat("Correct", `${results.correct_count}/${results.questions.length}`),
      this.stat("Fastest", results.speed.fastest_ms !== null ? formatSeconds(results.speed.fastest_ms) : "–"),
      this.stat("Hummingbirds", String(caught), caught > 0),
    );

    this.questionEl.replaceChildren(
      h(
        "div",
        { class: "summary" },
        h("h1", { class: "sr-only", id: "question-text", text: `Your Hummingbird #${results.number} results` }),
        h(
          "p",
          { class: "summary-score" },
          h("strong", { text: formatPoints(results.total_score) }),
          h("span", { text: "points" }),
        ),
        h("p", { class: "standing", text: this.standingLine(results) }),
        this.scoreCompare(results),
        this.scoreCurve(results),
        this.speedCompare(results, avg),
        stats,
        row,
      ),
    );

    const list = h("ol", { class: "result-list" });
    for (const q of results.questions) {
      const stats = h("p", { class: "result-stats" });
      if (q.outcome === "correct" && q.band) {
        const name = h("span", { class: "band", text: BAND_INFO[q.band].name });
        name.style.color = `var(--band-${q.band})`;
        stats.append(name);
      } else {
        stats.append(h("span", { class: "missed", text: q.outcome === "timeout" ? "Out of time" : "Missed" }));
      }
      if (q.elapsed_ms !== null) stats.append(h("span", { text: formatSeconds(q.elapsed_ms) }));
      stats.append(
        h("span", { text: `${formatPoints(q.points)} pts` }),
        h("span", { class: "muted", text: `${q.percent_correct}% got it right` }),
      );
      list.append(
        h(
          "li",
          { class: "result-item" },
          h(
            "span",
            { class: "result-icon" },
            q.outcome === "correct" && q.band ? animalIcon(q.band, 1) : icon("cross", "var(--ruby-text)"),
          ),
          h(
            "div",
            { class: "result-body" },
            h("p", { class: "result-q", text: q.text }),
            h(
              "p",
              { class: "result-answers" },
              "You: ",
              h("b", { text: q.your_answer ?? "no answer" }),
              q.outcome === "correct" ? "" : " · Answer: ",
              q.outcome === "correct" ? "" : h("b", { text: q.correct_answer }),
            ),
            stats,
          ),
        ),
      );
    }

    this.overlayEl.replaceChildren();
    const menuButton = this.actionButton(
      "Back to the menu",
      () => {
        window.clearInterval(this.countdownTimer);
        void this.start();
      },
      true,
    );
    this.actionEl.replaceChildren(shareButton, shareStatus, nextEl, menuButton);
    this.answersEl.replaceChildren(
      h(
        "details",
        { class: "answers-disclosure" },
        h(
          "summary",
          {},
          h("span", { text: "Your answers" }),
          h("span", { class: "disclosure-hint when-closed", text: "Show" }),
          h("span", { class: "disclosure-hint when-open", text: "Hide" }),
        ),
        list,
      ),
    );
    this.announce(`You scored ${results.total_score} points with ${results.correct_count} correct answers.`);
  }

  private rowLabel(results: Results): string {
    return results.questions
      .map((q) => (q.outcome === "correct" && q.band ? BAND_INFO[q.band].name : "missed"))
      .join(", ");
  }

  private stat(label: string, value: string, highlight = false): HTMLElement {
    return h(
      "div",
      { class: `stat${highlight ? " stat--rare" : ""}` },
      h("dt", { text: label }),
      h("dd", { text: value }),
    );
  }

  private standingLine(results: Results): string {
    const { rank, players, better_than_percent: better } = results.standing;
    if (players <= 1) return "You're the first to finish today.";
    const place = `${formatOrdinal(rank)} of ${formatPoints(players)} players today`;
    return better !== null && better > 0 ? `${place} · ahead of ${better}%` : place;
  }

  /** You against today's average score, as two bars on one scale. */
  private scoreCompare(results: Results): HTMLElement | null {
    const { players, average_score: average } = results.standing;
    if (players <= 1) return null;
    const max = Math.max(results.total_score, average, 1);
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
      bar("You", results.total_score, true),
      bar("Average", average, false),
    );
  }

  /** Everyone's final scores today as a smoothed curve, with you and the average marked. */
  private scoreCurve(results: Results): HTMLElement {
    const { distribution, players, average_score: average } = results.standing;
    const max = results.max_score;
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
    const marker = (cls: string, score: number, label: string) => {
      const at = scorePercent(score, max);
      const m = h("span", { class: `curve-marker ${cls}` }, h("span", { class: "curve-marker-label", text: label }));
      m.style.left = `${at}%`;
      if (at < 15) m.dataset.edge = "start";
      else if (at > 85) m.dataset.edge = "end";
      return m;
    };
    if (players > 1) chart.append(marker("curve-marker--avg", average, `Average ${formatPoints(average)}`));
    chart.append(marker("curve-marker--you", results.total_score, `You ${formatPoints(results.total_score)}`));

    const scale = h("p", { class: "curve-scale", "aria-hidden": "true" });
    for (const v of [0, max / 4, max / 2, (3 * max) / 4, max]) scale.append(h("span", { text: formatPoints(v) }));

    section.append(
      h("p", {
        class: "sr-only",
        text: `Your ${formatPoints(results.total_score)} points against today's average of ${formatPoints(average)}.`,
      }),
      chart,
      scale,
      h("p", {
        class: "speed-line",
        text:
          players > 1
            ? `${formatPoints(players)} players have finished today. The curve fills in as more people play.`
            : "You're the first to finish today. The curve fills in as more people play.",
      }),
    );
    return section;
  }

  /** Your average answer time on the animal speed bands, with today's average beside it. */
  private speedCompare(results: Results, mine: number | null): HTMLElement {
    const section = h("section", { class: "speed", "aria-labelledby": "speed-title" });
    section.append(h("h2", { class: "section-title", id: "speed-title", text: "Your speed" }));
    if (mine === null) {
      section.append(h("p", { class: "speed-line", text: "No correct answers today, so there's no speed to show. Have another go tomorrow." }));
      return section;
    }
    const everyone = results.speed.everyone_avg_ms;
    const others = results.speed.players > 1 && everyone !== null;

    const track = h("div", { class: "speed-track", "aria-hidden": "true" });
    const bounds: Array<[Band, number, number]> = [
      ["hummingbird", 0, 500],
      ["jaguar", 500, 1200],
      ["toucan", 1200, 2500],
      ["tree_frog", 2500, 4500],
      ["sloth", 4500, 5000],
    ];
    for (const [band, from, to] of bounds) {
      const zone = h("span", { class: "speed-zone" });
      zone.style.left = `${speedTrackPercent(from)}%`;
      zone.style.width = `${speedTrackPercent(to) - speedTrackPercent(from)}%`;
      zone.style.background = `var(--band-${band})`;
      track.append(zone);
    }
    const marker = (cls: string, ms: number, label: string) => {
      const m = h("span", { class: `speed-marker ${cls}` }, h("span", { class: "speed-marker-label", text: label }));
      const at = speedTrackPercent(ms);
      m.style.left = `${at}%`;
      // Near either end the label hangs inwards, so it never runs off the screen.
      if (at < 18) m.dataset.edge = "start";
      else if (at > 82) m.dataset.edge = "end";
      return m;
    };
    track.append(marker("speed-marker--you", mine, `You ${formatSeconds(mine)}`));
    if (others && everyone !== null) track.append(marker("speed-marker--avg", everyone, `Average ${formatSeconds(everyone)}`));

    section.append(
      h(
        "p",
        { class: "speed-big" },
        h("strong", { text: formatSeconds(mine) }),
        h("span", { text: "average answer" }),
      ),
      track,
      h(
        "p",
        { class: "speed-scale", "aria-hidden": "true" },
        h("span", { text: "0 s" }),
        h("span", { text: "5 s+" }),
      ),
      h("p", { class: "speed-line", text: this.speedLine(results) }),
    );
    return section;
  }

  private speedLine(results: Results): string {
    const { faster_than_percent: faster, players } = results.speed;
    if (results.avg_correct_elapsed_ms === null) {
      return "No correct answers today, so there's no speed to compare. Have another go tomorrow.";
    }
    if (faster === null || players <= 1) {
      return "Check back later to see how your speed compares with everyone else.";
    }
    const everyone = results.speed.everyone_avg_ms;
    if (faster === 0) {
      // Nobody was slower: either a dead heat with the field, or everyone was quicker.
      const level = everyone !== null && Math.abs(everyone - results.avg_correct_elapsed_ms) < 100;
      return level
        ? "Right on today's average speed. A few tenths quicker tomorrow takes you clear."
        : "Everyone else was quicker on average today. Tomorrow's another chance.";
    }
    const gap = everyone !== null && results.avg_correct_elapsed_ms !== null ? everyone - results.avg_correct_elapsed_ms : 0;
    const by = gap >= 100 ? ` You beat today's average by ${formatSeconds(gap)}.` : "";
    return `Faster than ${faster}% of today's players.${by}`;
  }

  private async share(results: Results, status: HTMLElement): Promise<void> {
    const text = buildShareText({
      number: results.number,
      totalScore: results.total_score,
      totalQuestions: results.questions.length,
      answers: results.questions.map((q) => ({
        band: q.band,
        correct: q.outcome === "correct",
        elapsedMs: q.elapsed_ms,
      })),
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
}
