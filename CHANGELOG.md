# Changelog

All notable changes to AllSport are documented here.

## [0.5.7.1] - 2026-08-19

### Fixed
- **The database update would have stopped half-way through, leaving the privacy fix unapplied.** One migration still tried to redefine the player roster with column names that no longer match the live one, which PostgreSQL refuses outright. It would have applied the two protections before it, then failed, then never reached the change that actually closes off player contact details. Only one migration defines that roster now, and it rebuilds it from scratch rather than assuming what it will find.

## [0.5.7.0] - 2026-08-19

### Fixed
- **Anyone at all could read every player's contact details.** No account, no password, nothing: one request to our database returned all 27 players with 19 email addresses, 9 phone numbers, 25 legal names and everybody's exact date of birth. Eight of those players are under 18, and one of them had a parent's name, email and phone attached. This has been open since the database was rebuilt in April 2026. Your details are now visible only to you, to your parent or guardian if you are on a family account, and to a kaiwhakawā.
- **The live session and game report show names again.** The player roster gained a column while v0.5.6.1 was being written, which left those two screens asking for names that were no longer there. Both now match the roster as it actually stands, checked against the live database rather than assumed.

### Added
- **A privacy policy, linked from the point where we ask for your details.** It says plainly what is collected, what other players can see, and what happens to a child's information.
- **"Show my division" now actually works.** Turning it off hides your Masters or 60+ badge on the live leaderboard. You are still ranked in your pool, because the standings cannot be opted out of without changing everybody else's placings.

### Changed
- The location toggle has been removed from your profile and from registration. It offered to publish a city and region that nothing has ever displayed, so it was a promise about data we never showed.

## [0.5.6.1] - 2026-08-19

### Fixed
- **The live session showed no players, and the game report showed no names.** v0.5.6.0 asked the database for player details using column names that did not match the ones actually there, so three screens got an error back instead of a list: the in-game leaderboard, the kaiwhakawā player picker, and the full game report. The leaderboard, dashboard and My Koha were unaffected. Everything now asks for the columns that exist, and all five were checked against the live database rather than assumed.
- **Running the database migrations would have failed part-way through.** One migration tried to redefine the player roster with different column names, which PostgreSQL refuses to do, so it would have stopped after applying the two before it. It now matches what is already there, and carries a note explaining why changing a column in it is not a one-line edit.

### Changed
- The age brackets on the Junior leaderboard (U10/U12/U14/U16) are worked out in the app again rather than in the database, because the roster the app reads provides a plain age. No visible difference.

## [0.5.6.0] - 2026-08-16

### Fixed
- **A player could make themselves a kaiwhakawā.** Nothing stopped an ordinary account from granting itself the judge role, which carries the power to edit or delete anybody's scores, void sessions, and see every player's koha donations and who voted for what. Only Tāne was ever meant to have it. The role is now locked, and the only way to grant it is still by hand in the database.
- **A player could enter scores into games that had already finished.** You could add or change a score in a session from weeks ago, including sessions you never turned up to, and set your own points total directly. Scores can now only be entered while a session is actually running, points are worked out by the server and never accepted from a phone, and only a kaiwhakawā can add a guest player. Judges keep the ability to correct a score after a session has closed, because that is a real part of the job.
- Your score itself is still something you type in, and that is on purpose: the sport already requires a result to be filmed or witnessed. What changed is that a score can no longer be quietly rewritten later.

### Added
- **A safe public roster.** The leaderboard, the game report and the live session all need to show other players' names and divisions. They now read a roster that contains only that, and no contact details at all. This is the groundwork for the next release, which closes off the rest.
- **Your "show my full name" choice now actually does something.** You are asked at registration whether your legal name should appear on public leaderboards, and it defaults to no. That answer was never checked, so full names were readable regardless. It is now enforced where it should have been all along, in the database.

### Changed
- **Your exact date of birth no longer leaves the database.** The Junior age chips and the U10/U12/U14/U16 badges need an age bracket, not a birthday, so the bracket is now worked out server-side and only the bracket is sent.
- One small consequence of that: a player who has turned 17 but is still listed in Juniors no longer gets a U16 badge. Previously the badge had no upper limit, so any age from 14 up showed as U16.

## [0.5.5.0] - 2026-08-13

