---
name: Hummingbird
description: A daily speed quiz staged in a pixel-art rainforest at dusk, where each answer's time becomes an animal and the Hummingbird is the catch everyone chases.
colors:
  night: "#06110d"
  sky1: "#0a1913"
  sky2: "#0b1b16"
  sky3: "#10261e"
  sky4: "#183427"
  mid0: "#163828"
  mid1: "#1d4a33"
  mid2: "#2a6243"
  near0: "#08130e"
  near1: "#0f2219"
  fill: "rgb(16 38 30 / 0.72)"
  fill-hover: "rgb(29 74 51 / 0.85)"
  hairline: "rgb(29 74 51 / 0.45)"
  gold: "#e8b04a"
  gold-hi: "#f6dc96"
  jade: "#3fd0b0"
  ivory: "#eef0e2"
  sage: "#9fb5a6"
  ruby: "#b8324a"
  ruby-text: "#f08a9b"
  miss-dim: "#5a2430"
  placeholder: "#7f978a"
  band-hummingbird: "#3fd0b0"
  band-jaguar: "#e8b04a"
  band-toucan: "#e0894a"
  band-tree-frog: "#7cc46a"
  band-sloth: "#c9b089"
typography:
  hero:
    fontFamily: "RQ Digits, Pixelify Sans, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 9vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.01em"
    fontFeature: "\"liga\" 0, \"clig\" 0"
  reveal-time:
    fontFamily: "RQ Digits, Pixelify Sans, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 19vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontFeature: "\"liga\" 0, \"clig\" 0, \"tnum\" 1"
  reveal-band:
    fontFamily: "Silkscreen, Pixelify Sans, ui-monospace, monospace"
    fontSize: "clamp(1.5rem, 7vw, 2.25rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.06em"
  display:
    fontFamily: "RQ Digits, Pixelify Sans, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(3rem, 14vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"liga\" 0, \"clig\" 0, \"tnum\" 1"
  headline:
    fontFamily: "RQ Digits, Pixelify Sans, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(1.4rem, 5.6vw, 2.4rem)"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "\"liga\" 0, \"clig\" 0"
  answer:
    fontFamily: "RQ Digits, Pixelify Sans, ui-rounded, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1.2
    fontFeature: "\"liga\" 0, \"clig\" 0"
  body:
    fontFamily: "RQ Digits, Pixelify Sans, ui-rounded, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"liga\" 0, \"clig\" 0"
  label:
    fontFamily: "Silkscreen, Pixelify Sans, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.08em"
rounded:
  pixel: "0px"
  soft: "14px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
  column: "760px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.near0}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hi}"
    textColor: "{colors.near0}"
  button-primary-disabled:
    backgroundColor: "{colors.mid0}"
    textColor: "{colors.sage}"
  button-quiet:
    backgroundColor: "rgb(232 176 74 / 0.12)"
    textColor: "{colors.gold-hi}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "56px"
  button-quiet-hover:
    backgroundColor: "rgb(232 176 74 / 0.2)"
  answer-tile:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ivory}"
    typography: "{typography.answer}"
    rounded: "{rounded.soft}"
    padding: "8px 12px"
    height: "64px"
  answer-tile-hover:
    backgroundColor: "{colors.fill-hover}"
  answer-tile-locked:
    backgroundColor: "rgb(16 38 30 / 0.3)"
    textColor: "transparent"
  answer-tile-correct:
    backgroundColor: "rgb(63 208 176 / 0.2)"
    textColor: "{colors.ivory}"
  answer-tile-wrong:
    backgroundColor: "rgb(184 50 74 / 0.18)"
    textColor: "{colors.ruby-text}"
  typed-input:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.soft}"
    padding: "0 16px"
    height: "56px"
  header-bar:
    backgroundColor: "transparent"
    textColor: "{colors.ivory}"
    padding: "12px 16px 8px"
  progress-step:
    backgroundColor: "{colors.mid0}"
    rounded: "{rounded.pill}"
    height: "4px"
  read-pip:
    backgroundColor: "{colors.mid0}"
    rounded: "{rounded.pill}"
    size: "12px"
  key-badge:
    backgroundColor: "rgb(6 17 13 / 0.6)"
    textColor: "{colors.sage}"
    rounded: "{rounded.pill}"
    size: "22px"
  ladder-step:
    backgroundColor: "transparent"
    rounded: "{rounded.soft}"
    padding: "8px 12px"
  howto-step:
    backgroundColor: "transparent"
    textColor: "{colors.sage}"
    typography: "{typography.body}"
  compare-track:
    backgroundColor: "{colors.mid0}"
    rounded: "{rounded.pill}"
    height: "10px"
  compare-fill-you:
    backgroundColor: "{colors.gold}"
    rounded: "{rounded.pill}"
  compare-fill-average:
    backgroundColor: "{colors.sage}"
    rounded: "{rounded.pill}"
  speed-track:
    rounded: "{rounded.pill}"
    height: "8px"
  speed-marker-you:
    backgroundColor: "{colors.ivory}"
    rounded: "{rounded.pill}"
    size: "16px"
  speed-marker-average:
    backgroundColor: "{colors.sage}"
    rounded: "{rounded.pill}"
    size: "16px"
  answers-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.ivory}"
    padding: "16px 8px"
  result-item:
    backgroundColor: "transparent"
    textColor: "{colors.ivory}"
    padding: "16px 8px"
