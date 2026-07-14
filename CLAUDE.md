# AllSport — Claude Project Reference

> This document is the source of truth for the AllSport project. Update it after every significant piece of work. Claude should read this at the start of every session.

---

## Project Overview

**AllSport** is a decathlon-style competition sport created in Ōtautahi, Aotearoa (Christchurch, New Zealand). It is a community-led charitable initiative (koha-based) — no set fees, koha only.

**What it is:** Individual players compete across 10 events (one per category) in a 100-minute session. Scoring is placement-based — players submit their scores, placements are calculated automatically, and the lowest total placement score wins.

**Sessions:** Tuesday & Thursday 4:30pm, Saturday 9:00am at AllSport HQ, 26 Carbine Place, Sockburn, Ōtautahi.

**Annual Championship:** Placement-based scoring (lowest total wins). 10 events chosen by community vote. 2027 Championship target date: Sunday 14 March 2027.

---

## Mission

AllSport exists to make sport and exercise accessible to everyone in Aotearoa. AllSport is created and shaped around addressing the most common barriers people experience with getting regular exercise and engaging with sport. We use a koha model so anyone can participate regardless of financial circumstance. We draw from every sport and discipline to expose players to the full breadth of physical activity. And we collaborate with local sports clubs so that more people benefit from more sport.

Through this model, AllSport aims to improve public health, build connected communities, and prove that sport can be built differently.

**Mahi. Mauri. Mana.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Inline styles + CSS classes in globals.css |
| Fonts | Bebas Neue, Barlow, Barlow Condensed (Google Fonts) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Hosting | Vercel — https://all-sport-psi.vercel.app |
| Dev tools | Claude Code + gstack |

**Supabase project URL:** https://pvutdyosuhpwnklrpczu.supabase.co

**GitHub repo:** github.com/Teatuataane/allsport

**Local project path:** ~/allsport

**Start dev server:** cd ~/allsport && npm run dev then open http://localhost:3000

---

## Design System

### Colours

```css
--red: #EA4742        /* Primary accent */
--amber: #F9B051      /* Secondary accent */
--pink: #F397C0
--purple: #B87DB5
--blue: #2371BB       /* Primary brand blue */
--green: #4DB26E
--black: #000000
--dark: #0a0a0a
--surface: #111111
--border: #1e1e1e
--white: #ffffff
--grey: #888888
```

### Rainbow gradient
```css
linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)
```

### Fonts
- **Bebas Neue** — all headings
- **Barlow** — body text
- **Barlow Condensed** — labels, tags, uppercase UI text

### Design Principles
- Dark backgrounds throughout
- Rainbow stripe at top of navbar (5px, `var(--rainbow)`)
- Logo in navbar (left) and hero (right, floating)
- No emoji in UI — rainbow ticks/dots and the crest carry the energy
- Pill buttons (Barlow Condensed uppercase), 16px-radius cards with hairline borders, optional rainbow top stripe

### Tokens & UI kit (July 2026 session 19)
- `app/globals.css` `:root` is the single source of truth for tokens — canonical brand palette (matches this doc), semantic colours, `--rainbow`, `--grade-*` colours, `--font-display/body/label`, radii, shadows/glows, motion. Legacy aliases (`--gold`, `--surface2`, `--font-bebas`, grade short names like `--whero`) are kept for older pages — use the canonical names in new code.
- `components/ui.tsx` — shared brand primitives: Button, Card, Badge, Tag, Input, Select, Dialog, RainbowText, RainbowRule, SectionLabel, StatBlock, plus `buttonStyle`/`inputFieldStyle` helpers and the `RAINBOW` const. Use these (or the `.btn`/`.tag`/`.rainbow-*` classes in globals.css) instead of ad-hoc inline styles for new UI.

---

## The Sport — Key Rules

- **Format:** Individual — no teams
- **Events per session:** 10 (one drawn from each of 10 domains)
- **Session length:** 100 minutes
- **Scoring:** Placement-based. Lowest total placement score wins.
- **Ties:** Shared placement awarded
- **Player limits:** Minimum 1, maximum 100 per session
- **Result validity:** Must be filmed or witnessed by a judge

### Domain Display Order

| # | Domain | Events |
|---|--------|--------|
| 1 | Maximal Strength | 1A Press, Deadlift, Clean & Press, Pause Dips, Pause Chin Up, Pause Squat, Zercher Dead, Ham Curl, Pause Bench, Turkish Get Up, Sandbag to Shoulder |
| 2 | Calisthenics | 1 Leg Squat, Flag, Windshield Wipers, Toe Lift, Planche, Back Lever, Iron Cross, Front Lever, Chin Hang, Climbing |
| 3 | Power | Kelly Snatch, 1A Snatch, Triple Jump, Javelin, Shotput, Australian Football, Vertical Jump, Handbalance, Clean & Jerk, Snatch |
| 4 | Speed | 100m Sprint, Tag, T-Race, 400m Race, Beach Flags, 50m Sprint, 200m Sprint, Touch Rugby, Football Dribble, Repeat High Jump, Rats & Rabbits, Speed Chess |
| 5 | Anaerobic Endurance | Chinup Contest, Pushup Contest, Reverse Hyper, L-Sit Hold, Tibialis Curl, Headstand, Finger Push Up, GHD Situp, Leg Extension, Ab Rollout |
| 6 | Aerobic Endurance | Burpee Broad Jump, Running, Cycling, Ski Erg, Row Erg, Breath Hold, Weighted Carry, Duck Walk, Bronco, Walking |
| 7 | Flexibility | Rear Hand Clasp, Bridge, Forward Fold, Needle Pose, Forward Split, Middle Split, Standing Split, Foot Behind Head, Shoulder Dislocate, Pancake |
| 8 | Body Awareness | Tae Kwon Do, Breakdancing, Trampolining, Jump Rope, Wrestling, Gymnastics, Balance Ball, SKATE, Fencing, Juggling, Foot Juggling |
| 9 | Coordination | Volleyball, Baseball, Teqball, Tennis, Cricket, Badminton, Basketball, Football, Hockey, Squash |
| 10 | Aim & Precision | Netball, Bocce, Dodgeball, Carrom, Archery, Kubb, Bowling, Darts, Disc Golf, Golf, Ultimate Frisbee |