### Fixed
- **A page that logged you in could be stored by a shared cache.** Sign-in responses were marked publicly cacheable, so in principle a cache sitting between you and the site could hold one player's logged-in session and hand it to somebody else. Those responses are now marked never-store, which is what Supabase intended all along.
- **Your login is now marked HTTPS-only.** The session cookie never carried the flag that stops a browser sending it over an insecure connection.
- **A sign-in link could be crafted to bounce you somewhere else.** The "where to go after login" part of the address is now checked, so it can only ever send you to a page on AllSport. Previously a link could be written that looked like allsport.nz but landed you on another site with the login screen still showing.

### Added
- **The site now tells your browser exactly which other sites it is allowed to talk to** — AllSport itself, our database, and Google Fonts, and nothing else. If anything ever got injected into a page, it has nowhere to send your data.
- **AllSport can no longer be embedded inside another site's page.** This is what stops a copycat page framing the live scoring screen and collecting taps meant for us.
- **Camera, microphone and location are switched off at the browser level.** The app never asks for them, and now it cannot.

### Changed
- Pages are no longer served with a header inviting any other website to read them.
- Twenty-seven tests now cover the security settings above, because a security setting is the kind of thing that breaks silently: remove it and nothing looks wrong.

## [0.5.4.0] - 2026-08-07

### Added
- **Your colours never reset.** Every point you have ever earned counts toward your next colour, for as long as you play. Cross a threshold and that colour is yours permanently — it can't be taken back, even if a session is later voided or a score corrected.
- **Nine more colours beyond Taniwha.** Past Taniwha the colours begin again — Taniwha Kiwikiwi, Taniwha Whero, and on — each another 10,000 points, ending at **Ngā Taniwha** on 100,000, where you earn the whole crest. The Colour Key on the leaderboard hides these behind a "Beyond Taniwha" reveal until you want to see them.
- **Your kaiwhakawā knows before you do.** During a session, the Kaiwhakawā tab shows who is about to earn a colour, and tells them the moment it is certain — certain meaning it holds even if you finish last from here. They tap Celebrated, and that is when you find out. The moment happens in the room instead of arriving on your phone after everyone has gone home.
- **A colour timeline.** Tap your Colours card and you now see every colour you have ever earned, with the date and the session it happened in. Backfilled from your real history, so it is full from day one.
- **"Approaching a colour" on the judge panel** — who is closest to their next colour, measured in sessions rather than points, so a session can be planned around it.
- **A colour moment at the end of a session.** Earn a colour and it leads the end-of-session screen, above your placement.

### Changed
- **Your colour and your leaderboard rank are now two different things.** The leaderboard still resets every January, so there is always a fresh race and a new player can climb it. Your colour comes from your lifetime total and only ever goes up.
- **Historic points from 2025 have finally been applied** — Rodrigo, Salvador and Zeke's earlier play now counts toward their colours. It had never actually taken effect.
- The Colours card drops its year tabs — with lifetime points there is nothing to switch between.

### Fixed
- A colour announced by a kaiwhakawā could, in rare cases, not actually have been awarded if scores changed at the same moment. The app now confirms with the server before saying anything out loud.
- Kōwhai rendered as two slightly different yellows depending on which screen you were on.

## [0.5.3.0] - 2026-08-01

### Added
- **Seven new events, bringing the roster to 120** — **Arm Wrestling** and **Tug of War** join Power, **Capture the Flag** and **Kabaddi** join Speed, **Wheelbarrow Push** and **Wheelbarrow Pull** join Aerobic Endurance (same weight ladder as Weighted Carry, 5kg through 100kg over 200m, fastest wins), and **Kubb** returns to Aim & Precision. All seven have full how-to and rules text and their own icons, so every one of the 120 events now has artwork.

### Changed
- **Every domain now holds exactly twelve events** — the roster has been reconciled against the current programming, so no domain is bigger than another when an event is drawn.
- **Leg Extension is now Leg Ext Hold** — it changes from a heaviest-weight lift to a timed hold with seven difficulty tiers, from bodyweight up to 24kg. Hold both legs locked out for as long as you can; longest hold at your tier wins.
- **Events renamed for clarity** — Pause Squat is now Pause Back Squat, Pause Chin Up is Pause Chinup, Turkish Get Up is Turkish Getup, Flag is Human Flag, Finger Push Up is Finger Pushup, Ham Curl is Hamstring Curl, Foot Behind Head is Foot Behind Head Pose, and Toe Balance is Toe Squat. Your history for all of these carries over.
- **Some events moved domain** — Headstand and L-Sit Hold move to Calisthenics, Toe Lift and Toe Squat move to Anaerobic Endurance, and American Football moves to Speed.