---

# Design System: Hummingbird

## Overview

**Creative North Star: "The Dusk Clearing"**

Hummingbird is a rainforest clearing at the last light of day. The canopy is near-black green, mist hangs in bands between the trunks, a low sun glows gold behind the far trees, and fireflies drift in the foreground. The interface lives in that same air rather than in boxes laid over it: the forest runs as a full-width band across the top of the window and dissolves into the night, the top bar floats, and everything below sits in one centred column of soft tone shapes with no outlines. Gold and jade are the only light sources. Nothing is bright for its own sake. The owner asked for darker, richer colour over basic brights, then for a site that is "less boxy" with the game "in the centre", so the premium feel comes from restraint, depth, centring and open space, not saturation or framing.

The quiz is quiet while you think and theatrical when you answer. While a question is open there is no countdown, no ticking bar and no colour change: the forest breathes and the player reads. The reveal is the single loud moment of each question: the measured time counts up in large pixel numerals written straight onto the scene, the speed animal runs its own path through the forest, then its name lands in its own colour with the points. The game shares its name with the rarest speed band, so the Hummingbird is the catch everyone chases. The results screen is about speed and standing: the score, where it ranks today, how it compares with the average, and where your average answer falls on the five animal bands, before the row of animals you share.

There are two materials. The scene is fine-grained, original pixel art at a fixed 2 CSS px per art pixel, drawn from one indexed palette, crisp and square. The UI around it is soft: 14px rounded tone fills, gold pills, round pips and dots, hairline dividers at most, and no 1px boxes.

**Key Characteristics:**
- Dusk rainforest grounds: every dark is green-tinted, with green above blue.
- Gold and jade are the only light; ruby only marks a miss.
- Each speed animal owns a colour, used for its name, its reveal glow and its progress segment.
- Pixel art scales by whole numbers only (2 CSS px per art pixel); bigger stages get more forest, not bigger pixels.
- The forest is a frameless full-width band that fades into the page at top and bottom.
- One centred column (760px) holds the question, the six answers and the action.
- No visible timer while answering; time is a surprise.
- The reveal is the one loud moment, written on the scene, not in a card.
- Crisp square pixels in the scene; soft rounded tone shapes in the UI; no outlined boxes.
- Silkscreen digits for every numeral; ligatures off.

## Colors

A narrow night-green ramp carries the page and the scene, translucent green fills carry the controls, and two lights (gold and jade) plus five per-animal band colours provide every accent.

### Primary
- **Firefly Gold** (`gold`): the main light. Primary pill buttons, the running score, the results score and your "You" score bar, ladder points, how-to-play step numbers, the "Answer now!" cue, lit read pips, the GO ring on typed inputs, the low sun and fireflies in the scene, the text caret, selection and native accent colour. It is also the Jaguar's band colour.
- **Lantern Cream** (`gold-hi`): the hot core of gold. Primary button hover, quiet button text, the home quiz number and date, section titles, the Rare Catch time and line, notices and typed-answer messages, the toggle hint on hover, the brightest firefly and sun pixels.

