# How Hummingbird could make money

A plan, not a build. Nothing here is built yet. Accounts, payments and leaderboards are all out
of scope for v1 (see CLAUDE.md), and each step below needs its own build when the time comes.

## The principle: keep the daily quiz free

Hummingbird grows by word of mouth: someone shares their animal row, a friend plays tomorrow. Anything
that slows that loop (a paywall on the daily quiz, pop-up ads, sign-up before playing) costs more
than it earns. So the daily 8 questions stay free, with no account and no adverts. Money comes from
people who already love it and want **more of it**, or want to play it **with their group**.

## 1. Hummingbird Club — a supporter subscription (first)

Suggested price to test: **£2.99 a month or £24.99 a year**.

What members get, all built on things the game already has:

- **The archive**: play any past day's quiz (scored, but not counted in that day's results).
  *Owner decision (18 November 2026): the archive is a Club feature only, never free.*
- **Your stats**: speed over time, your fastest answers, best categories, and your animal
  collection (how many hummingbirds you've ever caught).
- **A bonus round**: an extra 8 questions a day, for people who want more than one go.
- **Forest themes**: cosmetic changes such as dawn, monsoon or a moonlit forest, plus alternative
  animal sprites. These are cosmetic only, so they never affect fairness.

Why first: it's the simplest to run, it fits the product, and supporters are usually the people who
share most. Expect only a small slice of regular players to subscribe, so this pays off once the
daily audience is in the thousands.

## 2. Leagues — play with your group (second, likely the biggest)

- **Free leagues** for small friend groups: a private table for everyone in the group chat.
  *Built (18 November 2026): create or join with a 6-letter code, today's scores and a weekly
  best-five total. Teams would add on top of these.*
- **Hummingbird for Teams**, paid per team (for example £15–£30 a month): for offices, clubs, schools
  and pubs. It includes a shared leaderboard, weekly and monthly winners, a channel that posts the
  daily results (Slack or Teams), and simple admin.

Why: businesses pay more readily than individuals, an office-wide daily quiz is a natural
team-building habit, and every team member is a new daily player.

## 3. Sponsored themed weeks (later, selective)

A museum, publisher, broadcaster or brand sponsors a week of questions on their subject, clearly
labelled ("This week's questions are brought to you by…"). The sponsor gets attention and
goodwill; players get questions on a topic they might enjoy. Only take sponsors that fit the
tone, and never let them change how the scoring works.

## What to avoid

- **Ads during play.** They would break the premium feel and the speed mechanic. If ads are ever
  used, keep them to one quiet slot on the results page for non-members, and only as a test.
- **Pay-to-win.** Nothing bought may make anyone faster or change their score. The leaderboard has
  to stay fair, or the whole game loses its point.
- **Making accounts compulsory for the daily quiz.** Accounts should be optional, offered after
  a player is hooked ("save your stats").

## Order of work

1. **Grow first.** Get the daily habit and sharing working, and write questions far enough ahead.
   Watch daily players, how many come back after 7 days, and how many share.
2. **Optional accounts** (email or Google/Apple sign-in), needed for both the Club and Leagues.
3. **The Club**, with Stripe for payments (it handles UK VAT on digital services through Stripe
   Tax).
4. **Leagues**: free first, then Teams once groups are asking for it.
5. **Sponsored weeks**, once the audience is big enough to be worth sponsoring.

## Before charging anyone

- Terms of service, a privacy policy and a refund policy.
- VAT registration once you pass the threshold (Stripe Tax helps). Talk to an accountant about
  setting up as a sole trader or a limited company.
- A steady supply of fact-checked questions, because paying members will expect the archive and
  the bonus rounds to be just as good.
