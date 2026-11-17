# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed by the owner, as specified in CLAUDE.md: Vite + TypeScript with plain Canvas 2D on the
frontend (Vitest), and Python 3.12 + FastAPI with SQLAlchemy/Alembic on the backend (pytest).
SQLite for local development, Postgres in production. Daily content is YAML under `content/`.

## Users

A broad mix of players, mostly in the UK and mostly on phones. Design for casual players first,
for example someone doing a quick daily puzzle on the commute or over morning coffee. Keep enough
depth for keen players: quiz fans who like to be quick, and groups who compare results. Each
play is short (8 questions, each with a 3-second read and up to 15 seconds to answer) and
happens once a day.

## Product Purpose

Hummingbird is a daily speed quiz. Everyone gets the same 8 hard
questions each day. Most are multiple choice; some ask for a typed number or short answer.
Correct answers score points for how fast they were given, and each correct answer earns a
speed animal. The goal is the highest score of the day.

Success for v1 means **word-of-mouth spread**: the share text travels through group chats and
brings in new players.

## Positioning

A daily quiz where speed is the score, not just whether you were right. Each answer's speed
turns into a rainforest animal, from Hummingbird (fastest) through Jaguar, Toucan and Tree frog
to Sloth. The day's row of animals is the result people recognise and compare. The format
follows speed-quiz sites such as speedquizzing.com, made into a once-a-day ritual.

## Operating Context

- One play per player per day; new questions unlock at 00:00 Europe/London.
- The player presses "ready" before every question; nothing is served until they do.
- Questions are served one at a time: a 3-second read phase, then an answer phase of up to
  15 seconds.
- Points come from the speed animal (Hummingbird 1,000 for 0.5 s or less, Jaguar 700, Toucan
  450, Tree frog 250, Sloth 100). A Hummingbird is a rare achievement and is celebrated as one.
  The exact time is shown in the reveal but doesn't change points within a
  band. The running score is always visible.
- Scoring is deliberately hard (owner's words: "it should be very difficult to score
  perfectly … the average final score to be a bell curve where most people score in the
  middle and only a very few select people get 100%").
- The 3-second read phase is a deliberate "read the question" beat, so it never feels like
  lag.
- The timer is hidden. Players never see a countdown while answering; their time is a
  surprise, revealed with their speed animal after they answer.
- One go per question. A wrong answer or timeout scores 0 and reveals the correct answer.
- The results screen is centred on speed, score and comparison: today's rank, score against
  today's average, average answer time against everyone else's on the animal speed track,
  plus fastest answer, hummingbirds caught, the animal row, sharing and every answer.
- Sharing is done by pasting a Wordle-style text block (animal emojis, no questions or answers)
  into chats and social media.
- Players are anonymous (cookie UUID); there are no accounts in v1.

## Capabilities and Constraints

- The server is authoritative for correct answers, timing and scores. The client never sees a
  correct answer before that question is done, and timing is measured on the server.
- Speed bands, from fastest to slowest: Hummingbird, Jaguar, Toucan, Tree frog, Sloth. A wrong
  answer or timeout is "Missed".
- Scores are frozen at submission time.
- Question types: multiple choice (4 options), number (with optional tolerance), and short
  text (forgiving matching with aliases and small typos).
- Questions are hard (owner: "make the questions harder"), with 6 options for multiple choice; original and fact-checked; nothing is copied from other
  quizzes.
- Out of scope for v1: accounts, leaderboards, archive, multiplayer rooms, streaks and
  collectables, sound, monetisation.
- Undecided: read and answer timer lengths, points per animal and band
  boundaries, longer read times for longer questions, and how questions are produced at
  scale.

## Brand Commitments

- The name is **Hummingbird** (chosen by the owner; it replaced the working title "RapidQ"). It is also the name of the rarest speed band, so the game's namesake is the catch everyone chases. Internal identifiers (the `rq_pid` cookie, the `X-RapidQ-Player` header, package names) keep the old prefix.
- Owner's words: "make the art more complex … more in the style of krillion art form but with
  the jungle look" and "prioritise darker colours rather than basic bright colours to make it
  look more premium". That means detailed, fine-grained pixel art (Krillion's level of detail
  and mood, never its assets) of a rainforest at dusk, in dark, rich colours, with a detailed
  sprite for each speed animal. All art must be original. Binding; see CLAUDE.md for the
  palette, scaling and font rules.
- User-facing copy is in British English.

## Evidence on Hand

None yet. There is no code, art, questions, player data or testimonials. Future work must not
make up player counts, statistics, quotes or press.

## Product Principles

1. **Speed is the story, revealed as a surprise.** No visible clock while answering; the
   time and animal land together as a reveal after each answer, and are remembered
   afterwards in the share row.
2. **Hard but fair.** Questions are genuinely hard, with 6 plausible options, but every one
   has a single clear, checkable answer. A wrong answer should feel like a near miss, never a
   trick.
3. **Built to be shared.** The result (score, animal row, average time) must be quick to
   understand, worth bragging about, and spoiler-free in a group chat.
4. **Phone first and thumb-fast.** Options and inputs must be quick to hit one-handed, and
   nothing in the interface should cost the player time.
5. **Fair and tamper-proof.** Server-measured timing and frozen scores, so results are worth
   comparing.

## Accessibility & Inclusion

- Speed bands are shown by animal name as well as colour and sprite, and reveals are
  announced to screen readers.
- Respect `prefers-reduced-motion` by showing the animal still instead of running it.
- Tap targets are at least 44 px, and inputs must never be hidden by the on-screen keyboard.