### Secondary
- **Jade Glow** (`jade`): the cool light. Keyboard focus rings (2px outline, 3px offset), the correct-answer tint, ring and tick, share confirmation, the Rare Catch band glow, the Hummingbird ladder rung glow, the Hummingbirds stat on results when any were caught. It is also the Hummingbird's band colour.

### Tertiary
- **Throat Ruby** (`ruby`): the tint and inset ring of a wrong-choice tile; in the scene, the hummingbird's throat and frog's eye.
- **Soft Ruby** (`ruby-text`): ruby lightened for text on dark grounds. "Not quite", "Missed", "Out of time" labels, wrong-tile text and the miss cross.
- **Miss Dim** (`miss-dim`): a missed segment in the progress strip.

### Band colours
One token per speed animal, set on an element as `--band-colour` and read by the reveal band name (with a soft same-colour glow), the progress segment, the ladder name, the five zones of the results speed track (at 80% opacity) and the animal's name in the results list.
- **Hummingbird** (`band-hummingbird`): jade.
- **Jaguar** (`band-jaguar`): gold.
- **Toucan** (`band-toucan`): a warm orange.
- **Tree frog** (`band-tree-frog`): a leaf green.
- **Sloth** (`band-sloth`): a dusty fur beige.

### Neutral
- **Canopy Night** (`night`): the page base, the bottom of the body gradient, and the colour the forest fades into at its masked edges.
- **Dusk Sky** (`sky1`, `sky2`, `sky3`, `sky4`): the sky ramp of the scene. `sky1` is also the top of the body gradient.
- **Undergrowth** (`mid0`, `mid1`, `mid2`): canopy layers in the scene. In the UI, `mid0` is unlit pips, upcoming progress segments and the disabled button; `mid1` and `mid2` colour the scrollbar.
- **Foreground Silhouette** (`near0`, `near1`): foreground silhouettes in the scene; `near0` is the text colour on gold.
- **Tone Fill** (`fill`, `sky3` at 72%): the resting answer tile and typed input. **Tone Fill Hover** (`fill-hover`, `mid1` at 85%): hovered and chosen tiles.
- **Hairline** (`hairline`, `mid1` at 45%): the only line in the UI; above the "Your answers" toggle and between result items.
- **Moon Ivory** (`ivory`): primary text, the current progress segment and your "You" marker on the speed track.
- **Sage** (`sage`): secondary text, ledes, labels, key badges, ladder ranges, how-to-play bodies, toggle hints, and everything that stands for "today's average" (the Average score bar and the Average speed marker).
- **Placeholder Moss** (`placeholder`): placeholder text in typed inputs.