### Fixed
- **Personal bests that had gone missing are back** — renaming an event used to quietly detach every score you'd ever set on it, so those bests stopped showing on your Personal Bests page and stopped counting toward your Top %. Scores from before a rename now reattach, including events renamed in earlier releases such as Handbalance, Rope Climb, Zercher Deadlift, Shot Put and Javelin Throw.
- **Weight entry on Pause Chinup's top tier** — the Weighted Chinup tier takes a weight instead of reps, and the rename would have silently turned that back into a rep count on both new and past sessions.

### Removed
- **Nine events retired** — Reverse Hyper, Triple Jump, 400m Race, 50m Sprint, Football Dribble, Hockey Dribble, Walking, Backwards Walk and Airsoft. Scores you already set on them stay in your session history.

## [0.5.2.0] - 2026-07-30

### Changed
- **Kaiwhakawā scoring now looks and works like the player screen** — the judge tab was still on the old two-column card grid while players moved to the new layout. It now uses the same event list, the same tap-to-score quick-entry sheet, and the same progress bar, so there's one way to score in AllSport instead of two.
- **Pick a player by tapping their name** — the dropdown is gone. Everyone in the session is a chip along the top: tap to score for them, tap again to go back. Guests you've already scored get their own chip too, so you never retype a guest's name mid-session. "+ Player" reaches anyone else registered, and "+ Guest" takes a new name.
- **See who still needs scoring at a glance** — with nobody selected, the tab now shows the session roster: every player with a progress bar and how many of the ten events they've done, so you can go straight to whoever is behind. Tap a row to start scoring them.
- **Score confirmations name the player** — a kaiwhakawā scoring for several people in a row now sees "Meredith — Deadlift — 95kg × 3", so it's obvious the score landed on the right person. Personal-best alerts still show. The player-only celebrations (effort cap, all-ten-events, new event unlocked) stay on the player's own screen.

### Fixed
- **Wrong personal best when switching players quickly** — the judge tab kept the previous player's season PR on screen while the new player's loaded, which also fed the wrong target into their effort task. It now clears immediately and ignores out-of-order responses. Easy to hit now that switching players is a single tap.

### Removed
- **The old judge event-card grid** — around 510 lines of duplicated scoring code deleted. Scoring now runs through one code path for players and kaiwhakawā alike.

## [0.5.1.0] - 2026-07-16

