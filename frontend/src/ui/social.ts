/**
 * The progress and friends sheets: streaks, the field guide, the weekly league, private
 * leagues, your profile (name and device sync), and the challenge banner and head-to-head.
 * Each builder returns an element for the App's sheet; actions call the API and then ask the
 * sheet to redraw itself.
 */
import {
  ApiError,
  api,
  rememberPlayer,
  type Challenge,
  type League,
  type Me,
  type Week,
  type WeekGame,
} from "../api";
import { BANDS, type Band } from "../art/sprites";
import { animalIcon, animalSilhouette, goldenHummingbird, h, icon, targetCanvas } from "./dom";
import { BAND_INFO, formatPoints } from "./format";

export type Redraw = () => Promise<void>;

/** A small row of animals (or crosses for misses). */
export function bandRow(bands: Array<Band | null>, className = "mini-row"): HTMLElement {
  return h(
    "span",
    {
      class: className,
      role: "img",
      "aria-label": bands.map((b) => (b ? BAND_INFO[b].name : "missed")).join(", "),
    },
    ...bands.map((b) => (b ? animalIcon(b, 1) : icon("cross", "var(--ruby-text)"))),
  );
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

/** A one-field form with a button; `submit` returns true when it worked. */
function inlineForm(
  label: string,
  placeholder: string,
  buttonText: string,
  submit: (value: string, status: HTMLElement) => Promise<boolean>,
  value = "",
  maxLength = 30,
): HTMLElement {
  const id = `f-${Math.random().toString(36).slice(2, 8)}`;
  const input = h("input", {
    class: "sheet-input",
    id,
    type: "text",
    placeholder,
    maxlength: maxLength,
    autocomplete: "off",
    spellcheck: "false",
  });
  input.value = value;
  const button = h("button", { class: "sheet-button", type: "submit", text: buttonText });
  const status = h("p", { class: "sheet-status", role: "status" });
  const form = h(
    "form",
    { class: "sheet-form" },
    h("label", { class: "sheet-label", for: id, text: label }),
    h("div", { class: "sheet-row" }, input, button),
    status,
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      status.textContent = "Type something first.";
      return;
    }
    button.disabled = true;
    status.textContent = "";
    void submit(text, status).finally(() => {
      button.disabled = false;
    });
  });
  return form;
}

async function copy(text: string, status: HTMLElement, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = done;
  } catch {
    status.textContent = `Copy this: ${text}`;
  }
}

// ---------------------------------------------------------------- streak

export function streakSheet(me: Me): HTMLElement {
  const s = me.streak;
  const tile = (label: string, value: number, best: number, rare = false) =>
    h(
      "div",
      { class: `streak-tile${rare ? " streak-tile--rare" : ""}` },
      h("span", { class: "streak-label", text: label }),
      h("strong", { class: "streak-value", text: `${value}` }),
      h("span", { class: "streak-unit", text: value === 1 ? "day" : "days" }),
      h("span", { class: "streak-best", text: `Best: ${best}` }),
    );
  return h(
    "div",
    { class: "sheet-content" },
    h(
      "div",
      { class: "streak-tiles" },
      tile("Days in a row", s.current, s.best),
      tile("Hummingbird days in a row", s.hummingbird_current, s.hummingbird_best, true),
    ),
    h("p", {
      class: "sheet-note",
      text: "Play every day to keep your streak going. It stays alive until a whole day passes without a quiz. A Hummingbird day is one where you catch at least one Hummingbird.",
    }),
  );
}

// ---------------------------------------------------------------- field guide

