# CLAUDE.md — Hummingbird

A daily speed quiz website. Each day everyone gets the same **8 hard questions**.
Most are multiple choice; some ask you to type a number or a short answer. Every correct answer
earns a **speed animal** based on how fast it was given, from a hummingbird (lightning fast)
down to a sloth (got there in the end), and **the animal decides the points**. The time is
hidden while you answer and revealed as a surprise afterwards. The goal is the highest score of
the day.

The game is inspired by the format of speed-quiz sites such as speedquizzing.com (fast,
quick-fire questions, points for speed). It must not copy their questions, branding or
UI. The art is detailed, fine-grained pixel art of a rainforest at dusk, in dark, rich colours.

---

## Working rules for Claude

- **Every change must be complete and must not break existing behaviour.** Don't leave stubs,
  TODOs in place of logic, or half-wired features. Run the full test suite and the type
  checker before calling a task done. If something can't be finished, say so and leave the
  codebase working.
- Scoring, speed bands and answer checking are the core of the game. Any change to `scoring`
  or `checking` needs updated unit tests in the same change.
- The server is authoritative for correct answers, timing and scores. Never send a correct
  answer to the client before that question has been answered or has timed out, and never
  trust client-reported times.
- Use **original art only**. Do not copy or trace sprites, tiles, fonts or UI from any existing
  game or quiz site (including Krillion, which is a reference for the *level of detail and
  mood*, not a source of assets).
- Keep the visual style consistent with the palette and art rules below.
- Use British English in user-facing copy (the game is UK-based; the daily reset follows UK
  time).
- Questions must be original and factually checked. Don't copy question sets from other
  quizzes.

---

## Core game loop

1. The player opens the site. If they haven't played today, they see the rainforest scene,
   a short explanation and an **"I'm ready — question 1"** button.
2. **The player says when they're ready for every question.** Nothing is served until they
   press the ready button. After each reveal, the button reads "Ready for question N".
3. Each question then has two phases:
   - **Read** (3 s): the question text is shown on its own, with a deliberate "Read the
     question" beat: three pips light in turn (one per second, no numbers) while the answer
     slots stay sealed, then all the answers open together. It must feel intentional, never
     like the site is lagging.
   - **Answer** (up to 15 s): the options or input unlock and the server's clock starts.
4. **The timer is hidden.** The player never sees a countdown, timer bar or running clock
   while answering. How long they took is a surprise, revealed only after they answer,
   together with their speed animal and points. The 15 s limit still exists on the server;
   if it passes, the question ends with an "out of time" reveal.
5. The player answers **once**:
   - **Multiple choice**: tap one of 6 options. The tap is the answer.
   - **Number**: type a number and submit.
   - **Text**: type a short answer and submit.
   - **Correct**: the time taken, speed animal and points are revealed together, and the
     animal moves through the scene.
   - **Wrong**: scores 0. The time taken and the correct answer are revealed.
   - **Timeout**: scores 0, and the correct answer is revealed.
6. The running score is always shown.
7. After question 8, the results screen leads with speed, score and comparison: the total
   score with today's rank ("2nd of 5 players today"), a bar against today's average score,
   the player's average answer time on the animal speed track beside today's average, then
   correct count, fastest answer and hummingbirds caught, the row of animals, a share button
   and an expandable list of every answer (with what % of players got each one right).
8. One play per day per player. The new questions unlock at **00:00 Europe/London**.

---

## Scoring

Points come from the **speed animal**. Wrong answers and timeouts score 0.

### Speed animals (the speed bands)

| Band | Animal       | Answer time   | Points | Share emoji |
|------|--------------|---------------|--------|-------------|
| 1    | Hummingbird  | ≤ 0.5 s       | 1,000  | 🐦          |
| 2    | Jaguar       | 0.5 – 1.2 s   | 700    | 🐆          |
| 3    | Toucan       | 1.2 – 2.5 s   | 450    | 🦜          |
| 4    | Tree frog    | 2.5 – 4.5 s   | 250    | 🐸          |
| 5    | Sloth        | > 4.5 s       | 100    | 🦥          |
| —    | Missed       | wrong/timeout | 0      | ❌          |