### Changed
- **"My 100" is now "My Events"** — the dashboard card and its modal are renamed, and the confusing "skill" score is gone. Instead you now see how you actually rank against your division: **Top X%** on every event and domain (the share of players who've played it that your best beats), or **1st** when nobody has beaten your best.
- **My Events dashboard card** — cleaner at a glance: one colourful bar shows how many of the 105 events you've played (with the count), plus your **Top Domain** and **Top Event** with their icons and your Top % in each. The old wins/average/events row and the busy dot grid are gone.
- **My Events modal** — opens to your session wins, average placement, and total games played, then your **strongest and weakest** events side by side. Every domain is now expandable: tap to see each event with its icon and your Top %, including the events you haven't played yet (shown dimmed) so you can spot where the easy ranking wins are.
- **Leaderboard Top Domain / Top Event** — now read as "Power · Top 8%" or "Deadlift · 1st", so the whole app speaks one ranking language.

## [0.5.0.1] - 2026-07-15

### Changed
- **Personal Bests page — domains now collapse** — /prs opens with all ten domains collapsed. Each domain row shows its own icon, the domain name in its colour, and a PB count (events with a result / total in that domain). Tap a domain to expand its event rows; each event now shows its pictogram icon, dimmed for events you haven't scored yet. Domains open independently, and event rows still expand to full PB history. New `DomainIcon` component and `public/domain-icons/` icon set (masked and tinted the domain colour like the event icons).

## [0.5.0.0] - 2026-07-14

### Added
- **Skill ratings** — every player now has a 0–100 skill score per event and per domain, computed from a multiplayer Elo run over session results (each event is a mini tournament within your division pool). 50 is the division average; 100 takes sustained dominance. Shown on the My 100 card, the new My Stats modal, and the leaderboard. Lives in `lib/rating.ts` with unit tests.
- **My Stats modal** — tapping My 100 opens a full breakdown: session wins, average placement, events played, your top event and top domain, and a per-domain skill bar with coverage.
- **Bowling** — new Aim & Precision event (head-to-head W/D/L over a set number of frames). Brings the catalogue to 105 events.
- **Quarterly wellbeing check-in** — a short, validated survey (WHO-5 wellbeing, physical-activity days, self-rated fitness, and confidence/enjoyment/belonging) that appears on the dashboard no more than once a quarter. Answers stay private to the player; kaiwhakawā see only aggregate trends by cohort (with small groups suppressed) plus a CSV export for funder evidence. Migration `20260714_wellbeing_survey.sql`.

### Changed
- **My 100 is now a stat card** — alongside the coverage dots it shows wins, average place, events played, per-domain skill scores, and your top event, and opens the My Stats modal instead of jumping straight to /prs.
- **Leaderboard columns** — Avg Place is replaced by Wins, Top Domain, and Top Event. The board now also filters to the current season only (it was mixing seasons before).
- **Difficulty tier names shortened** — 73 overflowing tier names that ran off the in-game event buttons are trimmed; the detailed judge criteria move to a new per-tier "detail" line shown in the HOW TO sheet and on event pages.
- **Selwyn Winter Jam** — the /schedule block is now a results recap with division champions instead of an advert for a past date.

### Fixed
- **Double-counted games and points** — every player was being recorded as playing each session twice, doubling their season points and session count. Root cause: an orphaned second trigger (`on_session_end`) left over from an April schema migration fired alongside the real one on every session close. Migration `20260713_fix_double_award.sql` drops the orphan, makes the award function claim each session atomically so it can never double-fire again, and rebuilds 2026 rankings from the (correct) session summaries.
- **Breath Hold ranked backwards** — it now correctly rewards longer holds (was `time` mode / shorter-wins); its effort task is 80% of your PR. Existing scores are flipped by migration `20260713b_breath_hold_duck_walk.sql`.
- **Duck Walk ranking** — retiered to distance walks only (10m–200m, faster wins) and added to the timed-effort set; historical scores re-encoded by the same migration.

## [0.4.1.0] - 2026-07-07

### Added
- **Session-end moment** — when a session ends, players who played see a full-screen wrap-up: final division placement, placement + effort points earned, every PR set today, and their colour bar animating the session's points in, with a link to the full game report. Shows once per session; if points haven't been finalised yet it shows a provisional total computed from the live scores.
- **Session milestones** — your 10th, 25th and 50th session are called out in the wrap-up. The 10th also tells you your inviter's referral just qualified.
- **PR and unlock toasts** — a new personal record now gets a gold rainbow-striped toast with a pop animation, and playing an event for the very first time gets a "New event unlocked" toast. Effort credit earned by a submission ("+5 effort") is shown on any toast.
- **Effort maxed moment** — hitting effort level 20/20 shows a one-time congratulation, and scoring all 10 events plays a one-time shimmer across the progress bar with an "All 10 events played" label.
- **My 100 dashboard card** — lifetime event coverage as 10 domain-coloured dot rows ("{n} of 100 events played"), tapping through to your personal bests.
- **Next session countdown** — the dashboard's Join a Game card now shows the next scheduled session ("Next session: Thursday 4:30pm — in 26 hours", NZ time) instead of a grey "No Session Running". The countdown maths lives in `lib/schedule.ts` with 9 unit tests.

### Changed
- **Players land on their own tab** in a live session — the leaderboard stays one tap away.
- **Live session banner celebrates rank improvements** — moving up the division briefly animates "3rd → 2nd"; rank drops stay quiet.

### Fixed
- **Leaderboard Avg Place column** — was "—" for every player; a new DB trigger + backfill (migration `20260707_leaderboard_cleanup.sql`, run in the Supabase SQL Editor) now maintains each player's season average placement.
- **Felix Bates no longer appears twice on the leaderboard** — his orphaned 'Youth' rankings row is merged into 'Juniors' by the same migration.
- **Grandmaster leaderboard tabs were always empty** — the tab keys said "Grandmasters" but the database divisions are "Grandmaster Men/Women"; the legacy Youth tab is gone too.
- **Leaderboard copy corrected** — colours are earned the moment you cross a threshold (not "awarded at year end"); points reset each January.

## [0.4.0.0] - 2026-07-05

### Added
- **Quick-entry score sheet** — tapping an event in a live session now opens a bottom sheet pre-filled from your best score today (or your season PR), with big +/− steppers (weight ±2.5kg, reps ±1, time ±5s), one-tap quick picks ("Today · 120kg × 3", "PR · 140kg", "PR +2.5kg"), a tier chip selector, and Win/Draw/Loss buttons with opponent quick-picks. The submit button always restates exactly what you're submitting. Most scores now go in without ever opening the keyboard.
- **How To at the point of play** — a HOW TO button inside the score sheet flips to how-to-perform instructions, rules and standards, and the full difficulty tier list for the event you're about to play.
- **Event how-to content for all 104 events** — 94 events that previously said "Content coming soon" now have written how-to-perform and rules content, covering judge standards, tier declaration, and scoring direction for every event.
- **Event pictograms** — every event now shows a silhouette icon in its domain colour across the live session screen, replacing domain numbers. Icons live in `public/event-icons/{slug}.png` and are recoloured automatically for the dark theme; events without an icon fall back to their emoji.
- **Session progress bar** — the live session screen shows ten domain-coloured segments that fill as you score events, plus your effort level.
- **Scoring unit tests** — the raw_score encoding logic for every input mode is now extracted to `lib/scoring.ts` with 28 unit tests (including the timed-effort inversion and Shoulder Dislocate's narrower-is-better encoding).

### Changed
- **Live session event grid replaced by a "Still to play" / "Scored" list** — unplayed events are highlighted with a "Tap to score" prompt; scored events show your score and your live "Nth in event" division rank. Judge tabs (Kaiwhakawā and Summary) keep the original card layout.
- **Score entry logic unified** — the judge card and the new player sheet now share one code path for all score encodings, so they can never drift apart.

## [0.3.3.0] - 2026-07-03

### Changed
- **Homepage redesigned** — new hero headline "One Sport, Every Sport." over the true brand rainbow, refreshed copy (better at everything / one sport for everyone / play solo or with whānau), and a koha-only badge.
- **Landing page pulled onto the official brand palette** — replaced the off-brand hero and section colours (#e63946, #2563eb, #9333ea, yellow) with the canonical tokens (#EA4742, #2371BB, #B87DB5) and the pink-inclusive six-colour rainbow. Scoped to the landing page; global tokens are unchanged.
- **Event pools refreshed** to current lists (Sandbag to Shoulder, Ultimate Frisbee, Rats & Rabbits, Speed Chess, Foot Juggling).
- **Colour ladder** now shows the point threshold for each grade (0–499 … 10,000+).
- **Metadata title and description** updated to the new tagline.

### Added
- **Session times band** on the homepage — Tuesday and Thursday 4:30pm, Saturday 9am at 26 Carbine Place, Sockburn, with a link to the full schedule.
- **"How it works" stat row** (10 disciplines · 100 minutes · lowest total wins) folded into the What Is AllSport section.

### Removed
- **Clunky "One session, all of you" format section** — replaced by the inline stat row above.

## [0.3.2.0] - 2026-06-10

### Fixed
- **Women's / Masters Women now appear on the leaderboard** — root cause was that the Masters/Grandmaster chips switched the entire ranking pool, making any player registered as "Masters Women" invisible unless the chip was toggled. All women (Women's + Masters Women + Grandmaster Women) now rank together in a unified pool. Same fix applied to Men's.
- **Leaderboard auto-refreshes without manual page reload** — added a 15-second polling fallback alongside the existing realtime subscription so scores appear automatically.
- **Men's, Women's, and Juniors sections always visible** — previously hidden entirely when no scores were submitted. Now always rendered with a "No scores yet" placeholder.

### Added
- **Total placement score on every leaderboard row** — each player row now shows their cumulative placement score (e.g. `9pts`), the sum of ordinal event placements (lower = better).
- **Masters/Grandmaster sub-division rank badge** — when viewing the full Men's or Women's pool, Masters and Grandmaster players show a secondary rank label (e.g. "1st Masters") below their overall rank.
- **Judge Game Summary tab** — a new "Summary" tab (visible to Kaiwhakawā only) shows all three divisions with all players ranked by total placement score. Each player is expandable to see all event scores and ordinal placements. Judges can delete any score directly from this view, live or post-session.

## [0.3.1.0] - 2026-06-08

### Changed
- **Live session in-game screen redesigned** — top banner now shows the player's current division placement (ordinal) and time remaining side by side, replacing the removed join-code display.
- **Event cards collapsed view updated** — now shows Score, Division rank for that specific event (with medal colours for top 3), and Effort Level. Personal record removed from collapsed view.
- **Event cards expanded view** — "Today's Top Score" is now the player's own session best; "All Today's Scores" shows the player's own submissions only.
- **Live session leaderboard replaced** — tab-based system replaced by three simultaneous sections: Men's, Women's, and Juniors. No effort leaderboard (effort shown on event buttons only).
- **Leaderboard top 3 expandable** — tap any top-3 row to see all event scores and ordinal placements. "Show all" expands ranks 4+.
- **Logged-in player pinned** — current player appears pinned below top 3 with their actual rank and a "YOU" label.
- **Masters/Grandmaster toggle per gender section** — replacing the section outright rather than adding extra rows.
- **Junior age year chips** — exact age shown (not cumulative U-age), only ages present in the session; combinable with event filter.
- **Event filter** — replaces overall ranking with event-specific flat list; age + event filters work together.

## [0.3.0.2] - 2026-06-02

### Changed
- **Domain names and order clarified across the entire app** — five domains renamed and four renumbered. New canonical order: Maximal Strength (1), Calisthenics (2), Power (3), Speed (4), Anaerobic Endurance (5), Aerobic Endurance (6), Flexibility (7), Body Awareness (8), Coordination (9), Aim & Precision (10). Old names (Relative Strength, Muscular Endurance, Flexibility & Mobility, Speed & Agility, Co-ordination) are retired.
- Updated all pages: homepage, How To Play, scoring setup, event voting, and judge panel now show the new names and order.
- DB migration `20260602_rename_domains.sql` backfills all historical session and vote data to the new domain numbers and names.

## [0.3.0.2] - 2026-05-07

### Fixed
- **Leaderboard now ranks players by total session placement** — the competitive tab shows players ordered by their combined placement score across all events (lowest = 1st), not an event-by-event list. Expand any player row to see their per-event score and placement.
- **Single-row tab bar** — the two-level Competitive / Effort split is gone. The first tab is always "Effort Level (All-Divisions)" (purple); remaining tabs are division-specific competitive views, shown only when a player from that division has submitted a score. Age labels added: Juniors (U17), Masters Men (40+), Masters Women (40+), Grandmaster Men (60+), Grandmaster Women (60+).
- **Effort tasks unlock on first submission** — effort tasks are now locked only until the player submits their competition score for an event. The session score acts as the baseline PR when no season PR exists, so tasks generate immediately after the first submission.
- **Event button always shows "Effort Level: N"** — unscored events no longer display "— pts"; the effort level counter starts at 0 and increments with qualifying submissions.
- **Reps and hold mode effort tasks** — `reps` events now generate 3/5/8-set tasks at 90/80/70% PR; `hold` events generate a fixed 2-minute task.
- **Difficulty+time task times are proportional** — tasks use ×1.5/×2.0/×3.0 multipliers on the PR hold time, stepping down D-1/D-2/D-3 tiers (previously used fixed 60/120/240s regardless of PR).

## [0.3.0.1] - 2026-04-30

### Fixed
- **Session code not displaying** — the join code was never written to the database when a session was created, leaving the JudgeCard badge and the in-game banner blank. New sessions now generate and store a 6-character alphanumeric code on creation.

## [0.3.0.0] - 2026-04-28

### Added
- **Event pages** — browse all 100 events at `/events`, or go deep on any single
  event at `/events/[slug]`. Each event page shows how to perform it, the rules,
  scoring method, difficulty tiers (D1–Dn), disadvantage options, and your
  personal best for that event if you're logged in.
- **Personal bests page** — `/prs` shows your best result for every one of the
  100 events, grouped by domain. Tap any event to expand the full history with
  PB badge, championship flags, and difficulty tier labels. Switch between this
  season and all-time with the tab at the top.
- **Difficulty tiers** — 24 skill events now have D1–Dn tier selectors in the
  live scoring view. Breakdancing and Standing Split use a tier × time formula
  so harder variations always rank above easier ones regardless of performance time.
- **Disadvantage system** — players can self-declare a small or large disadvantage
  before competing. Strength events (Domain 1 and 2) apply a 1.2× or 1.5× score
  multiplier. All events record the declaration for future reference.
- **All-Divisions tab** — the combined division tab is now labelled "All-Divisions"
  throughout the live scoring leaderboard.
- **Missing score = last place** — players who submit at least one result in a
  session but miss an event are assigned last place for that event in the standings.

### Changed
- **Dashboard Colours section** — the grade section is now called "Colours" and
  the progress bar uses the colour of your current grade (White → Taniwha Black).
  Year tabs are computed from your actual ranking history (no placeholder years).
- **Session history summary** — each recent session on the dashboard now has a
  "View Summary" popup showing your per-event scores and placements.
- **Browse all events link** — the How to Play page now links to `/events` and
  each domain accordion links to the full event list.
- **Difficulty tier labels** — D1–Dn range is shown on event buttons in session
  setup and on event rows in the live session event list.
- **T-Race** renamed from T-Test; **Chin Hang** renamed from Chin Lift — updated
  across scoring setup, live session, and event data.
- **My Personal Bests** — the dashboard now links to `/prs` instead of showing
  a stub card.

### Fixed
- **Post-game standings lookup** — player lookup in the post-game popup now uses
  `player_id` rather than display name (display name changes no longer cause a
  missing placement).
- **Judge edit clears adjusted_score** — editing a result as a judge now sets
  `adjusted_score = null` so the override isn't contaminated by a prior
  disadvantage multiplier.
- **Difficulty tier guard** — if a tier name is no longer found in event data,
  score computation returns 0 rather than a large negative value.
- **Ordinal suffixes** — 11th, 12th, 13th now display correctly (was 11st/12nd/13rd).
- **Personal best query** — event detail page now correctly filters results by
  event name (was returning the global best across all events).
- **React key collision** — no-score ghost entries now use `player_id` as the
  key component to avoid collisions with real players who have similar names.
- **Session summary null guard** — View Summary button in the dashboard now guards
  against a null `userId` before fetching results.
- **CURRENT_YEAR** — personal bests page now derives the season year from the
  system clock rather than a hardcoded 2026 constant.

## [0.2.0.1] - 2026-04-23

### Fixed
- **Google OAuth registration loop** — new players completing registration via Google
  sign-in were stuck in an infinite loop ("No player profile found") because the
  `players` table had no RLS INSERT policy for self-registration. Added
  `Players can insert own profile` and `Players can update own profile` RLS policies.
  Profile save errors are now surfaced in the UI rather than silently swallowed.

## [0.2.0.0] - 2026-04-22

### Added
- **Family accounts** — parents can add whānau profiles from the dashboard and submit
  scores on their behalf during sessions. The "Submitting as" switcher in the live
  session view makes it easy to record results for each family member. Division is
  set automatically based on age, with a gender toggle for adult family members.
- **Automatic point calculation** — session points are now awarded automatically when a
  session closes (either by judge or by the 100-minute timer). The trigger runs
  placement scoring, bonuses, and multipliers and writes to rankings immediately.
- **Sign out button** on the desktop navbar, matching the existing mobile experience.
- **Family accounts DB migration** — `parent_id` column and RLS policies so parents can
  insert, update, and delete their linked child profiles and submit results for them.
- Welcome email task added to P2 backlog.

### Fixed
- Registration now works correctly during live sessions — switched to the SSR-aware
  Supabase client, uses upsert on profile creation, and handles the email-confirmation
  path gracefully.
- Auth callback creates a minimal player profile when an OAuth user signs in without
  completing the registration form (covers the email-confirmation edge case).
- **Point gap calculation** — `v_player_count` now counts distinct players, not total
  result rows. Previously a 5-player session with 10 submitted events per player was
  treated as a 50-player session, giving everyone near-minimum points.
- **Masters Women multiplier** — the ×1.4 branch was unreachable due to ELSIF ordering.
  Masters Women now correctly receive ×1.4 instead of ×1.2.
- Timer in live session no longer makes repeated DB calls after the session ends.
- `handleAddMember` button no longer gets permanently stuck in disabled state if the
  auth check fails.
- Removing a family member now checks for errors before updating the UI.

### Changed
- Legacy `lib/supabase.ts` client deprecated and replaced with a deprecation stub.
  All components now use `supabase-browser.ts` which handles SSR sessions correctly.
