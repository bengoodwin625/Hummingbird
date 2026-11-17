---
version: 1
slug: "frontend-index-html"
primary_target: "frontend/index.html"
related_targets: ["frontend/src"]
---

# Quiz screen (whole daily flow)

Mode: operate. Audience: casual UK players on phones doing a quick daily play; calm focus.
Scope: start → ready → read → answer → reveal (×8) → results hand-off and results screen; phone and a
proper desktop layout. Owner's changes after the shape round: a ready press before every question,
running score visible, points from the animal band (time still shown), detailed Krillion-level pixel
art with a jungle look, darker premium colours.

Open (decided by builder defaults, revisit after playtest): no "get ready" cue beyond the locked
answer slots during the read phase.

## Direction contract

THESIS: The quiz is quiet while you think and theatrical when you answer: the dusk rainforest is a
stage, and the reveal (time, animal, points) is the one loud moment. Refuses the category default of
a ticking countdown bar over a bright card grid.

OWN-WORLD: Night-green canopy (#06110d to #123a2b) with mist bands, gold (#e8b04a) and jade (#3fd0b0)
light; dark panels with 1px glowing jade or gold outlines; letterspaced Silkscreen labels; Pixelify
Sans for questions; fine 2-CSS-px pixel art with dithered gradients, vines, ferns, fireflies; five
detailed animal sprites.

STORY: The player learns the rules in one line, presses ready, reads, taps once, and is surprised by
their time and animal. Eight reveals build a row of animals they want to share.

FIRST VIEWPORT (amended at the owner's request: "options out of 6 and the main focus of the game so
its in the centre", "i dont like all of the boxes"): one centred column. A slim header (Hummingbird
wordmark, quiz number, running score) and an 8-pill progress strip; the frameless forest as a
full-width band (~32svh phone, ~38svh desktop) fading into the page; the question centred beneath
it; six soft answer tiles (2×3 on phones, 3×2 from 640px); one centred gold pill action. On desktop
the question block is centred vertically in the space under the forest. Keys 1–6 and Enter work.
Home: the forest is taller with the headline set low in it, then the lede, the CTA and the speed
ladder. Results: the day's animals in one row lead, then the score, the share action and an open
"Your answers" toggle.

FORM: Big time reveal (third card on the decision page; owner-chosen). seed: none (pinned) — owner's words: "make the
art more complex … more in the style of krillion art form but with the jungle look", "prioritise
darker colours rather than basic bright colours to make it look more premium". Signature
interaction: the reveal — time counts up from 0 to the measured time in large pixel numerals while
the animal runs its own path through the scene, then the band name and points land.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