export function guideSheet(me: Me): HTMLElement {
  const g = me.guide;
  const found =
    BANDS.filter((b) => (g.counts[b] ?? 0) > 0).length + (g.golden > 0 ? 1 : 0) + (g.bullseyes > 0 ? 1 : 0);
  const cells = BANDS.map((band) => {
    const n = g.counts[band] ?? 0;
    return h(
      "li",
      { class: `guide-cell${n ? "" : " guide-cell--missing"}` },
      h("span", { class: "guide-art" }, n ? animalIcon(band, 2) : animalSilhouette(band, 2)),
      h("span", { class: "guide-name", text: n ? BAND_INFO[band].name : "Not found yet" }),
      h("span", { class: "guide-count", text: n ? `Caught ${formatPoints(n)}×` : BAND_INFO[band].range }),
    );
  });
  cells.push(
    h(
      "li",
      { class: `guide-cell guide-cell--bullseye${g.bullseyes ? "" : " guide-cell--missing"}` },
      h("span", { class: "guide-art" }, targetCanvas(2)),
      h("span", { class: "guide-name", text: g.bullseyes ? "Bullseyes" : "No Bullseye yet" }),
      h("span", {
        class: "guide-count",
        text: g.bullseyes ? `Hit ${formatPoints(g.bullseyes)}×` : "How Close: within 1%",
      }),
    ),
    h(
      "li",
      { class: `guide-cell guide-cell--golden${g.golden ? "" : " guide-cell--missing"}` },
      h("span", { class: "guide-art" }, g.golden ? goldenHummingbird(2) : animalSilhouette("hummingbird", 2)),
      h("span", { class: "guide-name", text: g.golden ? "Golden hummingbird" : "A rare find" }),
      h("span", {
        class: "guide-count",
        text: g.golden ? `Caught ${formatPoints(g.golden)}×` : "Answer in 0.3 s or less",
      }),
    ),
  );
  return h(
    "div",
    { class: "sheet-content" },
    h("p", { class: "sheet-lede", text: `${found} of 7 found` }),
    h("ul", { class: "guide-grid" }, ...cells),
    h("p", {
      class: "sheet-note",
      text: g.perfect_days
        ? `Perfect days (all eight right): ${g.perfect_days}.`
        : "A perfect day is all eight answers right. You haven't had one yet.",
    }),
  );
}

// ---------------------------------------------------------------- weekly league

const WEEK_GAMES: Array<[WeekGame, string]> = [
  ["speed", "Speed"],
  ["close", "How Close"],
  ["combined", "Combined"],
];