### Named Rules
**The Green-Over-Blue Rule.** Every dark ground has its green channel above its blue channel (`night` is #06110d, not a navy). A neutral that drifts blue or grey leaves the forest.

**The Two Lights Rule.** Gold and jade are the only emissive colours in the UI. Gold means "act / your score"; jade means "focus / correct". Ruby is never a light; it only marks a miss.

**The Animal Owns Its Colour Rule.** A band colour appears only where that animal is named or stands for a result: the reveal, the progress segment, the speed ladder, the zones of the speed track, the results list name. Never use a band colour as general decoration.

**The You-Versus-Average Rule.** Wherever the player is compared with everyone else, the player is the light and the average is sage: a gold "You" score bar against a sage "Average" bar, an ivory "You" marker against a sage "Average" marker.

**The One Palette Rule.** Scene art and sprites draw only from the indexed palette in `frontend/src/art/palette.ts`; the UI reads the same values through the CSS custom properties.

## Typography

**Display Font:** Pixelify Sans (400–700), with Silkscreen digits in front of it as "RQ Digits"
**Label Font:** Silkscreen (400), uppercase and letterspaced
**Fallbacks:** `ui-rounded, system-ui, sans-serif` for UI text; `ui-monospace, monospace` for labels

**Character:** Pixelify Sans gives questions and answers a soft, readable pixel voice; Silkscreen gives labels, buttons, section titles and the wordmark a hard, stamped, letterspaced voice. Every numeral in the UI face is Silkscreen, so times and scores read cleanly at any size.

### Hierarchy
- **Hero** (700, clamp(2.25rem, 9vw, 4.25rem), 1.02, −0.01em): the home headline "How fast is your brain?", set low in the forest with a dark drop and halo, balanced.
- **Reveal time** (700, clamp(3.5rem, 19vw, 6rem), 0.95): the measured time in the reveal, counting up from 0, set on the scene with a dark drop and halo. Tabular figures, slightly tightened. A timeout becomes the words "Out of time" at clamp(1.75rem, 7vw, 2.5rem).
- **Reveal band** (Silkscreen 400, clamp(1.5rem, 7vw, 2.25rem), 1.05, 0.06em, uppercase): the animal name with "!" in its band colour and a soft same-colour glow.
- **Display** (700, clamp(3rem, 14vw, 4.5rem), 1): the results score in gold, beside "points" in sage. Under it the standing line ("2nd of 5 players today · ahead of 50%") at 1.125rem 500; the big average answer time at 700, clamp(2rem, 8vw, 2.75rem); the stat values at 700, 1.5rem, tabular.
- **Headline** (600, clamp(1.4rem, 5.6vw, 2.4rem), 1.2): the question text, centred, balanced, max 26ch.
- **Answer** (500, 1.0625rem, 1.2; 1.125rem from 640px): answer tiles. Result questions (1.0625rem) and ladder names also use weight 500.
- **Body** (400, 1rem, 1.45): ledes in sage (the home lede at 1.0625rem, max 44ch), how-to-play steps (a 500 title over a sage body), the speed sentence (sage, max 44ch), result detail (0.9375rem), notes (0.875rem), the speed scale (0.75rem, sage at 70%).
- **Label** (Silkscreen 400, 0.75rem, 0.08em, uppercase, sage): functional labels such as "Score", "Read the question", "You said", "Answer", the "You"/"Average" bar labels, the stat labels (Correct, Fastest, Hummingbirds) and the Show/Hide hint. Speed-track marker labels use the same face at 0.06em; how-to-play step numbers at 1rem in gold. Buttons use the same face at 0.9375rem; the wordmark at 1rem with 0.12em (0.9375rem and 0.08em at 440px and below); the home date and the rare line at 0.8125rem; section titles at 0.875rem with 0.1em in gold-hi; "Answer now!" at 1.125rem with 0.1em in gold.

### Named Rules
**The Silkscreen Digits Rule.** Every numeral rendered in the UI face uses Silkscreen digits ("RQ Digits", U+0030–0039, 400 for weights up to 500 and 700 for 600–900). Pixelify Sans's 2 and 5 read as 8 and S at small sizes, and a speed quiz lives on numbers. Never set a digit in raw Pixelify Sans.

**The No Ligatures Rule.** Ligatures are off on the body (`font-variant-ligatures: none; font-feature-settings: "liga" 0, "clig" 0`). Pixelify's fi and fl ligatures read as a capital A at small sizes.

**The Weight 500 Rule.** Answer tiles, result questions and ladder names use Pixelify weight 500, never 600: at body sizes the 600 capital C reads as an O. Weight 600 is kept for the question headline and short emphasis.

**The Tabular Score Rule.** Scores, times and points use tabular figures so counting numbers do not jitter.

## Layout

One centred column. The page is a single grid, max 760px plus 16px gutters, everything text-centred, with 16px gaps (24px from 900px). The top bar and progress strip sit above it, max 1120px wide (32px side padding from 900px).

The forest breaks out of the column as a full-width band (`100vw`, centred with negative margins; the shell clips sideways overflow). A vertical mask fades its top 14% and bottom 24% into the page. Its height depends on the screen: during play clamp(200px, 32svh, 320px) on phones and clamp(260px, 38svh, 440px) from 900px; on home clamp(280px, 50svh, 520px) and clamp(340px, 48svh, 560px); on results clamp(220px, 34svh, 360px) and clamp(260px, 36svh, 420px). While typing on screens under 900px it shrinks to 96px so the input stays above the keyboard.

**Play:** forest, then the question centred, the read cue, six answer tiles and the action. Tiles are a 2×3 grid on phones and 3×2 from 640px, with 8px gaps. Typed answers sit in a centred 520px row. Grid rows with 1fr spacers above and below centre the play block vertically in the space under the forest. The action is a centred gold pill, full width up to 420px. On phones, during the reveal and while a question is being fetched, the action is sticky at the bottom over a fade to `night`, honouring the safe-area inset. Keys 1–6 answer and Enter acts; their key badges show only for fine pointers.

**Home:** a taller forest with the headline low inside it over an upward scrim; then the lede, the "Start today's quiz" pill and a note; then "The speed ladder"; then "How to play" at the bottom. From 900px the lede is pulled 48px up into the forest's fade so the hero reads as one block. The header score and the progress strip are hidden on home.

**Results:** forest (the day's animals gathered on varied perches), then a centred summary ordered by what matters: score and standing, the score comparison (520px), "Your speed" (560px), the three stats (520px) and the animal row; then the share pill and next-quiz note; then the "Your answers" toggle.

The top bar floats on the night with no band or rule. Under it, an 8-segment progress strip (4px pills, 6px gaps) marks each question. At 440px and below the "Score" label hides so the full name has room.

Spacing follows a 4px scale: 4, 8, 12, 16, 24, 32, 48, 64. Tap targets are at least 44px; tiles are 64px tall on phones and 76px from 640px; buttons and inputs are 56px.

### Named Rules
**The Whole Pixel Rule.** One art pixel is always 2 CSS px. Canvases render with `image-rendering: pixelated` and smoothing off. A larger stage gets more art pixels (more forest), never larger or fractional ones.

**The Open Forest Rule.** The scene never sits in a frame. It has no border, outline, drop shadow or vignette; it runs the full width of the window and meets the page through masks that fade it into `night`.

**The Centre Stage Rule.** The game sits in one centred column under the forest: question, answers and action are centred, and the play block is centred vertically in the space that remains. There is no side column.

## Elevation & Depth

Depth comes from tone, translucency and light, not from boxes. Controls are translucent green fills that let the night show through; the forest recedes into the page at its masked edges; scrims darken the scene behind words set on it (top-down for a reveal, bottom-up for the home headline). No surface casts a drop shadow. Shadows exist only as legibility and light: dark text shadows on words over the scene, glows from gold and jade, a faint bevel and gold halo on the primary pill, and 2px inset rings that mark a state.

### Shadow Vocabulary
- **Scene text** (`text-shadow: 0 2px 0 rgb(0 0 0 / 0.55), 0 0 22px rgb(0 0 0 / 0.75)`): the reveal time. Reveal detail uses the drop alone; the hero title uses `0 3px 0` at 50% with a 30px halo at 70%.
- **Band glow** (`text-shadow: 0 2px 0 rgb(0 0 0 / 0.55), 0 0 24px` band colour at 45%): the reveal band name.
- **Reveal scrim** (`linear-gradient(180deg, rgb(6 17 13 / 0.92) 0, rgb(6 17 13 / 0.7) 60%, rgb(6 17 13 / 0) 100%)`): from the top of the forest down, behind a reveal.
- **Hero scrim** (`linear-gradient(0deg, rgb(6 17 13 / 0.85) 0, rgb(6 17 13 / 0.55) 55%, rgb(6 17 13 / 0) 100%)`): from the bottom of the forest up, behind the home headline.
- **Pill bevel and halo** (`inset 0 -3px 0 rgb(0 0 0 / 0.2), 0 8px 24px rgb(232 176 74 / 0.18)`): the primary gold pill only.
- **Tile sheen** (`inset 0 1px 0 rgb(255 255 255 / 0.04)`): a faint top highlight on resting tiles and inputs.
- **State ring** (`inset 0 0 0 2px`): jade at 55% for correct, ruby at 50% for wrong, solid gold on a typed input at GO.
- **Light glows**: GO pips (`0 0 10px` gold at 50%), the Hummingbird progress segment (`0 0 8px` jade at 60%), the Hummingbird ladder rung (name `0 0 14px` jade at 55%, sprite `drop-shadow(0 0 10px` jade at 45%`)`), the rare line (`0 0 16px` gold at 45%), the Hummingbirds stat when above 0 (`0 0 14px` jade at 45%).
- **Marker ring** (`border: 3px solid var(--night)`): cuts the speed-track markers out of the band strip so they read on any zone.

### Named Rules
**The No Frame Rule.** Nothing in the UI is a box: no 1px outlines around panels, tiles, inputs, lists or the scene, and no drop shadows under surfaces. Shapes are defined by tone fill, soft rounding and space. A 2px inset ring is allowed only to mark a state (correct, wrong, GO). The one line is the hairline above the answers toggle and between result items. The Rare Catch is the single exception for glow strength (see below), and it too is expressed as light on text, never as a frame.

## Shapes

Two shape languages, never mixed. The pixel layer (the scene canvas, the brand mark, animal sprites, the tick, cross and share icons) is square and crisp, drawn as pixel rectangles and never rounded or vector-stroked. The UI layer is soft: answer tiles, typed inputs and ladder rungs take a 14px radius (`soft`); buttons, progress segments, read pips, key badges, the score-comparison bars, the speed track's outer ends, its markers and the scrollbar thumb are full pills or circles (`pill`). Focus outlines follow a 14px radius. Lists are open: the speed ladder and how-to-play steps have no cells, the stats are a bare three-column definition list, the results animal row is a bare 8-column line of sprites, and result items are separated only by hairlines. The toggle's chevron is a small CSS corner (2px strokes) that turns over when the list opens.

## Components

### Buttons
Gold pills with letterspaced Silkscreen text, centred.
- **Shape:** full pill, 56px tall, 32px horizontal padding, no border. Block buttons are full width up to 420px.
- **Primary:** gold fill, `near0` text, Silkscreen 0.9375rem uppercase at 0.08em; a faint inner bottom bevel and gold halo ("Start today's quiz", "Ready for question 2", "Lock in", "Share your result").
- **Hover / Active:** hover brightens to `gold-hi`; active presses down 1px. Focus is the global 2px jade outline at 3px offset.
- **Disabled:** `mid0` fill, sage text, no shadow, progress cursor (shown while a question is being fetched).
- **Quiet:** a soft gold wash (gold at 12%) with `gold-hi` text; hover deepens to 20%. After each answer the next-question button starts quiet and turns gold only once the reveal has landed, so it never outshouts the time and the animal.

### Answer tiles
Six soft tone shapes: a 2×3 grid on phones, 3×2 from 640px.
- **Resting:** `fill` with a faint top sheen, 14px radius, no outline, weight 500 text centred, 64px min height (76px and 1.125rem from 640px). Hover lifts 1px onto `fill-hover`. On fine pointers a round 22px key badge (1–6) sits vertically centred on the left, and the tile pads 44px on both sides to balance it.
- **Sealed:** while the question is read, tiles are faint empty fills (`fill` tone at 30%), text transparent. No placeholder bars or loading shimmer.
- **Opening:** see The GO Moment.
- **Chosen:** `fill-hover`.
- **Correct:** jade tint (20%) with a 2px jade inset ring and a pixel tick top-right. **Wrong:** ruby tint (18%) with a 2px ruby inset ring, soft ruby text and a pixel cross. Others dim to 45%.

### Inputs / Fields
- **Style:** a `fill` shape with a faint inner hairline, 14px radius, no border, 56px tall, 1.125rem 500 text, `placeholder` hint, gold caret, in a centred row up to 520px with the "Lock in" pill to its right.
- **Focus:** the global jade outline.
- **GO:** a 2px gold inset ring for the GO beat.
- **Result:** after answering, centred "You said" and "Answer" rows with no panel; answers at 1.25rem 600, yours in jade if right, soft ruby if wrong.

### Navigation (top bar)
A transparent bar floating on the night, with no band or rule: a pixel hummingbird mark, the HUMMINGBIRD wordmark in letterspaced Silkscreen, the quiz number in sage, and the running score in gold on the right (700, 1.375rem, tabular). The score is hidden on home; its "Score" label hides at 440px and below.

### Progress strip
Eight equal 4px pills with 6px gaps, directly on the page under the bar, hidden on home. Upcoming segments are `mid0`; the current one is ivory; answered segments take the animal's band colour; misses go `miss-dim`. A Hummingbird segment glows jade.

### Read cue
The "read the question" beat. A centred row above the sealed tiles with the label "Read the question" and three 12px round pips. The pips light gold one after another across the read time; then the cue becomes the GO moment. It is a status, never a countdown: no numbers, no draining bar.

### Reveal
The one loud moment, with no card. The words sit directly on the top of the forest over the reveal scrim, centred, max 34rem wide. The time counts up from 0 to the measured time over 700ms (ease-out), the animal runs its own path through the scene, then the band name ("Jaguar!") and "Correct · +700 points" fade and rise 6px into place. A miss shows "Not quite" or "Out of time" in soft ruby with the correct answer. Every reveal is announced to screen readers. With reduced motion the final time and a still animal appear at once.

### Home hero
The forest is the hero. The headline "How fast is your brain?" ("Welcome back." when resuming) sits low in the scene over the hero scrim, with "Quiz #N · date" beneath it in gold-hi Silkscreen. Below the forest: the lede in sage ("8 questions. The faster you answer, the faster your animal, and the more points you score."), the "Start today's quiz" pill, and a short note in sage.

### Speed ladder
"The speed ladder", a section title in gold-hi Silkscreen, over the five animals fastest first. On phones each rung is a row (2× sprite in a 104px slot, name in its band colour at weight 500 over its time range in sage, points in gold on the right); from 640px the rungs become five centred columns with the sprite on top. The Hummingbird rung glows jade on its name and sprite, with no box. Ranges: Hummingbird 0.5 s or less, Jaguar 0.5–1.2 s, Toucan 1.2–2.5 s, Tree frog 2.5–4.5 s, Sloth over 4.5 s.

### How to play
"How to play" at the bottom of home, under a gold-hi section title: an ordered list of eight steps, left-aligned in a centred 560px column with 16px between steps. Each step has a gold Silkscreen number (1rem) in a 32px gutter, a short title at weight 500 and a sage sentence beneath. No cells, rules or icons.

### Results
Centred on speed, score and standing, top to bottom:
1. **Score:** the gold display score with "points" in sage.
2. **Standing:** "2nd of 5 players today · ahead of 50%" (1.125rem, 500); "You're the first to finish today." when alone.
3. **Score comparison:** two rows on one scale, each a Silkscreen label, a 10px `mid0` pill track and a tabular value: "You" filled gold with gold label and value, "Average" filled sage. Hidden when you are the only player.
4. **Your speed:** a gold-hi section title, then the big average answer time with "average answer" in sage, then the speed track: an 8px strip of the five band colours (80% opacity) on a 0–5 s scale, rounded at its outer ends, with a 16px ivory "You" marker labelled above it and a sage "Average" marker labelled below, each cut out by a 3px night ring; near either end the labels hang inwards. Under it a "0 s" / "5 s+" scale and a sentence: "Faster than 75% of today's players. You beat today's average by 0.4 s." With no correct answers, the section is just a sentence.
5. **Stats:** Correct, Fastest and Hummingbirds in three columns, Silkscreen labels over 1.5rem values; the Hummingbirds value turns jade with a glow when above 0.
6. **Animal row:** one 8-column row of sprites (1× on phones, 2× from 640px) with a pixel cross for misses.

Then the share pill and the next-quiz note. Then an open text toggle, "Your answers · Show/Hide", with a chevron, a hairline above, no fill, max 600px; the hint turns gold-hi on hover. Opened, it shows result items separated by hairlines, each with the animal sprite, the question (weight 500), your answer, the animal name in its band colour, the time, points and the share of players who got it right. The forest gathers the day's animals on varied perches and facings.

### Scene
Dusk rainforest drawn into an indexed raster: a dithered sky from night green to a low gold sun, far canopy lines, mist bands between layers and a low mist in front of the trunk bases, trunks with bark shading, vines, ferns, monstera, heliconia, fireflies that drift and pulse, and five detailed animal sprites (hummingbird, jaguar, toucan, tree frog, sloth), each with its own run path.

## Do's and Don'ts

### Do:
- **Do** keep every dark ground green-tinted with green above blue, from the ramp `night` → `sky1`–`sky4` → `mid0`–`mid2` → `near0`/`near1`.
- **Do** keep gold for actions and score, jade for focus and correctness, ruby for misses only.
- **Do** set a band colour through `--band-colour: var(--band-<animal>)` wherever an animal stands for a result.
- **Do** render pixel art at exactly 2 CSS px per art pixel with `image-rendering: pixelated` and smoothing off.
- **Do** run the forest as a full-width band that fades into the page through masks.
- **Do** keep the game in one centred column under the forest, with the play block centred vertically.
- **Do** build UI surfaces from translucent tone fills, 14px rounding and pills, separated by space.
- **Do** keep the pixel layer (scene, sprites, icons) square and crisp; round only the UI around it.
- **Do** set every numeral in the UI face with Silkscreen digits, with ligatures off and tabular figures for scores and times.
- **Do** use Pixelify weight 500 for answer tiles, result questions and ladder names.
- **Do** give each question a read beat (three gold pips, sealed tiles) before the six answers open together.
- **Do** give text set over the scene a scrim and the dark scene-text shadow so it reads on any part of the forest.
- **Do** write user-facing copy in British English ("colour", "Out of time", "midnight UK time").
- **Do** respect `prefers-reduced-motion`: no count-up, still animals, instant tiles.

### Don't:
- **Don't** show a timer, countdown number or draining bar while the player is answering; time is revealed only after.
- **Don't** make anything else as loud as the reveal: no confetti, flashing or big colour on question or results chrome. The Rare Catch is the only place the reveal itself may flash.
- **Don't** frame the scene: no border, outline, drop shadow or vignette around the forest.
- **Don't** split the game into side columns; the forest goes above, the game goes centred below.
- **Don't** draw 1px outlines around tiles, inputs, panels or lists, or build lists as bordered tables or cells.
- **Don't** put the reveal, or any other message over the scene, in a card.
- **Don't** cover the hummingbird with text; rare-catch words go under the scene, above the action.
- **Don't** add drop shadows under UI surfaces; use tone, glow and the state ring instead.
- **Don't** round, smooth or vector-stroke pixel art, or scale it by a non-integer factor.
- **Don't** add colours to scene art or sprites outside `frontend/src/art/palette.ts`.
- **Don't** use band colours as decoration where no animal is meant.
- **Don't** set digits in raw Pixelify Sans, set answers in weight 600, or re-enable ligatures.
- **Don't** fill sealed answer tiles with placeholder bars or loading shimmer.

## The Rare Catch

A Hummingbird (a correct answer in 0.5 s or less) is the rarest result in the game and the catch the game is named after, and its reveal is the one moment allowed to be louder than the standard reveal. It is expressed as light on the text, not a frame: the time turns gold-hi with a strong gold glow (28px at 55%), and the band name carries a strong jade glow (30px at 70%). The band name flashes gold-hi, jade and gold twice in hard steps, with no easing. In the scene, the hummingbird leaves a jade-and-gold trail and hovers low by the heliconia, below the text, landing to a three-ring burst lasting 1.4 s while every firefly flares at once. The line "Lightning reflexes. The rarest catch in the forest." sits under the scene, above the ready button, in uppercase Silkscreen at 0.8125rem in gold-hi with a soft gold glow, so nothing covers the bird. Phones get a short vibration, and the bird's progress segment glows. On the home ladder the Hummingbird rung glows jade, and on the results screen the Hummingbirds stat turns jade with a glow. With reduced motion, the flash, trail, burst and vibration are all skipped. No other band may borrow these devices.

## The GO Moment

When the three read pips complete, the six answers open as a single unmistakable beat. The read cue flips to a gold "Answer now!" at 1.125rem (0.1em), settling from 1.35× scale and gold-hi, and the pips flare from 1.6× and gold-hi to gold with a gold glow. For 0.9 s the whole forest brightens (brightness 1.35, saturate 1.15), rising in 0.12 s and easing back over 0.5 s; there is no frame flash. The tiles rise 10px from 40% opacity through a warm gold wash (32%, then 22%) that settles back to their tone over 0.7 s, staggered 40 ms apart. Typed inputs take a 2px gold inset ring, and phones give a 15 ms tick. With reduced motion, the cue and pip flare, the tile rise and the vibration are skipped, but the colour change still marks the moment.