- `t` is the server-measured answer time (see "Timing").
- **The scoring is deliberately hard.** A perfect day (all eight correct, all Hummingbirds) should
  be very rare, and daily totals should form a bell curve with most players in the middle.
  `scripts/simulate_scores.py` estimates the spread under an assumed player model (currently a
  mean of about 1,700 with bands of 0.5 / 1.2 / 2.5 / 4.5 s and no perfect day among 20,000 simulated players; the model assumes slower answers than the owner's playtests, so real scores will run higher); re-tune from real answer times once players
  exist.
- **Typing allowance**: typed answers are banded on their time minus 1.5 s (numbers) or 2.5 s
  (text), because typing takes longer than tapping. The real time is what's stored and shown.
- Band boundaries belong to the faster band (exactly 0.5 s is a Hummingbird).
- Maximum per question: 1,000. Maximum per day: **8,000**.
- **A Hummingbird is an achievement.** Its reveal is celebrated beyond the other animals: a
  gold-and-jade card, a flashing name, a "rarest catch" line, a shimmering trail, a bigger
  three-ring burst, every firefly flaring at once and a short vibration on phones. The results
  screen counts the hummingbirds caught. Keep it rarer and louder than every other band.
- **Latency matters at 0.5 s.** The 300 ms latency allowance covers a typical connection, but a
  slow mobile connection eats much of the Hummingbird window. Watch real answer times by
  connection before tightening anything further.
- The exact time is still recorded and shown to the player, but it never changes the points
  within a band.
- Store the band and points on each submission, so the balance can be re-tuned later.
- A score is **frozen at submission time** and must never change afterwards.
- Unicode has no hummingbird, jaguar or toucan emoji, so the share text uses the closest ones
  (bird, leopard, parrot). The game itself shows the real animals.

All scoring and band logic lives in one pure module (`backend/app/scoring.py`) with no I/O, so
it's easy to test.

---

## Question types and answer checking

Answer checking happens on the server in `backend/app/checking.py`.

- **Multiple choice**: 6 options, exactly one correct. The client sends the option ID.
  Option order is shuffled per question (the same order for everyone that day, so the
  results screen stays comparable).
- **Number**: the answer is a number, with an optional tolerance (for example ±1 for "how
  many…" questions, or 0 for exact). Accept common formats: `1,000`, `1000`, `1 000`, and
  decimals with a point. Reject anything that doesn't parse as a number.
- **Text**: short answers (a name, a word). Check in this order:
  1. **Normalise**: lowercase, Unicode NFKD with accents stripped, `&` → `and`, punctuation
     removed, whitespace collapsed, leading "the/a/an" stripped.
  2. **Exact match** on the canonical form or any alias.
  3. **Fuzzy match** (Damerau-Levenshtein) on canonical forms and aliases: length ≤ 4, no
     fuzzing; 5–8 characters, distance ≤ 1; ≥ 9 characters, distance ≤ 2.
  4. Otherwise wrong.
- Empty or punctuation-only input for a number or text question is not counted as the
  player's one go. Show "Type an answer" and keep the question live.
- Unit tests must cover accents, typos, aliases, number formats and tolerance, and empty or
  punctuation-only input.

---

## Timing and anti-cheat

- The server records `served_at` when it sends a question and `answer_open_at`
  (`served_at` + 3 s read phase). `received_at` is recorded when the answer arrives.
  `elapsed = received_at − answer_open_at − latency_allowance` (allowance: 300 ms, floored at
  0, capped at `T`).
- The client receives the options with the question but must not show them as usable or
  allow input until the answer phase opens. An answer that arrives before `answer_open_at` is
  rejected as invalid (not counted as the player's go).
- There is no visible timer on the client. If an answer arrives more than `T + 1 s` after
  `answer_open_at`, it's a timeout. The client asks the server to resolve a timeout once the
  limit has passed, and the server only does so if the limit really has passed.
- Questions are served one at a time, only after the player presses ready. The client never
  sees a question before it is served, and never sees a correct answer until that question
  is answered or timed out.
- If the player reloads mid-question, the same question comes back with its original
  `served_at`; if its limit has passed, it resolves as a timeout.
- Each player gets one play per day. Players are identified by an anonymous ID (a random UUID
  in an HttpOnly cookie, plus a localStorage backup sent as a header). Optional accounts are a
  later feature.
- Rate-limit the play endpoints per player.

---

## Visual design

- **Mood**: a rainforest at dusk. Dark, rich and premium: deep greens, near-black canopy,
  mist, warm gold and soft jade light. Avoid flat, bright primary colours.
- **Rendering**: the scene is drawn on an HTML `<canvas>` as **fine-grained pixel art**: one
  art pixel is always 2 CSS pixels (`frontend/src/scene/sizing.ts`); bigger stages get more
  forest, not bigger pixels. The canvas is sized so that scaling is always a whole number. `image-rendering: pixelated` and `imageSmoothingEnabled = false`. No half-pixel
  scaling and no anti-aliased edges inside the scene.
- **Detail**: layered depth — sky gradient with dithered bands, distant canopy silhouettes,
  hanging vines, mist bands, detailed foreground leaves and ferns, fireflies. The scene should
  read as illustrated, not as chunky blocks.
- **Speed animals**: each band has a detailed pixel sprite (hummingbird, jaguar, toucan, tree
  frog, sloth). When an answer is revealed, the animal moves through the scene in its own way:
  the hummingbird darts, the jaguar sprints, the toucan flies, the frog hops, and the sloth
  creeps. Keep each run short (about 0.8–1.4 s).
- **UI**: dark panels with thin glowing jade/gold outlines, letterspaced pixel labels, and a
  readable pixel-style face for questions (Pixelify Sans and Silkscreen, both OFL,
  self-hosted). **No countdown, timer bar or clock is shown while a question is live.**
  Answer options are large tap targets.
- **Palette**: one fixed palette defined in `frontend/src/art/palette.ts`. All scene art and
  sprites use only these colours; the UI uses the same tokens.
- **Mobile first**: most players will be on phones. Make sure inputs aren't hidden by the
  on-screen keyboard, and keep tap targets at least 44 px.
- **Accessibility**: speed bands are shown by animal name as well as colour and sprite.
  Reveals are announced to screen readers. Respect `prefers-reduced-motion` (no animal runs or
  fireflies; the animal is shown still).

### Share text

The share text is a Wordle-style result with no questions or answers in it, for example:

```
Hummingbird #42 — 6,400 pts
🐦🐆🦜❌🐸🐆🐦🦥
avg 4.3 s · 7/8 correct
```

---

## Tech stack

- **Frontend**: Vite + TypeScript, plain Canvas 2D (no game engine). Vitest for tests.
- **Backend**: Python 3.12 + FastAPI, with SQLAlchemy and Alembic for migrations. pytest for
  tests.
- **Database**: SQLite for local development, Postgres in production (`DATABASE_URL`).
- **Content**: daily question files in YAML under `content/`, validated and loaded by a script.

### Layout

```
frontend/
  src/
    art/          # palette, raster helpers, animal sprites
    scene/        # canvas renderer, rainforest layers, animal animations
    ui/           # screens, formatting, share text
    api.ts        # typed client for the backend
backend/
  app/
    main.py       # FastAPI routes
    scoring.py    # pure scoring and speed-band functions
    checking.py   # answer checking for choice, number and text questions
    content.py    # content file parsing and validation
    models.py     # SQLAlchemy models
    db.py         # engine and sessions
    daily.py      # day boundaries (Europe/London)
  migrations/     # Alembic
  tests/
content/
  2026-11-17.yaml # one file per day
scripts/
  validate_content.py
  load_content.py
```

### Data model (minimum)

- `players(id, created_at, display_name?)`
- `days(date PK, number)` — `number` is the quiz number shown in the share text.
- `questions(id, date, slot 1–8, type choice|number|text, text, category)`
- `choice_options(id, question_id, position, text, is_correct)`
- `number_answers(question_id PK, value, tolerance)`
- `text_answers(id, question_id, canonical)` and `text_aliases(text_answer_id,
  alias_normalised)`
- `plays(id, player_id, date, started_at, finished_at?, total_score)` — unique on
  `(player_id, date)`.
- `submissions(id, play_id, slot, served_at, answer_open_at, received_at?, raw_input?,
  choice_option_id?, outcome?, correct, elapsed_ms?, speed_band?, points)` — unique on
  `(play_id, slot)`. A row is created when the question is served and resolved when it is
  answered or times out.

### Content file format

```yaml
date: 2026-11-17
questions:
  - slot: 1
    type: choice
    category: geography
    text: "Which river flows through Vienna?"
    options:
      - { text: "Danube", correct: true }
      - { text: "Rhine" }
      - { text: "Elbe" }
      - { text: "Vltava" }
  - slot: 2
    type: number
    category: science
    text: "How many bones are in the adult human body?"
    answer: 206
    tolerance: 0
  - slot: 3
    type: text
    category: music
    text: "Which band released the album 'OK Computer'?"
    answers:
      - { canonical: "Radiohead", aliases: ["radio head"] }
```

`validate_content.py` must fail if a day doesn't have exactly 8 questions with slots 1–8, if
fewer than 5 are multiple choice, if a choice question doesn't have exactly 6 options with
exactly one correct, if a number question has no numeric answer or a negative tolerance, if a
text question has no canonical answer, if there are duplicate normalised forms within a text
question, or if a type is unknown. Quiz numbers count from the launch date (2026-11-17 is #1).

---

## Commands

```bash
# backend (from backend/)
python -m venv .venv && .venv/Scripts/activate   # Windows; use .venv/bin/activate elsewhere
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
pytest
ruff check . && mypy app

# content (from the repo root, with the backend venv active)
python scripts/validate_content.py content/
python scripts/load_content.py content/

# frontend (from frontend/)
npm install
npm run dev          # proxies /api to http://127.0.0.1:8000
npm run test
npm run typecheck && npm run lint
npm run build        # writes frontend/dist; the backend serves it at / when it exists
```

In Claude Code, `.claude/launch.json` defines `backend` and `frontend` servers for previewing.

---

## Out of scope for v1 (don't build unless asked)

- Accounts and login, friends, and global leaderboards.
- Archive or replay of past days.
- Live head-to-head or multiplayer rooms.
- Streaks and collectables (for example collecting animals over time) — nice idea, but later.
- Sound effects and music.
- Monetisation (the plan is in `docs/money-plan.md`; build none of it until asked).

## Open decisions

- Read-phase length (3 s), answer limit (15 s), points per animal, band boundaries and the
  typing allowances. Tune these from real answer times after launch.
- Whether longer questions get a longer read phase.
- How questions are produced at scale (hand-written, assisted generation plus review, or a
  mix) and how difficulty is checked to stay hard but fair.
- How many question types beyond choice, number and text (for example ordering or
  true/false).