/** The weekly table, with tabs to switch between the Speed quiz, How Close and both combined. */
export function weekSheet(week: Week, onGame?: (game: WeekGame) => void): HTMLElement {
  const row = (r: Week["top"][number]) =>
    h(
      "tr",
      { class: r.you ? "is-you" : "" },
      h("td", { class: "wk-rank", text: `${r.rank}` }),
      h("td", { class: "wk-name", text: r.you ? `${r.name} (you)` : r.name }),
      h("td", { class: "wk-days", text: `${r.days} ${r.days === 1 ? "day" : "days"}` }),
      h("td", { class: "wk-total", text: formatPoints(r.total) }),
    );
  const body = h("tbody", {}, ...week.top.map(row));
  if (week.you && !week.top.some((r) => r.you)) {
    body.append(h("tr", { class: "wk-gap" }, h("td", { colspan: 4, text: "…" })), row(week.you));
  }
  const monday = new Date(`${week.week_start}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const tabs = h("div", { class: "week-tabs", role: "tablist", "aria-label": "Which game" });
  for (const [game, label] of WEEK_GAMES) {
    const tab = h("button", {
      class: `week-tab${game === week.game ? " is-on" : ""}`,
      type: "button",
      role: "tab",
      "aria-selected": game === week.game ? "true" : "false",
      text: label,
    });
    tab.addEventListener("click", () => {
      if (game !== week.game) onGame?.(game);
    });
    tabs.append(tab);
  }
  const how =
    week.game === "combined"
      ? "Combined is your Speed score divided by 8, plus your How Close score, for each day."
      : null;
  return h(
    "div",
    { class: "sheet-content" },
    onGame ? tabs : null,
    h("p", { class: "sheet-lede", text: `Week starting Monday ${monday}` }),
    how ? h("p", { class: "sheet-note", text: how }) : null,
    week.top.length
      ? h("table", { class: "week-table" }, body)
      : h("p", { class: "sheet-note", text: "Nobody has finished a quiz this week yet. Be the first." }),
    h("p", {
      class: "sheet-note",
      text: `Your best ${week.best_days} days of the week count, so missing a day or two is fine. A new week starts every Monday.`,
    }),
  );
}

// ---------------------------------------------------------------- profile and sync

export function profileSheet(me: Me, redraw: Redraw): HTMLElement {
  const name = inlineForm(
    "Your name",
    "How friends will see you",
    "Save",
    async (value, status) => {
      try {
        await api.setName(value);
        await redraw();
        return true;
      } catch (error) {
        status.textContent = errorText(error);
        return false;
      }
    },
    me.display_name ?? "",
    20,
  );

  const codeOut = h("div", { class: "sync-code-box" });
  const show = h("button", { class: "sheet-button sheet-button--quiet", type: "button", text: "Show my code" });
  show.addEventListener("click", () => {
    show.disabled = true;
    void api
      .syncCode()
      .then(({ code }) => {
        const status = h("p", { class: "sheet-status", role: "status" });
        const copyButton = h("button", { class: "sheet-button sheet-button--quiet", type: "button", text: "Copy" });
        copyButton.addEventListener("click", () => void copy(code, status, "Copied."));
        codeOut.replaceChildren(
          h("p", { class: "sync-code", text: code }),
          copyButton,
          status,
          h("p", {
            class: "sheet-note",
            text: "Keep this private: anyone with it can play as you. Enter it on another device to carry on there.",
          }),
        );
        show.remove();
      })
      .catch((error: unknown) => {
        codeOut.replaceChildren(h("p", { class: "sheet-status", text: errorText(error) }));
        show.disabled = false;
      });
  });

  const use = inlineForm(
    "Have a code from another device?",
    "XXXXX-XXXXX",
    "Switch",
    async (value, status) => {
      try {
        const result = await api.useSyncCode(value);
        rememberPlayer(result.player_id);
        status.textContent = "Done. Loading your games…";
        window.location.reload();
        return true;
      } catch (error) {
        status.textContent = errorText(error);
        return false;
      }
    },
    "",
    16,
  );

  return h(
    "div",
    { class: "sheet-content" },
    name,
    h("h3", { class: "section-title", text: "Play on another device" }),
    h("p", {
      class: "sheet-note",
      text: "There's no password to remember. Your games live on this device; your code lets you carry them to another one.",
    }),
    show,
    codeOut,
    use,
    h("p", {
      class: "sheet-note",
      text: "Switching makes this device play as the player who owns the code.",
    }),
  );
}

// ---------------------------------------------------------------- private leagues

function leagueCard(league: League, redraw: Redraw): HTMLElement {
  const status = h("p", { class: "sheet-status", role: "status" });
  const invite = h("button", { class: "sheet-button sheet-button--quiet", type: "button", text: "Copy invite link" });
  invite.addEventListener("click", () => {
    const link = `${window.location.origin}/?league=${league.code}`;
    void copy(`Join my Hummingbird league "${league.name}": ${link}`, status, "Invite copied. Send it to your friends.");
  });
  const leave = h("button", { class: "sheet-link", type: "button", text: "Leave league" });
  leave.addEventListener("click", () => {
    if (!window.confirm(`Leave "${league.name}"?`)) return;
    void api
      .leaveLeague(league.id)
      .then(redraw)
      .catch((error: unknown) => {
        status.textContent = errorText(error);
      });
  });
  const cell = (value: number | null) => (value === null ? "–" : formatPoints(value));
  const rows = league.members.map((m, i) =>
    h(
      "tr",
      { class: m.you ? "is-you" : "" },
      h("td", { class: "wk-rank", text: m.today_total === null ? "–" : `${i + 1}` }),
      h(
        "td",
        { class: "wk-name" },
        h("span", { text: m.you ? `${m.name} (you)` : m.name }),
        m.today_bands ? bandRow(m.today_bands) : null,
        h("span", { class: "wk-week", text: `Week ${formatPoints(m.week)}` }),
      ),
      h("td", { class: "wk-days", text: cell(m.today) }),
      h("td", { class: "wk-days", text: cell(m.today_close) }),
      h("td", { class: "wk-total", text: cell(m.today_total) }),
    ),
  );
  return h(
    "section",
    { class: "league-card" },
    h(
      "div",
      { class: "league-head" },
      h("h3", { class: "league-name", text: league.name }),
      h("span", { class: "league-code", text: league.code }),
    ),
    h(
      "table",
      { class: "week-table" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", { text: "" }),
          h("th", { text: "Player" }),
          h("th", { class: "wk-num", text: "Speed" }),
          h("th", { class: "wk-num", text: "Close" }),
          h("th", { class: "wk-num", text: "Total" }),
        ),
      ),
      h("tbody", {}, ...rows),
    ),
    h("p", {
      class: "sheet-note",
      text: "Total is today's Speed score divided by 8 plus How Close. Week adds your best five daily totals.",
    }),
    h("div", { class: "league-actions" }, invite, leave),
    status,
  );
}

export function leaguesSheet(
  leagues: League[],
  me: Me,
  redraw: Redraw,
  prefillCode = "",
): HTMLElement {
  const content = h("div", { class: "sheet-content" });
  if (!me.display_name) {
    content.append(
      h("p", { class: "sheet-note", text: "Choose a name first, so your friends know it's you." }),
      inlineForm(
        "Your name",
        "How friends will see you",
        "Save",
        async (value, status) => {
          try {
            await api.setName(value);
            await redraw();
            return true;
          } catch (error) {
            status.textContent = errorText(error);
            return false;
          }
        },
        "",
        20,
      ),
    );
    return content;
  }
  // An invite code for a league you're already in has done its job.
  const prefill = leagues.some((l) => l.code === prefillCode.toUpperCase()) ? "" : prefillCode;
  for (const league of leagues) content.append(leagueCard(league, redraw));
  if (!leagues.length) {
    content.append(
      h("p", {
        class: "sheet-lede",
        text: "Play against your friends, family or office. Everyone answers the same eight questions each day.",
      }),
    );
  }
  const act = (fn: (value: string) => Promise<League>) => async (value: string, status: HTMLElement) => {
    try {
      await fn(value);
      await redraw();
      return true;
    } catch (error) {
      status.textContent = errorText(error);
      return false;
    }
  };
  content.append(
    inlineForm("Join a league", "Code from a friend", "Join", act(api.joinLeague), prefill, 12),
    inlineForm("Start a league", "Name it, e.g. The Office", "Create", act(api.createLeague)),
  );
  return content;
}

// ---------------------------------------------------------------- challenges

export function challengeBanner(c: Challenge): HTMLElement {
  if (!c.is_today) {
    return h(
      "div",
      { class: "challenge-banner challenge-banner--old" },
      h("p", {
        text: `${c.name}'s challenge was for quiz #${c.number}. Today's quiz is a fresh set of questions, so have a go and send them yours.`,
      }),
    );
  }
  return h(
    "div",
    { class: "challenge-banner" },
    h("p", { class: "challenge-title" }, `${c.name} challenged you: beat `, h("strong", { text: formatPoints(c.total_score) })),
    bandRow(c.bands),
  );
}

export function headToHead(c: Challenge, myScore: number, myBands: Array<Band | null>): HTMLElement {
  const verdict =
    myScore > c.total_score ? "You win!" : myScore === c.total_score ? "A dead heat." : `${c.name} wins this one.`;
  const side = (name: string, score: number, bands: Array<Band | null>, win: boolean) =>
    h(
      "div",
      { class: `h2h-side${win ? " is-winner" : ""}` },
      h("span", { class: "h2h-name", text: name }),
      h("strong", { class: "h2h-score", text: formatPoints(score) }),
      bandRow(bands),
    );
  return h(
    "section",
    { class: "h2h", "aria-label": "Head to head" },
    h("p", { class: "h2h-verdict", text: verdict }),
    h(
      "div",
      { class: "h2h-sides" },
      side("You", myScore, myBands, myScore > c.total_score),
      side(c.name, c.total_score, c.bands, c.total_score > myScore),
    ),
  );
}