### Domain renames / reorder (June 2026)
- "Relative Strength" (was #2) → **Calisthenics** (#2) — name change only
- "Power" (was #5) → **Power** (#3) — renumbered
- "Speed & Agility" (was #7) → **Speed** (#4) — name + renumbered
- "Muscular Endurance" (was #3) → **Anaerobic Endurance** (#5) — name + renumbered
- "Flexibility & Mobility" (was #4) → **Flexibility** (#7) — name + renumbered
- "Co-ordination" (was #9) → **Coordination** (#9) — name only

### Event renames / changes (from previous names)
- "T-Test" → **T-Race** (sport/win-loss input mode)
- "Chin Lift" → **Chin Hang**
- "Turkish" → **Turkish Get Up** (strength mode, no tiers)
- "Toe Lift" → **Toe Lift** (strength mode, no tiers)
- "Pause Dips" → **Pause Dips** (`difficulty+reps` D1–D5; D5 = Weighted RTO Dip, weight-scored)
- "Pause Chin Up" → **Pause Chin Up** (`difficulty+reps` D1–D5; D5 = Weighted Chinup, weight-scored)
- "Ham Curl" → **Ham Curl** (`difficulty+reps` D1–D5, was `strength`)
- "50m Hand Walk" → **Hand Walk** (`difficulty+time` D1–D4; D3 = Wall Handstand Walk)
- "Hand Walk" → **Handbalance** (June 2026 session 18 — slug stays `hand-walk` so history survives). Tiers renamed for clarity: D1 Pushup Hold, D2 Elevated Pushup Hold, D3 Wall Handstand, D4 Freestanding Handstand. Stays a hold event (longer time wins).
- "Cornhole" → **Bocce** (sport mode)
- "Bowling" → **Kubb** (sport mode)
- "Sprint Repeats" → **Bronco** (`difficulty+time` D1–D3)
- "30-15 Test" → **Walking** (`difficulty+time` D1–D3)
- "OHP" → **Clean & Press** (`strength` mode, slug: `clean-and-press`)
- "Reverse Hyper" → now `difficulty+time` *(was `difficulty+reps`)*; D2 renamed from "Back Extension" to "Back Extension Hold"
- **Weighted Carry** — tiers changed from bodyweight multiples (x0.25/x0.5/x1 BW) to fixed weights D1–D6: "5kg — 200m" through "100kg — 200m". Distance always 200m.
- **Shoulder Dislocate** — changed from `difficulty+time` D1–D4 (grip-width tiers) to repurposed `strength` mode: cm measurement, no tiers. See Difficulty Tiers note.
- Domain 6 completely redesigned — see Domain Display Order above. Old slugs (1k-run, sprint-repeats, 30-15-test, etc.) are legacy/orphaned in session history.

### New events added (June 2026)
- **Foot Juggling** → Body Awareness, `difficulty+reps`, D1: 1 Bounce (one bounce allowed between touches), D2: No Bounce (pure keepy-uppies); slug: `foot-juggling`
- **Ultimate Frisbee** → Aim & Precision, `sport` mode (win/draw/loss); replaces Handball (fully removed — historical results unaffected, event name stored as string); slug: `ultimate-frisbee`
- **Rats & Rabbits** → Speed, `sport` mode; 1v1 reaction game, first to 3 wins (win by 2); slug: `rats-and-rabbits`
- **Speed Chess** → Speed, `sport` mode; 3 min each, half pieces (trial format — subject to change after trialling); slug: `speed-chess`

**Note:** Domain event pools are no longer capped at 10. Pools can grow freely — one event is still drawn per domain per session.

### New events added (June 2026 session 16)
- **Sandbag to Shoulder** → Maximal Strength, `difficulty+reps`, D1–D6 (5/10/25/50/80/100kg); slug: `sandbag-to-shoulder`. Bar set at player's shoulder height; one rep = sandbag fully clears bar and lands on other side; player moves around to retrieve.

### Bug fixes & changes (June 2026 session 18)
- **Hand Walk → Handbalance** rename (see Event renames above).
- **Timed-effort events now rank by FASTEST time** — `difficulty+time` carries two semantics: HOLDS (longer time wins) and TIMED EFFORTS (faster time wins). Previously every `difficulty+time` event ranked longer time as better, so e.g. Running 4:20 beat 4:19. The 10 timed-effort events (Running, Cycling, Ski Erg, Row Erg, Weighted Carry, Bronco, Walking, Burpee Broad Jump, Climbing, Repeat High Jump) now rank faster as better. Rule: a higher difficulty tier always outranks a lower one; within a tier, faster wins. See "difficulty+time encoding" below. **Duck Walk is intentionally excluded** (mixed hold + walk tiers) — pending tier redesign (see What's Next).
- **Overall placement fix** — the points trigger now ranks each scored player across EVERY session event; a missed event = last place in the division (= number of players in that division who played the session). Previously only scored events were summed, so playing fewer events gave an unfairly low (better) total.
- **Points doubling fix** — production was running a stale award function that summed `points_earned` (duplicated across every event row); season total is now placement + effort, added once. Fixed in migration `20260629_fix_placement_and_timed_events.sql`.
- **Date off-by-one fix** — DATE columns ('YYYY-MM-DD') were parsed as UTC midnight, rendering the previous day in behind-UTC contexts. New `lib/dates.ts` (`parseLocalDate` / `formatNZDate`) parses dates in local time. Applied to all session-date renders.
- **Game review page** — new `/games/[sessionId]` full all-player report (every division, event, score + placement, standings), linked from dashboard session history; any logged-in player. Placements computed live from `raw_score` (so the encoding + missing-event fixes reflect for past games too).

#### difficulty+time encoding
`raw_score = tierIdx * 10000 + within-tier term` (0-based tierIdx). HOLDS use `within-tier = seconds` (more = better); TIMED EFFORTS use `within-tier = 10000 - seconds` (faster = better). Either way a higher tier always outranks a lower one AND a higher `raw_score` is always better, so every ranker (client leaderboard + SQL trigger, both sort `raw_score` DESC) works without per-event branching. Helpers `isTimedEffort` / `encodeDiffTime` / `decodeDiffTime` and the `TIMED_EFFORT_SLUGS` set live in `lib/eventData.ts`. `time_seconds` is still stored raw (un-inverted) for effort-task matching.

### Live session redesign (July 2026 session 19)
- **Player event UI redesigned** — the 2-column collapsed event card grid is replaced (for player tabs only) by: a session progress header (10 domain-coloured segments fill as events are scored + "N of 10 events scored" + effort level), an event list split into **"Still to play"** (blue-tinted rows with "Tap to score" chip) and **"Scored"** (score + "Nth in event" division rank on the right), and a **quick-entry bottom sheet** that opens on row tap.
- **Quick-entry sheet** (`QuickEntrySheet` in `scoring/[sessionId]/page.tsx`) — pre-filled from today's best submission (or season PR), big +/− steppers (weight ±2.5kg, reps ±1, time ±5s, strokes ±1), quick-pick chips ("Today · X", "PR · X", "PR +2.5kg"), tier chip selector (replaces `<select>`), W/D/L buttons + opponent quick-pick chips (other players with results this session) for sport mode, submit button restates the exact score ("Submit — 120kg × 3"). Sheet also contains Today's best / Season PR hints, today's submissions (edit/delete), and effort tasks. **HOW TO button** flips the sheet to `howToPerform` + `rules` + full tier list from eventData (graceful "Content coming soon" fallback). Green success toast on submit (see session 20 celebration pass for PR/effort variants).
- **Judge flows unchanged** — Kaiwhakawā + Summary tabs still use the original `EventCard` grid.
- **Shared entry logic extracted** — `computeScoreVals(mode, eventData, EntryVals)` and `submitEntry(...)` (payload build + PR flag + effort credit + insert/update) are now module-scope in `scoring/[sessionId]/page.tsx`, used by BOTH `EventCard` and `QuickEntrySheet` — one code path for all raw_score encodings. (Step toward backlog item "extract scoring into lib/scoring.ts".) Side fix: `reps`-mode weight variations now also store `weight_kg` (previously dropped).
- **Event pictogram system** — new `components/EventIcon.tsx`: renders `/public/event-icons/{slug}.png` as a CSS mask filled with the domain colour (so black Canva silhouette exports work on the dark theme automatically); probes each icon once per page load; falls back to the event's `emoji` until an icon exists. `domainColor(domainNumber)` exported from the same file. All 104 event icons exported from Canva (transparent 1000×1000 RGBA PNGs, named by slug) live in `public/event-icons/` — full coverage, verified rendering through the mask. Note: CSS `mask-image` is fetched with CORS, so icons must stay same-origin (they are — served from /public).
- **Event how-to content drafted** — all 94 events that had `howToPerform`/`rules` = "Content coming soon." now have full drafted content in `lib/eventData.ts` (Deadlift entry was the voice reference; imperative sentences, concrete judge standards, tier/declare rules for tiered events, W/D/L + effort note for sport events). PENDING TĀNE'S REVIEW — flagged as invented/uncertain: Toe Lift (interpreted as weighted toe/forefoot raise), Kelly Snatch (interpreted as single DB/KB ground-to-overhead), Repeat High Jump (rep count assumed kaiwhakawā-set), Australian Football / Tag / Netball (formats deferred to kaiwhakawā on the day). The `PLACEHOLDER_CONTENT` const remains in eventData.ts for future new events.

### Design review celebration pass (July 2026 session 20 — DR-2/3/8/9)
All in `app/scoring/[sessionId]/page.tsx`, player flow only (judge EventCard untouched):
- **[DR-3] Default tab** — logged-in players land on their own player tab (`player-{id}`) instead of the leaderboard; logged-out visitors still default to the leaderboard.
- **[DR-2] Toast variants** — `submitEntry` now returns `{ error, isPR, effortCredit }` (`SubmitOutcome`); the quick-entry sheet threads it through `onSubmitted(label, meta)`. Normal submit keeps the green-edged "Score in — …" toast; a PR gets a gold-edged toast with rainbow top stripe, "NEW PR — {event} — {label}" and a `toastPop` scale-pop animation. Either variant appends "+{n} effort" in purple when the submission earned effort credit.
- **[DR-8] Effort cap moment** — when the session effort level reaches 20/20, a one-time purple toast ("Effort maxed — 20/20") shows; guarded per player per session via localStorage key `allsport_effortmax_{sessionId}_{playerId}`.
- **[DR-9] Full-house pulse** — when all session events are scored, a one-time shimmer sweeps the progress-segment bar and "— All 10 events played" appends to the progress label (label persists; shimmer guarded via `allsport_fullhouse_{sessionId}_{playerId}`).
- Both one-time moments are detected in a results-watching effect (fires only for the viewing player, skipped once sessionEnded).
- **[DR-6] New-event-unlocked toast** — the player's all-time played-event-name set loads once per player (results joined to session_events); a submission for a never-before-played event gets a blue "New event unlocked — {event}!" toast. Precedence: PR variant > new-event > normal green.
- **[DR-10] Placement-change flash** — the banner tracks the previous division rank in a ref; when a new result improves it, the ordinal briefly animates "3rd → 2nd" (`rankImprove` keyframe). No animation on first paint, player switch, or rank drops.

### Session-end takeover (July 2026 session 20 — DR-1/7)
- **[DR-1] Full-screen session-end moment** — `SessionEndTakeover` in `scoring/[sessionId]/page.tsx` replaces the payoff the session-19 redesign removed. Shows when `sessionEnded` is true, the viewer has ≥1 result, and it hasn't been dismissed (localStorage `allsport_postgame_{sessionId}_{playerId}` — the old popup's pattern; the red "Session Ended" box still renders behind it). Content: final division placement (big ordinal), placement/effort/total points, PRs set today (`is_pr` rows), colour progress bar animating the session's points in (same GRADES thresholds as the dashboard), and a "Full game report →" link to `/games/{sessionId}`.
- **Points source** — prefers the trigger-written `session_player_summary` row; if it isn't there yet, computes client-side (placement pts = `max(100 − (100/nDiv)×(rank−1), 10)` from the live `myDivisionPlacement` maths, effort pts = level×5) and labels the numbers "Provisional".
- **[DR-7] Session-count milestones** — 10th/25th/50th session (counted from `session_player_summary`; +1 if this session's row isn't written yet). The 10th-session message says the player's referrer just earned a qualified referral.
- `myDivisionPlacement` memo now also returns `playerCount` (division pool size) for the client-side points fallback.

### Nine-item improvement pass (July 2026 session 22)
- **×2 games/points bug — ROOT CAUSE FOUND**: `20260429_v2_clean_schema.sql` created a second trigger `on_session_end` (no WHEN clause) calling `award_session_points()`; every later migration only dropped/recreated `auto_award_points`, so both triggers fired on every session close since late April → `rankings.total_sessions` +2 and points added twice per session. `results.points_earned` and `session_player_summary` stayed correct (idempotent upserts). Fix migration `20260713_fix_double_award.sql`: drop the orphan, atomic claim guard (function stamps `points_awarded_at` FIRST and exits if already stamped), rebuild 2026 rankings from summaries. This also explains why the session-18 "points doubling fix" appeared to regress.
- **Bowling added** (105 events total) — Aim & Precision, `sport` mode W/D/L head-to-head over set frames; slug `bowling`; emoji fallback 🎳 (Canva icon PNG still to export). Pre-May-2026 "Bowling" history (renamed to Kubb back then) re-attaches to this event's PR history by name — harmless.
- **Breath Hold → `hold` mode** (longer wins) + effort task = 80% of PR; **Duck Walk → all-walk tiers** D1–D5 (10m/25m/50m/100m/200m), joined `TIMED_EFFORT_SLUGS`. Historic raw_scores re-encoded by `20260713b_breath_hold_duck_walk.sql`. `time` input mode now has zero events (kept in the type).
- **Tier names shortened** (73 renamed) — tier chips no longer repeat the event name or carry judge criteria; new optional `detail` field on `DifficultyTier` holds the criteria, rendered in the quick-entry sheet HOW TO tier list and on /events/[slug]. NOTE: `results.difficulty_tier` stores the NAME string, so pre-rename rows display their old stored labels (fine) but won't match `findIndex` tier lookups (same accepted trade-off as the Handbalance rename).
- **Selwyn Winter Jam recap** — /schedule block converted from advert to results recap with division champions (derived from the 2026-07-03 session `e032cb24-…`, the Jam stored a day early by the old UTC date bug): Men's kiwigyver, Women's Meredith & Clairebear (shared 1st), Masters Men Blair, Masters Women Jing.
- **Skill rating system (`lib/rating.ts`)** — multiplayer Elo: each session-event = mini tournament within the unified division pools (men / women / juniors, matching the live leaderboard); pairwise updates, K=64 split across the field; ratings ALWAYS recomputed client-side from full history (idempotent by design — no DB triggers). Displayed only as a 0–100 skill score = expected win probability vs an average player (50 = average; 100 needs sustained dominance; unplayed = 0). Solo fields count a play but move nothing. Unit tests in `__tests__/rating.test.ts`. `lib/fetchAll.ts` pages Supabase queries past the 1000-row cap.
- **My 100 → player stat card** — header stat row (Wins · Avg Place · Events), domain coverage dots + per-domain 0–100 skill score, top-event line; tap opens a full-screen **My Stats modal** (headline stats, top event/domain cards, per-domain skill bars + coverage, explainer, link to /prs). Wins = sessions finished 1st in division (`results.placement = 1`, distinct sessions; placement has meant overall division rank since 20260514, older rows are NULL so wins can only undercount).
- **/leaderboard columns** — Avg Place column replaced by **Wins**, **Top Domain**, **Top Event** (Elo-derived, lifetime; wins are current-season). Also fixed a latent bug: rankings query now filters `season_year = current year` (previously all seasons' rows were listed together). Explainer copy updated.
- **Wellbeing survey** — quarterly check-in (≤1 per 91 days per player, baseline on first prompt) using validated instruments: WHO-5 (5 items, 0–5, score ×4 = 0–100) + HBSC 60-min activity days item + single-item self-rated fitness + 3 Voice-of-Rangatahi-style items (confidence / enjoyment / belonging, 1–5 agree). `WellbeingSurvey` card on /dashboard (renders only when due; family-member profiles supported via parent RLS), full-screen form, private-by-design; `WellbeingReport` on /judge shows quarterly aggregates (all / rangatahi / adults cohorts, <3 respondents suppressed) + CSV export via `get_wellbeing_report()` SECURITY DEFINER RPC. Migration `20260714_wellbeing_survey.sql`.

---

## Scoring, Points & Bonuses

### Points Formula
- 1st place always = 100 points
- Gap = 100 / players (no floor on gap)
- Minimum earn = 10 points (bottom players all receive 10)
- Players who joined a session but submitted no score for an event are ranked **last** for that event

| Session Size | Gap | Example |
|---|---|---|
| 5 players | 20 pts | 100/80/60/40/20 |
| 10 players | 10 pts | 100/90/80/70/60/50/40/30/20/10 |
| 100 players | 1 pt | 100/99/98/.../11/10/10/10 (bottom 10 all get 10) |

### Effort Points

Players earn effort points by completing additional volume work **during the session**, on top of their competition score. Effort points are added to the player's **Colour System total** (same bucket as placement points and bonuses).

**Session cap:** 100 effort points maximum per session (= effort level 20 × 5 pts). Cap is effort level 20 (= 100 pts at 5 pts each). Hitting the cap triggers a congratulatory notification in the UI.

**Per qualifying submission: +5 points.**

Tasks are generated from whichever is higher: the player's comp score this session or their all-time PR for that event.

#### One repeatable task per event

| Mode | Repeatable Effort Task |
|---|---|
| `strength` | 5 reps at 80% of PR weight |
| `difficulty+time` (non-D6) | Hold -1 tier for 2 min |
| `difficulty+time` (D6) | Complete half-distance at 80% pace (or same distance if D1) |
| `difficulty+reps` | One set at 80% of PR reps, same tier |
| `time` | Each effort at ≥80% of PR time |
| `sprint` | Each sprint within 80% of PR pace |
| `distance` | Each attempt ≥80% of PR distance |
| `sport` | Play a game vs a new opponent |
| `score` | Complete an additional 4 holes |

#### Sport / Win-Loss Events
+5 per extra match played (win, loss, or draw all count)

#### Score Events (Golf, Disc Golf)
+5 per additional 4-hole round

#### UI — Event Module (Live Session Screen)
Each event module displays: event name + icon, player's highest score this session, and **effort level** (0, 1, 2, 3...) = count of qualifying submissions. All submissions (comp + volume) visible within the module.

#### Storage
Effort submissions stored in a separate `effort_scores` table (not `results`). See Database Schema.


## Difficulty Tiers

Events with multiple difficulty variations use a tier system (D1 = easiest). Tiers are purely informational — they do not affect scoring. Players declare which tier they attempted.

Stored in `results.difficulty_tier` (TEXT).

Full tier data defined in `lib/eventData.ts`. Summary:

| Event | Tiers |
|---|---|
| Windshield Wipers | D1–D4 |
| Reverse Hyper | D1–D4 |
| Forward Fold | D1–D5 |
| Planche | D1–D7 |
| Front Lever | D1–D6 |
| Back Lever | D1–D7 |
| Iron Cross | D1–D6 |
| Flag | D1–D7 |
| L Sit Hold | D1–D5 |
| Headstand | D1–D5 |
| Finger Pushup | D1–D7 |
| Climbing | D1–D5 |
| Bridge | D1–D6 |
| Needle Pose | D1–D6 |
| Standing Split | D1–D6 (+ hold time in seconds) |
| Foot Behind Head | D1–D6 |
| Weighted Carry | D1–D6 (5kg/10kg/25kg/50kg/80kg/100kg, all 200m) |
| Sandbag to Shoulder | D1–D6 (5kg/10kg/25kg/50kg/80kg/100kg) |
| Jump Rope | D1–D5 |
| Gymnastics | D1–D8 |
| Juggling | D1–D4 |
| Foot Juggling | D1–D2 (D1: 1 Bounce, D2: No Bounce) |
| Ab Rollout | D1–D5 |
| Chin Hang | D1–D6 |
| Breakdancing | D1–D6 |
| 1 Leg Squat | D1–D6 |

Events without tiers (objective measure): all lifts, sprints, throws, jumps, rows, runs, cycles, sport/racket events, aim events, Toe Lift, Turkish Get Up, Shoulder Dislocate, F Split, M Split.

F Split and M Split use distance input mode (block height from ground in cm).

**Shoulder Dislocate** — repurposed `strength` mode: grip width stored in `weight_kg` (cm), reps in `reps`, raw_score = −grip_width_cm (narrower = higher score = better rank). UI label reads "Grip width (cm)" not "Weight (kg)". PR display shows Xcm. Effort task: ≤80% of PR grip width (cm) for 5 reps. No difficulty tiers.

---

## Divisions

| Division | Label | Eligibility |
|---|---|---|
| Men's | Men's | Male competitors aged 17–39 |
| Women's | Women's | Female competitors aged 17–39 |
| Juniors | Juniors (U17) | All competitors aged 16 and under — leaderboard shows age-group winner badges (U10/U12/U14/U16) |
| Masters Men | Masters Men (40+) | Male competitors aged 40–59 |
| Masters Women | Masters Women (40+) | Female competitors aged 40–59 |
| Grandmaster Men | Grandmaster Men (60+) | Male competitors aged 60+ |
| Grandmaster Women | Grandmaster Women (60+) | Female competitors aged 60+ |

The live session leaderboard has **no "All-Divisions" combined competitive tab**. The first tab is always **"Effort Level (All-Divisions)"** (effort leaderboard, all divisions). Division tabs (competitive) only appear when at least one player from that division has submitted a score.

---

## Colour System (formerly "Grade")

The section is called **"Colours"** throughout the app. Resets each January. History kept permanently.

| # | Te Reo | Colour | Hex | Points |
|---|---|---|---|---|
| 1 | Mā | White | #ffffff | 0–499 |
| 2 | Kiwikiwi | Grey | #888888 | 500 |
| 3 | Whero | Red | #EA4742 | 1,000 |
| 4 | Karaka | Orange | #F9B051 | 2,000 |
| 5 | Kōwhai | Yellow | #F9E051 | 3,000 |
| 6 | Kākāriki | Green | #4DB26E | 4,000 |
| 7 | Kahurangi | Blue | #2371BB | 5,000 |
| 8 | Poroporo | Purple | #B87DB5 | 6,000 |
| 9 | Uenuku | Rainbow | gradient | 8,000 |
| 10 | Taniwha | Black | #000000 | 10,000+ |

Taniwha = Black = singular peak grade = equivalent to black belt.

**Progress bar:** fills in the current colour, resets at each threshold. Layout: `[Te Reo name] [████░░░] [Next Te Reo name — Xpts to go]`

**Year tabs:** Only show years where the player has ranking data with points > 0. No 2024 tab (no colours were awarded). 2025 tab only shows for: Tane Clement, Zeke Stokes, Rodrigo Gomez, Salvador Gomez.

---

## Koha System

Two paths to any tier — donate OR earn through referrals (either path alone is sufficient).

| Tier | Reward | Koha donation | Referral path |
|---|---|---|---|
| 1 | Name on supporters wall | Any koha | 1 qualified referral |
| 2 | Digital certificate | >$50 | 3 qualified referrals |
| 3 | Sticker pack + certificate | >$200 | 6 qualified referrals |
| 4 | Grading T-shirt | >$500 | 12 qualified referrals |
| 5 | AllSport clothing stack | >$2,000 | 25 qualified referrals |
| 6 | Personal coaching — 50 sessions/year | >$5,000 | 50 qualified referrals |
| 7 | AllSport comes to you (corporate) | >$10,000 | Corporate path only — no referral equivalent |

**Qualified referral:** a friend the player invited who has completed 10 AllSport sessions.

IRD 33% tax rebate applies to all koha.

---

## Referral System

**Purpose:** Systematic player growth. Current players earn Koha tier recognition by inviting friends who stick.

**Mechanic:**
- Every player has a unique 6-character referral code stored in `players.referral_code` (auto-generated on registration)
- Shareable invite link: `allsport.nz/join/[CODE]`
- `/join/[code]` landing page: introduces AllSport, shows "You've been invited by [display name]", single Register CTA with code pre-filled
- Registration captures referral code → stored in `referrals` table
- Referral qualifies when referred player's session count hits 10
- Referrer's koha tier advances based on qualified referral count (alternative path to donation)

**Dashboard integration:** "Invite Friends" section on /dashboard shows code, one-tap copy link, pending referrals (< 10 sessions), qualified count, progress to next Koha tier.

**DB tables:**
- `players.referral_code` TEXT UNIQUE — auto-generated 6-char alphanumeric code, set on registration
- `referrals`: id, created_at, referrer_id (→ auth.users), referred_id (→ auth.users), session_count (INT default 0), qualified_at (TIMESTAMPTZ null — set when session_count hits 10)
- Trigger on `session_player_summary INSERT`: find the new player's referrer row, increment session_count, set qualified_at if threshold reached

**Notification:** referrer gets an in-app notification when a referral qualifies (session 10 of the referred player).

---

## Funding Campaign

**"Wheels for AllSport" — Vehicle & Trailer Fund.** Displayed as a campaign block at the top of /koha.

**Target:** $8,000

**Milestones:**
- $1,000 — First Event Kit (cones, bibs, measuring equipment)
- $3,000 — Trailer deposit
- $8,000 — Full goal (trailer + equipment mobility)

**Implementation:** Hardcoded campaign display initially; `campaign_amount` updated manually via Supabase dashboard. No DB table needed until multiple campaigns exist.

**Why this matters:** Equipment mobility unlocks park sessions, club partnership activations, and ultimately doubles or triples our session capacity.

---

## Club Partnerships

**Model:** AllSport runs a session at a partner club's facility. The club's sport is always included as one of the 10 events (giving their community a confident entry point). In exchange, AllSport gains access to their facilities and equipment for public sessions.

**Partners DB table:** `partners` — id, created_at, club_name, sport, description, website_url, logo_url, is_active (BOOLEAN), display_order (INT)
RLS: public read, judge write.

**Visibility in app:**
- `/supporters` page — two sections: Koha supporters wall (existing), Partner Clubs (new card grid)
- `/schedule` — partner badge appears on sessions hosted at a partner venue (`sessions.partner_id` FK to partners)

---

## User Roles

| Role | Access |
|---|---|
| player | Register, submit scores, view leaderboard, manage profile |
| judge | All player access + create/end sessions, edit/delete any score, assign judges |

**Assign judge role:**
```sql
update players set role = 'judge' where id = '[uuid]';
```

**Current judges:** Tane Clement (a33204ba-47ed-490b-a565-86e121f8c626)

---

## Pages & App Status

| Page | Route | Status | Notes |
|---|---|---|---|
| Home | / | Complete | Hero, ethos, colours, CTA. Colour progression section is a "My Colour History" button for logged-in players |
| How To Play | /how-to-play | Complete | Rules, scoring, 10 domains. Links to /events |
| Events Index | /events | Complete | All 100 events grouped by domain, links to detail pages |
| Event Detail | /events/[slug] | Complete | Template page: how to perform, rules, tiers, personal best |
| Schedule | /schedule | Complete | Times correct (4:30pm Tue/Thu, 9am Sat), Championship 14 Mar 2027 |
| Leaderboard | /leaderboard | Complete | Real data, All-Divisions tab, active session live banner |
| Koha | /koha | Complete | Tiers, IRD rebate |
| Play | /play | Complete | Login/register landing, Google OAuth |
| Register | /register | Complete | 3-step form, division, display prefs, junior parent fields |
| Login | /login | Complete | Email + Google OAuth |
| Dashboard | /dashboard | Complete | Bento grid: Judge card (judge-only), Vote card (when active), Player Profile card, Colours card (points history on click), Personal Bests card, My 100 card (lifetime event coverage, taps to /prs), Join a Game card (next-session countdown when idle) |
| Judge Panel | /judge | Complete | Dedicated page — JudgeCard moved here. Create/end/void sessions, QR code, history, real-time player count, Event Votes panel (Kōwhiringa Tūāhuatanga). Judge bento card on dashboard links here. |
| Player Profile | /profile | Complete | Icon picker (20 sport emojis), username/display name editing, leaderboard display prefs, family member management (add/remove), active profile switcher (localStorage) |
| Scoring Setup | /scoring | Complete | Select 10 events, editable start time, create session |
| Live Session | /scoring/[sessionId] | Complete | Per-division leaderboard tabs, Kaiwhakawā mode (player picker + score/edit/delete for any player), difficulty tier selector, sport W/D/L display, missing scores = last place, post-game popup on session end |
| Personal Bests | /prs | Complete | All 100 events, PR per event, expandable history, this season + previous seasons tabs |
| Vote | /vote/[voteId] | Complete | Step-by-step voting flow, one domain per screen, partial save, review screen, locked on submit |
| Vote Results | /vote/[voteId]/results | Complete | Spoiler-free until voted, bar chart per domain, counts only while open / percentages on close, judge full breakdown |
| Game Review | /games/[sessionId] | Complete | Full all-player game report — every division, every event with score + placement, division standings. Linked from dashboard session history. Any logged-in player. Placements computed live from raw_score |
| Auth Callback | /auth/callback | Complete | Google OAuth handler |
| Invite Landing | /join/[code] | Planned | Public page — introduces AllSport, shows inviter name, Register CTA with referral code pre-filled |
| Supporters | /supporters | Planned | Two sections: Koha supporters wall + Partner Clubs card grid |
| Koha (enhanced) | /koha | Planned update | Add "Wheels for AllSport" campaign block at top — progress bar, milestone markers, target $8,000 |

---

## Database Schema

### event_votes
id, created_at, created_by (uuid → auth.users), name, event_date (DATE), voting_closes_at (TIMESTAMPTZ), is_active (BOOLEAN), nominations_per_domain (INTEGER, 2–10)

### event_vote_nominations
id, created_at, vote_id (→ event_votes ON DELETE CASCADE), domain_number (1–10), domain_name, event_name

### event_vote_responses
id, created_at, vote_id (→ event_votes ON DELETE CASCADE), player_id (→ auth.users), domain_number (1–10), chosen_event (TEXT), is_final (BOOLEAN)
UNIQUE(vote_id, player_id, domain_number)

### players
id, created_at, full_name, email, phone, date_of_birth, address, city, region, country,
parent_name, parent_email, parent_phone, is_active, username, division,
role (default: player), show_full_name, show_username, show_division, show_location, display_name,
bodyweight_kg, parent_id (uuid, references auth.users.id),
icon (TEXT — emoji placeholder; null = show initial letter),
referral_code (TEXT UNIQUE — 6-char alphanumeric, auto-generated on registration)

### referrals
id, created_at, referrer_id (uuid → auth.users), referred_id (uuid → auth.users),
session_count (INT default 0), qualified_at (TIMESTAMPTZ null — set when session_count = 10)
UNIQUE(referred_id) — each player can only have one referrer
Trigger on session_player_summary INSERT: increment session_count for referred player's referrer row; set qualified_at when threshold reached.

### partners
id, created_at, club_name (TEXT), sport (TEXT), description (TEXT), website_url (TEXT),
logo_url (TEXT), is_active (BOOLEAN default true), display_order (INT default 0)
RLS: public read; judge write.

### sessions
id, created_at, session_date, start_time, location, max_participants, duration_minutes,
is_tournament, is_championship, is_active, started_at, ended_at, session_code, notes,
points_awarded_at, partner_id (uuid → partners null — set when session is hosted at a partner venue)

### session_events
id, created_at, session_id, domain_number, domain_name, event_name

### results
id, created_at, player_id (nullable), session_id, event_id, score, points_earned,
rank_in_session, notes, player_name, raw_score, score_label, placement,
exercise_variation, weight_kg, reps, time_seconds, pose_variation,
opponent_name, match_score, result_type,
difficulty_tier (TEXT — tier name string or null)

### effort_scores
Dropped (migration 20260507). Effort data lives in results.effort_task_completions.

### session_player_summary
id, created_at, session_id (→ sessions ON DELETE CASCADE), player_id (→ auth.users),
overall_placement (INTEGER — rank in division for that session),
total_placement_points (INT), effort_points (INT), effort_level (INT)
UNIQUE(session_id, player_id)
Populated by award_session_points trigger when session closes. Used by /dashboard points history.
RLS: players see own rows; judges see all.

### rankings
id, updated_at, player_id, total_points, total_sessions, average_score,
best_score, current_rank, division, average_placement, season_year

### Key Logic
- player_id on results is nullable (players can join by name without account)
- Realtime enabled on session_events and results
- RLS enabled on all tables
- Session auto-locks when timer hits zero (is_active set to false)
- Points auto-awarded via trigger when session closes (award_session_points)
- Void session: set points_awarded_at=NOW() before/with is_active=false to skip trigger
- raw_score for time events is stored negative (faster = higher) so rankings sort correctly
- Players who joined a session (have any result row) but have no score for a specific event are ranked last for that event
- Missing score players display as "No score" in expanded event lists
- Input modes: `strength` (weight+reps), `reps`, `time` (mm:ss), `hold` (mm:ss), `distance` (m/cm), `sport` (win/draw/loss + opponent), `sprint` (ss.cs), `difficulty+time` (tier selector + seconds), `difficulty+reps` (tier selector + reps), `score` (stroke count for 4 holes, stored as negative integer)
- `difficulty+time` has two semantics: HOLDS (longer time wins) and TIMED EFFORTS (faster time wins, `TIMED_EFFORT_SLUGS` in eventData.ts). Encoding inverts the within-tier term for timed efforts so `raw_score` DESC always means "better" — see difficulty+time encoding note above. Duck Walk excluded (mixed tiers, pending redesign)
- Sprint mode: seconds + centiseconds (0–99), raw_score = -(secs*100 + cs). Used for 100m/50m/200m Sprint (T-Race now uses sport mode)
- Score mode: stroke count for 4 holes, raw_score = -strokes (negative; fewer strokes = higher raw_score = better rank). Used for Golf and Disc Golf.
- Gap formula: 100 ÷ players with NO floor on gap; minimum earn of 10 applies to awarded points only (not the gap)
- Effort points: stored in results.effort_task_completions (int, per row); trigger formula: LEAST(participation + is_pr_events + task_completions, 20) × 5 = max 100 pts; feeds Colour System total alongside placement points; hitting cap triggers congratulatory UI notification
- Bonus system removed — replaced entirely by effort system; total session points = placement_points + effort_pts only
- Effort task generation: uses higher of comp score or all-time PR for that event; tiered events use ×1.5/×2.0/×3.0 time multipliers stepping down difficulty tiers (D-1, D-2, D-3); when tiers exhausted substitute same tier at ×0.5 time working backwards
- Effort matching (tiered events): tier must match exactly, time ≥ required; harder tier does NOT substitute; players may repeat same intensity, each qualifying submission counts separately
- Pre-session timer: if started_at is in the future, shows purple "until start" countdown. Game clock begins at started_at
- Score submission re-fetches results after upsert (realtime alone misses UPDATEs from re-submissions)
- Post-game popup: triggers on is_active → false, dismissed per player per session via localStorage, viewable in session history thereafter
- All-Divisions = the combined tab (previously called "Overall") — renamed everywhere

---

## File Structure

```
~/allsport/
  middleware.ts                     # REQUIRED — refreshes Supabase session on every request
  lib/
    supabase.ts                     # Basic client (legacy — DO NOT USE in new code)
    supabase-browser.ts             # Browser client (use this in ALL client components)
    supabase-server.ts              # Server client
    eventData.ts                    # Single source of truth for all events (105) + difficulty+time encode/decode helpers (encodeDiffTime/decodeDiffTime/isTimedEffort, TIMED_EFFORT_SLUGS); DifficultyTier has optional `detail` (judge criteria)
    dates.ts                        # parseLocalDate / formatNZDate — parse DATE columns in local time (avoids off-by-one)
    rating.ts                       # Multiplayer Elo skill ratings — computeRatings/eloTo100/domainRatings/topEvent/topDomain/sessionWins (client-side, idempotent full recompute)
    fetchAll.ts                     # Pages Supabase selects past the 1000-row cap
  app/
    page.tsx                        # Homepage — colour progression = "My Colour History" button
    layout.tsx                      # Root layout
    globals.css                     # Design system
    play/page.tsx
    how-to-play/page.tsx            # Links to /events
    schedule/page.tsx
    leaderboard/page.tsx            # All-Divisions tab
    koha/page.tsx
    events/
      page.tsx                      # Event index — all 100 events by domain
      [slug]/page.tsx               # Event detail — how to, rules, tiers, PB
    register/page.tsx
    login/page.tsx
    dashboard/page.tsx              # Bento grid dashboard — 6 cards + points history modal
    judge/page.tsx                  # Judge panel page — wraps JudgeCard, judge-role-gated
    profile/page.tsx                # Player profile — icon picker, editing, family switcher
    prs/page.tsx                    # Personal best history — all 100 events
    scoring/page.tsx
    scoring/[sessionId]/page.tsx    # Live session — banner (div placement + timer), player event list + quick-entry sheet (session 19), judge EventCard grid, leaderboard (3-section, Masters toggle, age chips, event filter)
    games/[sessionId]/page.tsx      # Game review — full all-player report (divisions, events, scores, placements, standings); computed live from raw_score
    auth/callback/route.ts
    join/
      [code]/page.tsx               # Invite landing — shows inviter name, Register CTA pre-filled with referral code
    supporters/page.tsx             # Koha supporters wall + Partner Clubs card grid
    vote/
      [voteId]/
        page.tsx                    # Step-by-step voting flow, one domain per screen, partial save
        results/page.tsx            # Bar chart results, spoiler-free until voted, judge full view
    components/
      JudgeCard.tsx                 # Judge panel — sessions + Event Votes (Kōwhiringa Tūāhuatanga)
      VoteBanner.tsx                # Dashboard banner — vote state + live countdown + CTA
      WellbeingSurvey.tsx           # Quarterly wellbeing check-in — dashboard card (only when due) + full-screen 10-item form
      WellbeingReport.tsx           # Kaiwhakawā aggregate wellbeing report + CSV export (/judge)
  components/
    Navbar.tsx                      # Glass sticky nav, 5px rainbow edge, pill CTAs
    Footer.tsx                      # Rainbow rule, HQ address + session times
    ui.tsx                          # Shared brand UI kit — Button, Card, Badge, Tag, Input, Select, Dialog, RainbowText, RainbowRule, SectionLabel, StatBlock
    EventIcon.tsx                   # Event pictogram tile — CSS-mask of /event-icons/{slug}.png in domain colour, emoji fallback
  public/
    event-icons/                    # Canva silhouette exports, transparent PNG named {slug}.png (see README.md inside)
  supabase/
    migrations/
      20260420_phase1.sql
      20260428_phase2.sql           # difficulty_tier column; updated award_session_points trigger
      20260505_judge_player_management.sql
      20260510_drop_disadvantage_columns.sql
      20260510_per_division_points.sql
      20260512_effort_system.sql
      20260513_drop_effort_scores.sql
      20260513_event_voting.sql     # event_votes, event_vote_nominations, event_vote_responses tables + RLS + functions
      20260514_dashboard_redesign.sql # players.icon, session_player_summary, get_player_top_event RPC, updated trigger
      20260526_fix_points_trigger.sql  # Remove bonus system; fix gap formula — run in Supabase SQL Editor
      20260629_fix_placement_and_timed_events.sql  # Overall placement (missing event = last in division), points-doubling fix, timed-event raw_score re-encode — supersedes 20260526/b; run ONCE in Supabase SQL Editor
      20260707_leaderboard_cleanup.sql  # average_placement trigger + backfill, merge orphaned 'Youth' rankings rows — RUN (confirmed session 22)
      20260713_fix_double_award.sql     # Drop orphaned on_session_end trigger (×2 bug), atomic claim guard, rebuild 2026 rankings — run ONCE in SQL Editor
      20260713b_breath_hold_duck_walk.sql # One-time re-encode: Breath Hold → positive secs, Duck Walk → new walk ladder — run ONCE, after 20260713
      20260714_wellbeing_survey.sql     # wellbeing_surveys table + RLS + get_wellbeing_report() RPC — run in SQL Editor (idempotent)
  public/
    logo.png
```

**IMPORTANT:** Always use createClient() from @/lib/supabase-browser in client components.

---

## What's Complete

- Full public website (5 pages)
- 3-step player registration with Google OAuth
- Player dashboard — Colours progress (bar + year tabs), stats, join by code, session history with View Summary
- Kaiwhakawā panel (JudgeCard) — tabbed (Sessions / Votes / Players); Sessions tab: create/end/void sessions, QR code, real-time player count; Votes tab: Kōwhiringa Tūāhuatanga vote management; Players tab: Tāngata — all players sorted by current-year points, tap to expand session history. Te reo term "Kaiwhakawā" used everywhere in display text (DB role value stays as `judge`)
- Live scoring — 100-event pool, all input modes including difficulty tier selector, Kaiwhakawā edit/delete/score-for-any-player, score edit (pre-fill form + UPDATE), missing scores = last place, post-game popup
- Sport results displayed as W/D/L (Wins/Draws/Losses) everywhere: live session event card + collapsed label, leaderboard expanded row, /prs page, /events/[slug] personal best. Format: "3W 1D 2L"
- Leaderboard competitive rows show "Nth of N" division rank context (e.g. "1st of 3")
- Points trigger fixed (May 2026): removed bonus system (was causing 140pts for 1st instead of 100); fixed gap formula (no floor on gap — min 10 applies to earned pts only). Migration: 20260526_fix_points_trigger.sql
- Live session leaderboard — redesigned (June 2026): three simultaneous sections (Men's, Women's, Juniors); top 3 expandable per section; each top-3 row tappable to show all event scores + placements; logged-in player pinned below top 3 showing actual rank; Masters/Grandmaster toggle per gender section; Junior age-group chips (exact age); event filter dropdown (session events only, replaces overall ranking with event-specific flat list); age + event filters combinable; effort leaderboard removed (effort shown on event buttons only)
- Live session leaderboard — bug fixes (June 2026 session 14): (1) unified Men's pool (Men's + Masters Men + Grandmaster Men ranked together); same for Women's — fixes Masters Women players being invisible; (2) Masters/Grandmaster players show sub-division rank badge alongside overall rank; (3) Masters/60+ chips are now filters within the full pool, not pool switchers; (4) all three sections (Men's, Women's, Juniors) always rendered even with zero scores — show "No scores yet" placeholder; (5) total placement score (sum of ordinal placements, lower = better) shown on every player row; (6) 15-second polling fallback added alongside realtime subscription so leaderboard always auto-refreshes; (7) Judge Summary tab added to Kaiwhakawā — all divisions, all players, all events, delete scores inline, works post-session
- Effort system — effort tasks generated per event, locked until comp score submitted, effectivePR baseline, reps/hold/sport/tiered modes all handled; event button always shows "Effort Level: N"; award trigger correct (×10 per task, cap 100)
- Divisions — 7 divisions with age labels: Men's, Women's, Juniors (U17), Masters Men (40+), Masters Women (40+), Grandmaster Men (60+), Grandmaster Women (60+)
- Post-game popup — placement, per-event breakdown, bonuses, total points, colour progression moment
- Session history — past session summaries accessible from dashboard
- Colour history — accessible from homepage colour progression section (logged-in players)
- Colours section on dashboard — renamed from Grade, conditional year tabs, coloured progress bar
- Event detail pages — /events/[slug] with how-to, rules, difficulty tiers, personal best
- Events index — /events, all 100 events grouped by domain
- Personal bests page — /prs, all 100 events, expandable history, this season + previous seasons
- All-Divisions tab — renamed from Overall everywhere
- T-Race — renamed from T-Test, now uses sport/win-loss input mode
- Chin Hang — renamed from Chin Lift
- Difficulty tiers — defined for all tiered events in lib/eventData.ts
- Disadvantage system removed — dropped from DB, eventData.ts, and all UI (May 2026)
- Domain 6 redesigned — 10 new events (Running, Cycling, Ski Erg, Row Erg, Breath Hold, Weighted Carry, Duck Walk, Bronco, Walking, Burpee Broad Jump) with difficulty+time tiers replacing fixed-distance events
- Domain 1 updates — Pause Dips, Pause Chin Up now difficulty+reps D1–D5 (D5 weight-scored); Ham Curl now difficulty+reps D1–D5
- Hand Walk renamed from 50m Hand Walk; D3/D4 tier names updated
- Weight-scored tier generalised — single isWeightScoredTierByName/Idx helper covers GHD Situp D4, Pause Dips D5, Pause Chin Up D5
- Judge score edit/delete fix — delete confirmation works correctly, leaderboard recalculates immediately
- Supabase SSR middleware, browser client, Google OAuth, RLS, points trigger — all confirmed working
- allsport.nz live domain
- Event voting system — judges create votes (name, event date, close date, 2–10 events per domain nominated), players vote step-by-step (one domain per screen, partial save, locked on final submit), spoiler-free results (hidden until voted, counts only while open, percentages after close), judge full breakdown with voter names; nomination Step 2 uses auto-advance accordion (domain auto-closes and next incomplete domain opens when selection limit hit; 250ms delay for visual feedback; domain 1 open by default; page scrolls naturally — no inner scroll box)
- Design review celebration pass (July 2026 session 20) — [DR-3] players land on their own tab, [DR-2] PR toast variant (+effort credit line), [DR-8] one-time effort-cap toast, [DR-9] one-time full-house shimmer + "All 10 events played" label
- Session-end takeover (July 2026 session 20) — [DR-1] full-screen end-of-session moment (placement, points, PRs, animated colour progress, game report link; localStorage dismissal) + [DR-7] 10th/25th/50th session milestones with referral note on the 10th
- Leaderboard cleanup (July 2026 session 20) — [DR-4] rankings.average_placement now populated by trigger + backfill (migration `20260707_leaderboard_cleanup.sql`), legacy Youth tab removed, Grandmaster tab keys fixed ('Grandmasters …' never matched the DB's 'Grandmaster …' so those tabs were always empty), Felix's duplicate Youth rankings row merged, hero + Colour Key copy corrected (colours are earned the moment a threshold is crossed; points reset each January)
- Dashboard next-session countdown (July 2026 session 20) — [DR-5] Card 8 with no session running now shows "Next session: {weekday} {time}" + "in {n} hours/days" computed from the fixed schedule in NZ time (`nextScheduledSession` in dashboard/page.tsx); active-session Join state unchanged
- "My 100" dashboard card (July 2026 session 20) — [DR-6] lifetime event coverage: 10 domain rows × 10 domain-coloured dots + "{n} of 100 events played", derived from distinct event names on results mapped through eventData EVENTS (legacy orphan names don't match — by design); taps through to /prs. Live session shows a "New event unlocked" toast for first-ever events (PR toast still wins)
- Placement-change flash (July 2026 session 20) — [DR-10] live session banner animates "3rd → 2nd" when a new result improves the player's division rank; no animation on first paint or rank drops

---

## What's Next (In Priority Order)

1. Apply DB migrations to production Supabase (SQL Editor) — Tāne confirmed (July 2026 session 22) all migrations up to and including `20260707` are already run. Still pending, in this order:
   - `20260713_fix_double_award.sql` — **run ONCE**: drops the orphaned `on_session_end` trigger (the ×2 games/points root cause), adds an atomic claim guard to `award_session_points`, and rebuilds 2026 rankings from `session_player_summary` (+ results fallback for pre-summary sessions). Includes a read-only diagnostic block at the top.
   - `20260713b_breath_hold_duck_walk.sql` — **run ONCE, after the above**: flips existing Breath Hold raw_scores positive (hold mode) and re-encodes Duck Walk walk-tier rows to the new all-walk ladder (faster wins). One-time transforms with double-run guards.
   - `20260714_wellbeing_survey.sql` — creates `wellbeing_surveys` table + RLS + `get_wellbeing_report()` aggregate RPC (idempotent).
2. **Felix's date of birth** — DOB is set (2016-12-19). Division was 'Youth' (legacy value); migration `20260617_fix_youth_division.sql` updates all 'Youth' → 'Juniors'. Code also treats 'Youth' as 'Juniors' in both leaderboard pool filters as a fallback.
3. **Breakdancing tiers** — change from `difficulty+reps` to `difficulty+time` with new tier descriptions (awaiting tier content from Tane)
3. **Referral system** — DB migration (referral_code on players, referrals table, trigger), /join/[code] invite landing, dashboard "Invite Friends" section, /koha referral tier display
4. **Funding campaign block** — update /koha with "Wheels for AllSport" campaign section (hardcoded, progress bar, milestones)
5. **Partners page** — DB migration (partners table, partner_id on sessions), /supporters page, partner badge on /schedule
6. Welcome email on registration (Supabase Edge Function + Resend)
7. Kaiwhakawā approval flow (replace manual SQL)
8. Leaderboard icons — add player icon emoji next to name on /leaderboard (deferred until icon system is proven on dashboard; live session leaderboard uses new 3-section layout)
9. Per-event placement storage — add `event_placement` column to results + trigger update, so points history can show "1st in Deadlift" etc. (future enhancement)
10. Designed icon set — replace emoji placeholders with branded SVG icons; infrastructure already in place (players.icon column + icon picker on /profile)
11. Championship registration flow (6 months before March 2027)
12. **Testing suite (deferred)** — extract the scoring logic (raw_score per input mode, placement ranking incl. missing=last, gap/points formula, effort) into a pure `lib/scoring.ts`, point the live session at it, and add vitest unit tests. **Plus** database-level tests (pgTAP or a seeded test DB) that exercise the actual `award_session_points` trigger, since the real placement+points math runs server-side. Goal: catch scoring regressions before a game.
13. ~~Duck Walk tier redesign~~ — DONE July 2026 session 22: all-walk ladder D1–D5 (10m/25m/50m/100m/200m), added to `TIMED_EFFORT_SLUGS`, history re-encoded by `20260713b`. Old D1/D2 hold rows ('Squat Hold'/'OH Squat Hold') are left as legacy — labels intact, ranked below walks.
14. ~~Season-PR direction bug (time/sprint)~~ — FIXED July 2026 session 19: both PR loaders now always take max raw_score (time/sprint store negative seconds, so max = fastest).
15. ~~Breath Hold ranking direction~~ — FIXED July 2026 session 22: now `hold` mode (raw_score = +secs, longer wins); existing rows flipped by `20260713b`; generic hold effort task is now 80% of PR ("Hold for X or longer") instead of a flat 2 minutes.
16. **Review drafted event content (session 19)** — Tāne to review the 94 drafted howToPerform/rules entries in lib/eventData.ts, especially the flagged ones: Toe Lift, Kelly Snatch, Repeat High Jump, Australian Football, Tag, Netball.
17. **July 2026 design review (session 20)** — ~~[DR-2] PR toast~~, ~~[DR-3] default to own tab~~, ~~[DR-8] effort cap moment~~, ~~[DR-9] full-house pulse~~ DONE (Phase 1); ~~[DR-1] session-end takeover~~, ~~[DR-7] session-count milestones~~ DONE (Phase 2); ~~[DR-4] /leaderboard cleanup~~, ~~[DR-5] dashboard next-session countdown~~ DONE (Phase 3 — DB side needs `20260707_leaderboard_cleanup.sql` run in the SQL Editor); ~~[DR-6] "My 100" card + new-event toast~~, ~~[DR-10] placement-change flash~~ DONE (Phase 4). ALL DR ITEMS COMPLETE — only the migration run remains.

---

## Key Decisions

- Koha only — no set fees
- Tagline: Play EVERYTHING
- Te reo Māori identity throughout
- Taniwha = Black = peak grade = black belt equivalent
- Colours reset January, history kept forever — section called "Colours" not "Grade"
- All-Divisions = combined division tab (not "Overall")
- Kaiwhakawā = the correct te reo Māori term for judge/referee in a sports context. Used throughout display text; DB role value stays as `judge` for simplicity
- T-Race (not T-Test) uses sport/win-loss input mode
- Chin Hang (not Chin Lift)
- Difficulty tiers: D1 = easiest, purely informational, stored in results.difficulty_tier as tier name string
- Weight-scored final tiers: GHD Situp D4, Pause Dips D5 (Weighted RTO Dip), Pause Chin Up D5 (Weighted Chinup) — these tiers switch input to weight_kg instead of reps
- "Banded" in tier names (e.g. "Banded Iron Cross", "Banded Front Lever") always means heavy band — no light/medium variants; single tier entry only
- Shoulder Dislocate: repurposed `strength` mode — weight_kg stores grip width in cm, raw_score = −weight_kg (narrower = better rank); UI placeholder "Grip width (cm)"; formatPR shows Xcm; effort task: ≤80% of PR grip width for 5 reps (inverted check: weight_kg ≤ targetCm)
- Sandbag to Shoulder: `difficulty+reps`, D1–D6 (5/10/25/50/80/100kg); slug `sandbag-to-shoulder`; bar at player's shoulder height; one rep = sandbag fully clears bar; player retrieves from other side
- Weighted Carry: tiers updated to fixed weights — D1–D6: "5kg — 200m" through "100kg — 200m" (was bodyweight multiples x0.25/x0.5/x1)
- Handbalance (session 18): renamed from Hand Walk; slug stays `hand-walk` so historical results stay linked. Tiers: D1 Pushup Hold, D2 Elevated Pushup Hold, D3 Wall Handstand, D4 Freestanding Handstand. Hold event (longer time wins)
- Timed-effort events (session 18): 10 `difficulty+time` events rank FASTER as better (Running, Cycling, Ski Erg, Row Erg, Weighted Carry, Bronco, Walking, Burpee Broad Jump, Climbing, Repeat High Jump). Encoding inverts the within-tier seconds term (`10000 - secs`) so `raw_score` DESC still means best everywhere; higher tier always beats lower tier. `TIMED_EFFORT_SLUGS` + `encodeDiffTime`/`decodeDiffTime`/`isTimedEffort` in eventData.ts. Duck Walk excluded (mixed tiers). `time_seconds` stored un-inverted for effort matching
- Overall placement (session 18): trigger ranks every scored player across ALL session events; a missed event = last place in the division (= number of division players who played the session). Fixes "win while playing fewer events". The live leaderboard already penalised missing events client-side; this fixed the server trigger (awarded placement + points)
- Points doubling (session 18): root cause was a stale prod award function summing per-row `points_earned` (duplicated across every event row → ×event count). Corrected trigger computes season total as placement + effort once. Migration `20260629_fix_placement_and_timed_events.sql`
- Dates (session 18): DATE columns parsed in local time via `lib/dates.ts` (`parseLocalDate`/`formatNZDate`) to stop the UTC off-by-one (19th showing as 18th)
- Game review (session 18): `/games/[sessionId]` is a read-only full-game report for any logged-in player; placements computed live from `raw_score` (not the stored placement), so it reflects the encoding + missing-event fixes for past games too; mirrors the trigger's 7-division structure
- Effort task labels (June 2026 session 16): all modes use conversational sentence style — e.g. "Lift ${kg}kg for 5 reps" (was "${kg}kg × 5 reps"), "Achieve at least ${X}m" (was "Throw/jump ≥ X"), "Complete ${targetReps}+ reps at ${tierName}" (was "${n}+ reps at…"), "Complete in X or faster" (was "Hold for X or longer"), "Hold for at least 2 minutes" (was "Hold for 2 minutes")
- Domain 6 events redesigned (May 2026): old events (1k Run, Sprint Repeats, 30-15 Test, etc.) are legacy orphans in session history; new slugs are running, cycling, ski-erg, row-erg, breath-hold, weighted-carry, duck-walk, bronco, walking, burpee-broad-jump
- Domain 10 updated (May 2026): Cornhole → Bocce, Bowling → Kubb
- Domain event pools not capped at 10 (June 2026): no technical limit on pool size; one event still drawn per domain per session; pools can grow or shrink freely
- Handball removed from Aim & Precision (June 2026): replaced by Ultimate Frisbee; historical results unaffected (event name stored as string in results table)
- Rats & Rabbits (Speed): 1v1, caller shouts team name, named player chases, other runs to safe zone; first to 3 wins (win by 2 required); `sport` mode
- Speed Chess (Speed): 3 min each, half pieces; trial format subject to change; `sport` mode
- disadvantage system removed entirely (dropped from DB in migration 20260510, removed from eventData.ts and all UI)
- Disadvantage: self-declared by players, small/large, three options per event per level; multiplier on strength events only (×1.2 / ×1.5)
- Missing scores: players with any result in session but no score for a specific event = last place for that event
- Post-game popup: triggers on session close, dismissed via localStorage, viewable in session history
- lib/eventData.ts is the single source of truth for all 100 events
- Score resubmission: upsert on (player_id, session_id, event_id) — updates existing row
- Time events: raw_score stored as negative seconds so faster = higher
- Void vs End: Void sets points_awarded_at before closing to prevent trigger firing
- middleware.ts is mandatory — without it, Supabase sessions don't persist across page loads
- Event voting: only one active vote at a time; Kaiwhakawā create via JudgeCard at /judge; players vote one domain at a time; partial saves stored with is_final=false; final submit sets all rows to is_final=true; locked after submit; votes have a set close datetime; results hidden until player has voted (spoiler-free); counts shown while open, percentages after close; Kaiwhakawā see full breakdown with names via get_vote_details() SECURITY DEFINER function; players see anonymised bar charts; VoteCard on /dashboard (bento card) shows state (not voted / partial / voted) with live countdown; Kaiwhakawā vote history accessible in JudgeCard; player results access expires when competition begins (event_date); Kaiwhakawā results persist permanently
- DomainAccordion (Step 2 of vote creation): controlled component — open state managed by parent via isOpen/onOpenChange props; no internal useState; auto-advance on completion: domain closes + next incomplete domain opens after 250ms; expandedDomain state in JudgeCard (initialized to 1); do NOT revert to uncontrolled useState(false) in DomainAccordion
- Gap formula: 100 ÷ players, NO floor on gap; minimum 10 pts applies only to the final awarded amount (GREATEST(pts, 10)). Bug was in trigger + client calcPlacementPts — both fixed May 2026.
- Bonus system removed (May 2026): all session bonuses (attendance, PB, top performance, first session, streak, championship) removed from award_session_points trigger. Total = placement_pts + effort_pts only
- Effort points: separate effort_scores table; 100pt session cap (= effort level 20 × 5 pts); +5 per qualifying submission; feeds Colour System total; one repeatable task per event at 80% of PR
- Effort tasks: generated from `effectivePR = max(sessionBest, seasonPR)` — season PRs loaded via bulk results query (NOT the get_player_season_pr RPC which broke on empty event_slug); task shown in expanded card before first submission (greyed out) if season PR known; task rules by mode: strength → 5 reps @80% PR weight; distance Power domain (#3, throws/jumps) → 3 attempts ≥ 80% = 1 task completion; distance other domains → 1 attempt ≥ 80%; time/sprint/reps/hold → 80% of PR; difficulty+time/difficulty+reps → 80% of PR at same tier; sport → 1 extra game vs new opponent; score (Golf/Disc Golf) → 1 extra 4-hole round
- Effort matching: exact tier required for tiered events; harder tier does NOT substitute; repeats allowed; Power throws need 3 qualifying per task completion
- Live session leaderboard: single tab row — first tab always "Effort Level (All-Divisions)" (effort ranking); then division tabs (competitive ranking, lowest total placement = 1st); division tabs only visible if players from that division have scored; expanded player row shows all events with score label + ordinal placement
- Event button collapsed label: always shows "Effort Level: N" (not "— pts")
- Golf and Disc Golf use 'score' mode (stroke count for 4 holes; raw_score = -strokes; lower = better).
- Dashboard uses "bento grid" / "hero card tiles" design pattern — full-width coloured tiles, each card visually distinct, Bebas Neue headings, 16px border-radius
- Navbar (logged-in): Logo + Dashboard + Sign Out always visible; ALL other links hidden in hamburger. Applies globally when user is authenticated. Logged-out state unchanged (desktop links visible).
- Player icons: emoji placeholders (20 icons in players.icon column); icon picker on /profile; future: replace with designed SVG icons and unlockable icons at each Colour threshold
- Active family member profile: stored in localStorage key `allsport_active_player_id`; entire dashboard context (colours, ranking, top event) reflects the active profile; switching on /profile writes to localStorage and navigates to dashboard; player profile bento card shows whose data is active
- Judge panel: moved from inline JudgeCard on dashboard to dedicated /judge page; dashboard judge bento card links there; /judge page is role-gated (non-judges redirected to /dashboard)
- Top event: calculated via `get_player_top_event(player_id, division)` RPC — finds the event where the player's best score ranks highest (RANK() OVER) among all players in their division who have done that event
- session_player_summary: populated by award_session_points trigger; used for /dashboard points history; historical sessions (pre-migration) fall back to calculating from results rows; per-event placement NOT stored in this table (future enhancement: add event_placement column to results)
- Points history: accessed by tapping Colours bento card; shows per-session: date, location, overall placement, effort level, placement pts, effort pts, total; expandable to show events + scores
- Colours bento card: full grade-colour background (e.g. Whero = red card); Taniwha = black + amber border; Mā = light grey + dark text; Uenuku = rainbow gradient
- New player state (zero sessions): Join a Game card highlighted with green glow to guide first action
- Referral system: each player has a unique 6-char referral_code; shareable via allsport.nz/join/[CODE]; qualified referral = referred player has completed 10 sessions; referrer earns Koha tier progression as alternative path to donation; tiers: 1/3/6/12/25/50 qualified referrals for tiers 1–6; Tier 7 (corporate) has no referral path
- Koha tiers: two paths (donate OR referrals) — either path alone unlocks the tier; both paths display on /koha
- Funding campaign "Wheels for AllSport": $8,000 target (trailer + equipment mobility); milestones at $1k, $3k, $8k; hardcoded initially, displayed as campaign block at top of /koha
- Club partnerships: AllSport runs sessions at partner clubs (club's sport always included in the 10 events); in exchange gains facility + equipment access; partners visible on /supporters page and as badge on /schedule; sessions.partner_id links to partners table
- /supporters page: two sections — Koha supporters wall (existing) + Partner Clubs (new card grid with logo, sport, description, website link)
- Budget allocation (2026, $2k): $600 professional content session (photographer/videographer), $300 session materials (banner, cones, tape), $400 sticker pack stock for referral Tier 3 rewards, $700 reserve for first partnership activation
- Live session banner (June 2026): replaces join code display; shows division placement (ordinal) + time remaining side by side; "—" when no scores submitted yet; division label shown as status text above the placement value
- Live session event cards (June 2026): collapsed shows Score / Div rank (event-specific within division, medal colours for top 3) / EL; expanded shows Today's Top Score (own best), Personal Record This Season, All Today's Scores (own submissions); join code removed entirely (feature removed)
- Live session leaderboard (June 2026): 3-section layout (Men's, Women's, Juniors) replaces tab system; no Effort leaderboard; top 3 expandable (taps to show all event scores + ordinal placements); rest expandable via "Show all" button; logged-in player pinned below top 3 with actual rank + "YOU" label; Masters/Grandmaster chips are FILTERS within the full pool (not pool switchers); Junior age chips filter by exact age year group; event filter (session events only) replaces overall ranking with event-specific flat list; age + event filters combinable
- Junior age filter: exact age (year group), not cumulative U-age; computed from players.date_of_birth; chips show only ages present in session; null-DOB Juniors always appear in the section regardless of which age chip is selected
- Junior age-group badges: Juniors pool uses one combined ranking (lowest total placement = 1st overall); age-group winner badges shown as secondary label ("1st U14") using U10 (0–9), U12 (10–11), U14 (12–13), U16 (14–16) brackets; null-DOB juniors get no age-group badge; same pattern as Masters/Grandmaster sub-division labels
- Unified division pools: Men's section = Men's + Masters Men + Grandmaster Men all ranked together; Women's = Women's + Masters Women + Grandmaster Women all ranked together; Masters/Grandmaster players show a secondary sub-division rank label (e.g. "1st Masters") below their name when the full pool is displayed
- Total placement score: displayed on every leaderboard row as "{N}pts" — this is the sum of ordinal event placements (lower = better), not colour system points; helps players see exactly how far they are from moving up/down
- All three leaderboard sections (Men's, Women's, Juniors) always render, even with zero scores — show "No scores yet" placeholder
- Leaderboard auto-refresh: 15-second polling fallback added alongside existing realtime subscription; leaderboard updates without manual page refresh
- Judge Summary tab: "Summary" tab appears in the tab bar for judges, alongside Kaiwhakawā; shows all 3 divisions with all players ranked; each player expandable to see all 10 event scores + ordinal placements; Edit/Delete buttons per submitted score (delete works live and post-session); "To add or update a score, use the Kaiwhakawā tab" guidance shown in edit panel
- Dashboard Points History modal: z-index 1050/1100 (above Navbar at 1001) — back button always visible
- Historic points migration: `supabase/migrations/20260610_historic_points.sql` — adds Salvador +800, Rodrigo +1500, Zeke +1500 to 2025 rankings; run in Supabase SQL Editor
- JudgeCard tab bar: Sessions / Votes / Players tabs; default tab is Sessions; switching to Players auto-loads player list; ordinal helper `ordinalJC` used inside JudgeCard to avoid naming conflict
- Bowling (session 22): `sport` mode W/D/L head-to-head over kaiwhakawā-set frames; slug `bowling`; Kubb unchanged (Bowling→Kubb was a 2026-05 rename; this is a NEW event)
- Skill ratings (session 22): multiplayer Elo per (player, event) from session placements, WITHIN unified division pools (Tāne's call — kinder to juniors than a global pool); K=64 split across field size; always full recompute from history (never incremental — the double-award saga is why); display only the 0–100 score (Elo number stays internal; 0 = unplayed, 50 = pool average, 100 = sustained top-1% dominance)
- "Win" = session win (session 22): finished 1st overall in your division that day (`results.placement = 1`), NOT per-event firsts; used on /leaderboard Wins column and My 100 stat row
- Top domain / top event: derived from skill ratings (highest average domain score / highest-rated event) so leaderboard, My 100, and stats modal tell one story; the old `get_player_top_event` RPC still powers the Player Profile card only
- Wellbeing survey (session 22): validated instruments only (WHO-5 + HBSC activity + self-rated fitness + 3 VoR-style items); max quarterly (91 days); all players incl. family-member profiles; judges see aggregates only (cohorts: all/rangatahi/adults, n<3 suppressed) + CSV for funder evidence — individual responses are never exposed to judges
- Tier naming rule (session 22): a tier name never repeats its event name and stays ≤~21 chars; judge criteria live in the tier `detail` field (shown in HOW TO + /events/[slug]), separator "·" matches score-label style

---

*Last updated: July 2026 (session 22 — nine-item improvement pass: ×2 games/points root cause found (orphaned on_session_end trigger from 20260429; fix + rankings rebuild in migration 20260713), Bowling added (105 events), Breath Hold → hold mode + Duck Walk all-walk faster-wins tiers (re-encode migration 20260713b), 73 overflowing tier names shortened with judge criteria moved to a new tier `detail` field, Selwyn Winter Jam recap with champions on /schedule, multiplayer-Elo skill ratings in lib/rating.ts (0–100 display score), My 100 → player stat card + My Stats modal, /leaderboard Wins/Top Domain/Top Event columns (Avg Place removed; season filter fixed), quarterly WHO-5 wellbeing survey + kaiwhakawā aggregate report (migration 20260714). PENDING: run 20260713, 20260713b, 20260714 in the Supabase SQL Editor, in that order)*
*Previous: July 2026 (session 20 — design review DR-1..10 implemented in four phases: (1) celebration pass — PR/effort toast variants, players land on own tab, effort-cap + full-house one-time moments; (2) session-end takeover with placement/points/PRs/colour-progress + 10th/25th/50th session milestones; (3) /leaderboard cleanup (avg place trigger migration 20260707, Youth tab removed, Grandmaster tab keys fixed, Felix duplicate merged, copy corrected) + dashboard next-session countdown; (4) My 100 coverage card + new-event-unlocked toast + banner placement-change flash. PENDING: run 20260707_leaderboard_cleanup.sql in the Supabase SQL Editor)*
*Previous: July 2026 (session 19 — TWO parallel workstreams merged: (1) live session player UI redesign: quick-entry bottom sheet with steppers/quick-picks/tier chips, Still to play/Scored list split, session progress bar, HOW TO in sheet, EventIcon pictogram system with Canva PNG mask pipeline (public/event-icons/), lib/scoring.ts extraction + unit tests, event how-to content for all 94 placeholder events, season-PR direction fix; (2) true-brand UI rollout: globals.css rewritten on the canonical token palette (with legacy aliases), shared UI kit in components/ui.tsx, Navbar/Footer rebuilt, all public pages rebuilt on the kit (canonical event lists, computed counts, no emoji), player pages reskinned, Google OAuth primary on login/play/register, leaderboard comprehension explainer. NOTE: the live session screen still uses inline styles + emoji icon fallback — migrating it onto the ui.tsx kit is a follow-up)*
*Earlier: June 2026 (session 18 — Hand Walk → Handbalance; timed-effort events (Running etc.) now rank fastest-wins via inverted difficulty+time encoding; overall-placement fix (missing event = last in division); points-doubling fix; date off-by-one fix (lib/dates.ts); new /games/[sessionId] full game-review page; migration 20260629; stale eventData tests refreshed)*
*Project started: March 2026*

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
