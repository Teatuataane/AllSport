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
| 1 | Maximal Strength | 1A Press, Deadlift, Clean & Press, Pause Dips, Pause Chinup, Pause Back Squat, Zercher Dead, Pause Bench, Turkish Getup, Arthur Lift, Pause Row, Pause Front Squat |
| 2 | Calisthenics | 1 Leg Squat, Human Flag, Windshield Wipers, Planche, Back Lever, Iron Cross, Front Lever, Chin Hang, Climbing, Handstand, Headstand, L-Sit Hold |
| 3 | Power | Kelly Snatch, 1A Snatch, Javelin, Shotput, Australian Football, Vertical Jump, Clean & Jerk, Snatch, Standing Broad Jump, High Jump, Arm Wrestling, Tug of War |
| 4 | Speed | 100m Sprint, Tag, T-Race, Beach Flags, 200m Sprint, Touch Rugby, Repeat High Jump, Rats & Rabbits, Speed Chess, American Football, Capture the Flag, Kabaddi |
| 5 | Anaerobic Endurance | Chinup Contest, Pushup Contest, Tibialis Curl, Finger Pushup, GHD Situp, Leg Ext Hold, Ab Rollout, Hamstring Curl, Sandbag to Shoulder, Wall Sit, Toe Lift, Toe Squat |
| 6 | Aerobic Endurance | Burpee Broad Jump, Running, Cycling, Ski Erg, Row Erg, Breath Hold, Weighted Carry, Duck Walk, Bronco, Scooting, Wheelbarrow Push, Wheelbarrow Pull |
| 7 | Flexibility | Rear Hand Clasp, Bridge, Forward Fold, Needle Pose, Forward Split, Middle Split, Standing Split, Foot Behind Head Pose, Shoulder Dislocate, Pancake, Side Bend, Full Bound Twist |
| 8 | Body Awareness | Tae Kwon Do, Breakdancing, Trampolining, Jump Rope, Wrestling, Gymnastics, Balance Ball, SKATE, Fencing, Juggling, Foot Juggling, Slackline |
| 9 | Coordination | Volleyball, Baseball, Teqball, Tennis, Cricket, Badminton, Basketball, Football, Hockey, Squash, Lacrosse, Ultimate Frisbee |
| 10 | Aim & Precision | Netball, Bocce, Dodgeball, Carrom, Archery, Bowling, Darts, Disc Golf, Golf, Handball, Table Tennis, Kubb |

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

### Event roster update (August 2026 session 27) — 120 events, 12 per domain — DONE (v0.5.3.0)
Roster reconciled against Tāne's revised lineup. **120 events total** (was 122: +7 new, −9 removed, 9 renamed, 5 moved). Every domain now holds exactly 12 events. Domain names, numbers and order are UNCHANGED — Tāne's sheet showed a different column order and "Speed & Reactivity", both explicitly declined ("Don't reorder… Don't rename the domains either").

- **Added (7):** **Arm Wrestling**, **Tug of War** (Power, `sport`); **Capture the Flag**, **Kabaddi** (Speed, `sport`); **Wheelbarrow Push**, **Wheelbarrow Pull** (Aerobic Endurance, `difficulty+time`, Weighted Carry's D1–D6 5/10/25/50/80/100kg-over-200m ladder, both in `TIMED_EFFORT_SLUGS`); **Kubb** (Aim & Precision, `sport`, restored from git with its original definition and slug so its May–July 2026 history reattaches).
- **Removed (9):** Reverse Hyper, Triple Jump, 400m Race, 50m Sprint, Football Dribble, Hockey Dribble, Walking, Backwards Walk, Airsoft. Historical rows persist as orphan name strings.
- **Renamed (9), slug unchanged:** Pause Squat → **Pause Back Squat**, Pause Chin Up → **Pause Chinup**, Turkish Get Up → **Turkish Getup**, Flag → **Human Flag**, Finger Push Up → **Finger Pushup**, Ham Curl → **Hamstring Curl**, Foot Behind Head → **Foot Behind Head Pose**, Toe Balance → **Toe Squat**, Leg Extension → **Leg Ext Hold**.
- **Moved (5):** Headstand + L-Sit Hold → Calisthenics; Toe Lift + Toe Squat → Anaerobic Endurance; American Football → Speed.
- **Leg Ext Hold mode flip** — `strength` → `difficulty+time`, D1–D7 (Bodyweight / 2 / 4 / 8 / 12 / 16 / 24kg), a HOLD (longer wins, NOT in `TIMED_EFFORT_SLUGS`). Old rows stored a weight in `raw_score`, which decodes as a hold that never happened, so the migration archives then deletes them.
- **Flag D6 tier renamed** 'Human Flag' → **'Full Flag'** (a tier never repeats its event name, and the event is now Human Flag).
- **`walking` / `backwards-walk` stay in `TIMED_EFFORT_SLUGS` on purpose** even though the events are gone: their historical `raw_score`s are inverted-encoded, so removing them would make archived rows decode backwards. Guarded by a test that states the reason.
- **Icons 120/120** — 7 new slug-named PNGs added. Nine PNGs for removed events are left as harmless orphans.
- **Tests:** 198 passing (was 162). New coverage for every rename/move/add/removal, the Leg Ext Hold mode flip, the wheelbarrow ladder, and the retired-slug decode.

#### RENAMING AN EVENT IS NOT SAFE JUST BECAUSE THE SLUG SURVIVES
The long-standing assumption that "slug stays, so history survives" was **wrong**, and it had already silently orphaned history for earlier renames (Handbalance among them). Two traps, both fixed here:
1. **`/prs`, `lib/percentile.ts` and the My Events card all group results by `session_events.event_name`**, not by slug. A rename detaches every score ever set on that event from its own definition — PBs vanish from the page and stop counting toward Top %. Migration `20260801000000` Part 1 repoints **24** old names (this pass's 9 plus earlier ones: Handbalance/Hand Walk/50m Hand Walk → Handstand, Rope Climb → Climbing, Zercher Deadlift → Zercher Dead, Shot Put → Shotput, Javelin Throw → Javelin, Chin Up Contest, Push Up Contest, Ab Wheel Rollout, Front Split, Chin Lift, T-Test, 1 Arm Press, 1 Arm Snatch, Pause Bench Press, AFL, 200m Burpee Broad Jump). The old-name list was derived from **every historical revision of `lib/eventData.ts` in git**, not from memory.
2. **`lib/scoring.ts` matched weight-scored tiers on the event NAME literal** (`'Pause Chin Up'`), so the rename would have silently dropped the weight input on the Weighted Chinup tier for new AND historical sessions. Now accepts both spellings via `PAUSE_CHINUP_NAMES`, with a regression test.

**Deliberately NOT swept** (movement changed, not just the label — merging would credit a PR to a lift nobody did): OHP/Overhead Press → Clean & Press, Cornhole → Bocce, Sprint Repeats → Bronco, plus Calf Raise / Glute Bridge / Iron Lungs (no documented successor) and the 2026-05 domain-6 slugs (redesigned, not renamed). **Bowling is left alone** because pre-May-2026 Bowling rows became Kubb but Bowling was re-added as its own event in July 2026, so the correct target depends on session date, not name. `session_events.domain_name`/`domain_number` are untouched: the June 2026 pass renamed AND renumbered domains together, so rewriting names without numbers would leave rows self-inconsistent.

**DEPLOY ORDER: ship the code FIRST, then run the migration.** Reversed, `session_events` holds the new names while the deployed bundle knows only the old ones, so `getEventByName()` returns undefined and live-session event cards lose their tiers and input mode mid-session. Code-first only degrades display until the migration lands.

**APPLIED to prod 2026-08-01** — 17 Leg Extension result rows archived then deleted (6 players, 2 sessions), and all 24 renames verified: every old name now returns 0 rows, every new name returns rows.

**Archive table:** `results_leg_extension_archive_20260801` holds the deleted rows. `CREATE TABLE … AS SELECT` does **not** inherit RLS, and anything in `public` is reachable through PostgREST, so the migration explicitly enables RLS (no policies — denies all API access; `service_role` still reads it via BYPASSRLS) and revokes from `anon`/`authenticated`. Drop the table once the Leg Ext Hold call is settled.

### Event roster update (July 2026 session 25) — from "AllSport Programming July 2026.xlsx"
Roster reconciled against Tāne's programming spreadsheet. **122 events total** (was 105: +18 new, −1 removed; Handstand is a rename, not an add). See Domain Display Order above for the full per-domain lists.

- **Renamed + moved:** **Handbalance → Handstand**, Power → **Calisthenics** (slug stays `hand-walk` so history survives; stays `difficulty+time` hold, tiers unchanged: D1 Pushup Hold … D4 Freestanding). Keeps using `hand-walk.png` icon.
- **Moved (slugs/history unchanged):** **Ham Curl** → Anaerobic Endurance; **Sandbag to Shoulder** → Anaerobic Endurance; **Ultimate Frisbee** → Coordination.
- **Removed:** **Kubb** (kept Clean & Press). Historical "Kubb" result rows persist as orphan name strings — harmless, same pattern as the earlier Handball removal.
- **18 new events** (fully defined — input mode, tiers, how-to/rules, emoji fallback):
  - Maximal Strength: **Arthur Lift** (`strength` — behind-the-body mirror of Clean & Jerk: clean to behind-neck rack, jerk overhead), **Pause Row** (`strength`), **Pause Front Squat** (`strength`)
  - Calisthenics: **Toe Balance** (`reps` — squat with only the toes touching the ground; slug `toe-balance`)
  - Power: **Standing Broad Jump** (`distance`), **High Jump** (`distance`, cm), **American Football** (`sport`)
  - Speed: **Hockey Dribble** (`sprint` — timed dribble course)
  - Anaerobic Endurance: **Wall Sit** (`hold`)
  - Aerobic Endurance: **Backwards Walk**, **Scooting** — both `difficulty+time` timed efforts (faster wins), D1–D5 distance ladder (10/25/50/100/200m); both added to `TIMED_EFFORT_SLUGS`
  - Flexibility: **Side Bend** (`difficulty+time` hold, D1–D4: Standing Bend / Gate Pose / Seated Bend / Side-Split Lateral; slug `side-bend`), **Full Bound Twist** (`difficulty+time` hold, D1–D4: Seated Twist / Half Lord / Bound Twist / Full Bound Twist; slug `full-bound-twist`)
  - Body Awareness: **Slackline** (`hold` — longest balance on the line)
  - Coordination: **Lacrosse** (`sport`)
  - Aim & Precision: **Airsoft** (`sport`), **Handball** (`sport` — re-added; new slug `handball`), **Table Tennis** (`sport`)
- **Icons DONE** — all 18 new slugs (plus `bowling.png`, a leftover gap from session 22) exported to `public/event-icons/` as 1000×1000 RGBA silhouettes; icon coverage is now 122/122. Three Canva exports were renamed on import to match their slugs: `full-bound-pose.png` → `full-bound-twist.png`, `high jump.png` → `high-jump.png`, `standing broad jump.png` → `standing-broad-jump.png`. **Filenames must be the exact slug** — a mismatch silently falls back to emoji.
- **Difficulty reorders** flagged by Tāne are deferred to a later pass (those need a `raw_score` re-encode migration).

### Bug fixes & changes (June 2026 session 18)
- **Hand Walk → Handbalance** rename (see Event renames above).
- **Timed-effort events now rank by FASTEST time** — `difficulty+time` carries two semantics: HOLDS (longer time wins) and TIMED EFFORTS (faster time wins). Previously every `difficulty+time` event ranked longer time as better, so e.g. Running 4:20 beat 4:19. The 10 timed-effort events (Running, Cycling, Ski Erg, Row Erg, Weighted Carry, Bronco, Walking, Burpee Broad Jump, Climbing, Repeat High Jump) now rank faster as better. Rule: a higher difficulty tier always outranks a lower one; within a tier, faster wins. See "difficulty+time encoding" below. **Duck Walk is intentionally excluded** (mixed hold + walk tiers) — pending tier redesign (see What's Next).
- **Overall placement fix** — the points trigger now ranks each scored player across EVERY session event; a missed event = last place in the division (= number of players in that division who played the session). Previously only scored events were summed, so playing fewer events gave an unfairly low (better) total.
- **Points doubling fix** — production was running a stale award function that summed `points_earned` (duplicated across every event row); season total is now placement + effort, added once. Fixed in migration `20260629000000_fix_placement_and_timed_events.sql`.
- **Date off-by-one fix** — DATE columns ('YYYY-MM-DD') were parsed as UTC midnight, rendering the previous day in behind-UTC contexts. New `lib/dates.ts` (`parseLocalDate` / `formatNZDate`) parses dates in local time. Applied to all session-date renders.
- **Game review page** — new `/games/[sessionId]` full all-player report (every division, event, score + placement, standings), linked from dashboard session history; any logged-in player. Placements computed live from `raw_score` (so the encoding + missing-event fixes reflect for past games too).

#### difficulty+time encoding
`raw_score = tierIdx * 10000 + within-tier term` (0-based tierIdx). HOLDS use `within-tier = seconds` (more = better); TIMED EFFORTS use `within-tier = 10000 - seconds` (faster = better). Either way a higher tier always outranks a lower one AND a higher `raw_score` is always better, so every ranker (client leaderboard + SQL trigger, both sort `raw_score` DESC) works without per-event branching. Helpers `isTimedEffort` / `encodeDiffTime` / `decodeDiffTime` and the `TIMED_EFFORT_SLUGS` set live in `lib/eventData.ts`. `time_seconds` is still stored raw (un-inverted) for effort-task matching.

### Live session redesign (July 2026 session 19)
- **Player event UI redesigned** — the 2-column collapsed event card grid is replaced (for player tabs only) by: a session progress header (10 domain-coloured segments fill as events are scored + "N of 10 events scored" + effort level), an event list split into **"Still to play"** (blue-tinted rows with "Tap to score" chip) and **"Scored"** (score + "Nth in event" division rank on the right), and a **quick-entry bottom sheet** that opens on row tap.
- **Quick-entry sheet** (`QuickEntrySheet` in `scoring/[sessionId]/page.tsx`) — pre-filled from today's best submission (or season PR), big +/− steppers (weight ±2.5kg, reps ±1, time ±5s, strokes ±1), quick-pick chips ("Today · X", "PR · X", "PR +2.5kg"), tier chip selector (replaces `<select>`), W/D/L buttons + opponent quick-pick chips (other players with results this session) for sport mode, submit button restates the exact score ("Submit — 120kg × 3"). Sheet also contains Today's best / Season PR hints, today's submissions (edit/delete), and effort tasks. **HOW TO button** flips the sheet to `howToPerform` + `rules` + full tier list from eventData (graceful "Content coming soon" fallback). Green success toast on submit (see session 20 celebration pass for PR/effort variants).
- **Judge flows unchanged** — Kaiwhakawā + Summary tabs still use the original `EventCard` grid. *(Superseded July 2026 session 26: the Kaiwhakawā tab now uses the same list + quick-entry sheet as players and `EventCard` is deleted. The Summary tab still has its own table UI.)*
- **Shared entry logic extracted** — `computeScoreVals(mode, eventData, EntryVals)` and `submitEntry(...)` (payload build + PR flag + effort credit + insert/update) are now module-scope in `scoring/[sessionId]/page.tsx`, used by BOTH `EventCard` and `QuickEntrySheet` — one code path for all raw_score encodings. (Step toward backlog item "extract scoring into lib/scoring.ts".) Side fix: `reps`-mode weight variations now also store `weight_kg` (previously dropped).
- **Event pictogram system** — new `components/EventIcon.tsx`: renders `/public/event-icons/{slug}.png` as a CSS mask filled with the domain colour (so black Canva silhouette exports work on the dark theme automatically); probes each icon once per page load; falls back to the event's `emoji` until an icon exists. `domainColor(domainNumber)` exported from the same file. Event icons (transparent 1000×1000 RGBA PNGs, named by slug) live in `public/event-icons/` — exported from Canva, verified rendering through the mask. **Coverage: 120/120 events** as of session 27 — every event has an icon, so the emoji fallback is now only a safety net for future additions. Note: CSS `mask-image` is fetched with CORS, so icons must stay same-origin (they are — served from /public).
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
- **×2 games/points bug — ROOT CAUSE FOUND, FIX VERIFIED IN PROD 2026-08-01** (`pg_trigger` now returns only `auto_award_points`; the orphaned `on_session_end` is gone): `20260429_v2_clean_schema.sql` created a second trigger `on_session_end` (no WHEN clause) calling `award_session_points()`; every later migration only dropped/recreated `auto_award_points`, so both triggers fired on every session close since late April → `rankings.total_sessions` +2 and points added twice per session. `results.points_earned` and `session_player_summary` stayed correct (idempotent upserts). Fix migration `20260713000000_fix_double_award.sql`: drop the orphan, atomic claim guard (function stamps `points_awarded_at` FIRST and exits if already stamped), rebuild 2026 rankings from summaries. This also explains why the session-18 "points doubling fix" appeared to regress.
- **Bowling added** (105 events total) — Aim & Precision, `sport` mode W/D/L head-to-head over set frames; slug `bowling`; emoji fallback 🎳 (icon PNG exported in session 25). Pre-May-2026 "Bowling" history (renamed to Kubb back then) re-attaches to this event's PR history by name — harmless.
- **Breath Hold → `hold` mode** (longer wins) + effort task = 80% of PR; **Duck Walk → all-walk tiers** D1–D5 (10m/25m/50m/100m/200m), joined `TIMED_EFFORT_SLUGS`. Historic raw_scores re-encoded by `20260713000001_breath_hold_duck_walk.sql`. `time` input mode now has zero events (kept in the type).
- **Tier names shortened** (73 renamed) — tier chips no longer repeat the event name or carry judge criteria; new optional `detail` field on `DifficultyTier` holds the criteria, rendered in the quick-entry sheet HOW TO tier list and on /events/[slug]. NOTE: `results.difficulty_tier` stores the NAME string, so pre-rename rows display their old stored labels (fine) but won't match `findIndex` tier lookups (same accepted trade-off as the Handbalance rename).
- **Selwyn Winter Jam recap** — /schedule block converted from advert to results recap with division champions (derived from the 2026-07-03 session `e032cb24-…`, the Jam stored a day early by the old UTC date bug): Men's kiwigyver, Women's Meredith & Clairebear (shared 1st), Masters Men Blair, Masters Women Jing.
- ~~**Skill rating system (`lib/rating.ts`)** — multiplayer Elo~~ **REMOVED August 2026.** Session 24 replaced the player-facing skill score with best-score percentiles (`lib/percentile.ts`) and kept the Elo "for `sessionWins`" — but `sessionWins` is a plain `placement = 1` count that never touched a rating, so `computeRatings`/`eloTo100`/`domainRatings`/`topEvent`/`topDomain` had **zero call sites** and were deleted. `lib/rating.ts` now holds only `divisionPool` + `sessionWins` + the `Rating*` row types (names kept — they describe row shapes, not ratings). `lib/fetchAll.ts` deleted in the same pass. Percentiles are now the single ranking metric: do not reintroduce a second one without deciding which is authoritative — the old pair exported `topDomain` from BOTH modules, which is why the leaderboard still imports the survivor as `pctTopDomain`. See PERF_AGGREGATION_PLAN.md.
- **My 100 → player stat card** — header stat row (Wins · Avg Place · Events), domain coverage dots + per-domain 0–100 skill score, top-event line; tap opens a full-screen **My Stats modal** (headline stats, top event/domain cards, per-domain skill bars + coverage, explainer, link to /prs). Wins = sessions finished 1st in division (`results.placement = 1`, distinct sessions; placement has meant overall division rank since 20260514, older rows are NULL so wins can only undercount).
- **/leaderboard columns** — Avg Place column replaced by **Wins**, **Top Domain**, **Top Event** (Elo-derived, lifetime; wins are current-season). Also fixed a latent bug: rankings query now filters `season_year = current year` (previously all seasons' rows were listed together). Explainer copy updated.
- **Wellbeing survey** — quarterly check-in (≤1 per 91 days per player, baseline on first prompt) using validated instruments: WHO-5 (5 items, 0–5, score ×4 = 0–100) + HBSC 60-min activity days item + single-item self-rated fitness + 3 Voice-of-Rangatahi-style items (confidence / enjoyment / belonging, 1–5 agree). `WellbeingSurvey` card on /dashboard (renders only when due; family-member profiles supported via parent RLS), full-screen form, private-by-design; `WellbeingReport` on /judge shows quarterly aggregates (all / rangatahi / adults cohorts, <3 respondents suppressed) + CSV export via `get_wellbeing_report()` SECURITY DEFINER RPC. Migration `20260714000000_wellbeing_survey.sql`.

### Kaiwhakawā tab rebuild (July 2026 session 26) — DONE (v0.5.2.0)
The live-session **Kaiwhakawā tab** was the last surface still on the pre-session-19 two-column `EventCard` grid while player tabs used the list + quick-entry sheet. It now uses the same components, so scoring has ONE code path. All in `app/scoring/[sessionId]/page.tsx` + new `lib/judgeRoster.ts`. Summary tab and `/judge` (JudgeCard) are untouched and still old-format.

- **Player picker → chip row.** The Registered/Guest segmented toggle and the native `<select>` are gone. Every player with a result this session is a chip (registered = red, guests = amber outline); tapping the active chip deselects. `+ Player` (dashed, shown only when `unlistedPlayers.length > 0`) opens a panel of all other registered players; `+ Guest` reveals a name field (Enter or "Score" commits). **Guests already holding results get their own chip, so a judge never retypes a guest name** — the old flow required retyping it exactly for every event.
- **No selection → session roster.** Each player renders as a row with a domain-coloured progress bar and `N/10 scored`; tap to select. Zero results shows a "No scores yet" empty state whose copy branches on whether `+ Player` is actually rendered.
- **Selection → the player-tab layout.** Progress header (`N of 10 events scored` + effort level + `ProgressSegments`), `Still to play` / `Scored` sections via `EventListRow`, `QuickEntrySheet` on tap. The sheet is **keyed by target** (`judge-{id|name}-{eventId}`) so pre-filled values never bleed across players. Guests pass `playerId: null` (exactly how `submitEntry` already writes guest rows) → no season PR, no division rank.
- **Toasts name the player** (`Meredith — Deadlift — 95kg × 3`, red prefix); PR variant kept. Player-only moments (effort cap, full-house shimmer, new-event-unlocked, placement flash) stay OFF the judge tab — they belong to the player.
- **`EventCard` deleted (~510 lines)** plus its orphaned `expandedEventId` state. `isJudge` was dead inside it (`isJudge || true`), so judges lost no capability the sheet lacks (edit/delete of any submission exists in both). `sectionLabel` + `ProgressSegments` extracted to module scope and shared with the player tab.
- **`lib/judgeRoster.ts` (new, pure, 26 unit tests).** `buildJudgeRoster` (dedup + sort + 3-level name fallback), `resolveJudgeTarget`, `resultsForTarget`, `scoredEventIds`, `scoredEventIdsByTarget` (all targets in ONE pass — the roster was `players × events × results` per render), `rosterKeyFor`, `NO_SCORES`. **Guests are keyed `guest:{player_name}` and never merge with a registered player of the same display name.** Name resolution treats `''` as missing (not just null) — `??` alone rendered blank chips, caught by a test.
- **Bug fixed: stale `judgePRs` across a target switch.** The judge PR loader never cleared on switch (unlike the player loader right above it, which clears with a comment about exactly this). With a dropdown it was hard to hit; with one-tap chips it was easy — the previous player's PR showed as the new player's Season PR and mis-computed their effort-task baseline. Now clears first + `cancelled` guard for out-of-order responses.
- **DEFERRED (logged in TODOS.md P2):** the whole live-session screen builds controls as inline-styled `<button>`s, so there are no `:focus-visible` states anywhere and chips are ~36px against a 44px touch target. Patching only the new chips would desync them from the identical chips in the sheet — the real fix is the `components/ui.tsx` migration already flagged as the session-19 follow-up.

### My Events redesign — percentile ranking (July 2026 session 24) — DONE
Renames the **"My 100"** feature (dashboard card + its modal) to **"My Events"** and replaces the player-facing Elo **"skill" score** everywhere with a literal **best-score percentile** shown as **"Top X%"**. The Elo engine in `lib/rating.ts` stays only for `sessionWins`; its rating/skill display functions (`eloTo100`/`domainRatings`/`topEvent`/`topDomain`) are no longer imported by the dashboard or leaderboard. Metric + layout spec locked in a `/grill-me` session; implemented in `lib/percentile.ts` (+ `__tests__/percentile.test.ts`, 14 tests), `app/dashboard/page.tsx` (card + modal), `app/leaderboard/page.tsx` (columns + copy). Leaderboard verified against real data; dashboard card/modal are auth-gated (typecheck-clean, visual eyeball pending a logged-in session).

**Tie-for-top refinement (implemented, revises the grill's Q6 answer):** you read as **"1st" whenever no other player has a strictly higher best** (sole OR shared top) — not only when you strictly beat everyone. This matches AllSport's own "Ties: shared placement awarded" rule and avoids a 2-way tie for first rendering as "Top 100%". Mid-field ties still follow the strict "ties don't count as beaten" rule. Note: in AllSport's small pools most players lead at least one event, so "1st" is common on the leaderboard Top Event column — by design.

- **Metric — best-score percentile (`lib/percentile.ts`, new).** For each event, a player's best-ever `raw_score` is compared against every OTHER player **in the same unified division pool** (`men`/`women`/`juniors`, reusing `divisionPool()` from `rating.ts`) **who has also played that event**. `beat% = (players whose best raw_score is strictly lower) ÷ (other pool players who played it) × 100`. Displayed as **`Top X%`** where **`X = round(100 − beat%)`, floored at 1** (never "Top 0%"); the pool leader (beat everyone) shows **"1st"**; a solo field (no other player has done it) shows **"No comparison yet"** and is **excluded** from any average. `raw_score` DESC is uniformly "better" for every mode (time/timed-effort/score already encoded that way), so a single strict-greater comparison works for all events. Lifetime best only — no season tabs. Same computation must return **all players** (leaderboard needs every row), so `bestScorePercentiles(...)` returns `Map<playerId, Map<eventName, { topPct, isLeader, beatPct, field }>>`; no new Supabase queries (reuses the already-loaded results/session_events/players/sessions).
- **Domain percentile** = **average of the player's played-event `Top%`** within that domain (solo/unplayed events excluded). Coverage (events played / total) is shown separately, never folded into the ranking.
- **Dashboard "My Events" card** — heading "My Events" + → (opens the modal). REMOVES the "N of 105 events played" subtitle line and the Wins/Avg Place/Events stat row. Shows: (1) one **segmented domain bar** — a single horizontal bar of 10 domain-coloured segments, each filling to that domain's coverage — plus a small **"62 / 122" count**; (2) **Top Domain** (`DomainIcon` · name · Top%); (3) **Top Event** (`EventIcon` · name · Top%).
- **"My Events" modal** (retitled from "My Stats"; subline stays "{NAME} · LIFETIME"). Header stat row: **Session Wins · Avg Place (1 dp) · Games Played** where **Games Played = distinct sessions the player has any result in** (replaces the old Events-Played count, which now lives on the card bar). Below: a **Strongest + Weakest** two-up (each `EventIcon` · name · Top%; weakest = highest Top% among played events). Then the **10 domains as collapsible rows, collapsed by default** (mirrors `/prs`): `DomainIcon` (tinted) · "3. Power" · domain **Top%** (domain colour; "—" if nothing rated) · "4/10 played" coverage · chevron. Expanding reveals **event rows** in canonical order: `EventIcon` · name · right-hand label = **Top X%** / **"1st"** / **"No comparison yet"**; **never-played events are shown dimmed (0.4 opacity) labelled "Not played"** as a deliberate coverage-gap/opportunity cue. Explainer rewritten to describe Top% (not skill 0–100); keep the "Personal bests →" link.
- **`/leaderboard`** — the **Top Domain** and **Top Event** columns are reselected by **best-score percentile** (not Elo) and each cell now shows **"Power · Top 8%"** / **"Deadlift · 1st"** (was bare name). Wins column unchanged. Explainer copy (`:462`) rewritten from "skill rating" to Top% language, and the stale "Tap My 100 on your dashboard" wording → "My Events".

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
| Leg Ext Hold | D1–D7 (Bodyweight/2kg/4kg/8kg/12kg/16kg/24kg) — hold, longer wins |
| Wheelbarrow Push / Pull | D1–D6 (5kg/10kg/25kg/50kg/80kg/100kg, always 200m) — timed effort, faster wins |
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

The section is called **"Colours"** throughout the app. **Points are LIFETIME — they never
reset.** (They reset each January until August 2026; see the rework note below.) A colour,
once earned, is never lost.

**19 rungs.** Single source of truth: `lib/colours.ts` (names, thresholds, styling) mirrored
by the `colour_ladder` table (so the trigger and backfill can join on thresholds).

| # | Te Reo | Colour | Hex | Points | | # | Te Reo | Points |
|---|---|---|---|---|---|---|---|---|
| 1 | Mā | White | #ffffff | 0 | | 11 | Taniwha Kiwikiwi | 20,000 |
| 2 | Kiwikiwi | Grey | #888888 | 500 | | 12 | Taniwha Whero | 30,000 |
| 3 | Whero | Red | #EA4742 | 1,000 | | 13 | Taniwha Karaka | 40,000 |
| 4 | Karaka | Orange | #F9B051 | 2,000 | | 14 | Taniwha Kōwhai | 50,000 |
| 5 | Kōwhai | Yellow | #F9E051 | 3,000 | | 15 | Taniwha Kākāriki | 60,000 |
| 6 | Kākāriki | Green | #4DB26E | 4,000 | | 16 | Taniwha Kahurangi | 70,000 |
| 7 | Kahurangi | Blue | #2371BB | 5,000 | | 17 | Taniwha Poroporo | 80,000 |
| 8 | Poroporo | Purple | #B87DB5 | 6,000 | | 18 | Taniwha Uenuku | 90,000 |
| 9 | Uenuku | Rainbow | gradient | 8,000 | | 19 | **Ngā Taniwha** | **100,000** |
| 10 | Taniwha | Black | #000000 | 10,000 | | | *(hard cap)* | |

**Cycle 2** (rungs 11–18) repeats cycle 1 prefixed with "Taniwha", **skipping Mā** ("Taniwha
Mā" would read as a demotion), +10,000 each. **Ngā Taniwha is the end of the ladder** — there
is no rung 20, so "Taniwha" never stacks into "Taniwha Taniwha".

**Visual grammar:** cycle 1 is a solid (or rainbow) card. Taniwha and all of cycle 2 are a
**black card with the cycle colour as accent** (border, heading, progress bar) plus a **single
taniwha emblem** watermark tinted the accent. Ngā Taniwha uses the **full twin crest** in
amber. Note the AllSport crest is already twin taniwha, which is why the escalation is one
taniwha → both, and why `PEAK` is named Ngā Taniwha. `colourCardStyle()` owns the border,
including the two-layer `background-clip` trick the rainbow rungs need (CSS `border` cannot
take a gradient and silently falls back).

**Emblem assets:** `public/colour-emblems/taniwha.png` and `nga-taniwha.png`, same spec as
`public/event-icons/` (transparent, single colour, ~1000×1000, masked and tinted). **Until
they exist, Taniwha and Ngā Taniwha are visually identical** — the emblem is the only thing
separating rung 10 from rung 19.

**Progress bar:** fills in the current colour, resets at each threshold. Layout: `[Te Reo name] [████░░░] [Next Te Reo name — Xpts to go]`. The target rung comes from
`nextColourFrom(points, highestRung)`, **not** `nextColour(points)`: a colour claimed by the
kaiwhakawā mid-session is awarded before `lifetime_points` catches up, and the naive version
tells a player who was just given Whero that Whero is "60 pts to go".

**Year tabs: REMOVED** (August 2026). Points are lifetime so there is nothing to switch
between. Replaced by a **colour timeline** in the points-history modal — one row per colour
ever earned, with the date and venue of the session it happened in.

### Colours rework (August 2026 session 28) — lifetime points + kaiwhakawā alert

Seasonal reset removed, ladder extended to 19 rungs, and a colour alert built so **the coach
finds out while the player is still in the room**. Design settled in a `/grill-me` session;
full record in `COLOURS_REWORK_PLAN.md` (19 locked decisions with reasoning).

**Taniwha stays at 10,000 — knowingly.** Real data (113 player-sessions) says a division
winner averages **149 pts/session** and a runner-up **93**, so 10,000 is ~4.5 months for a
3×/week winner and ~1.4 years for a 1.5×/week non-winner, **not** the 1 and 3 years originally
described. Tāne chose to keep it and let cycle 2 carry the long game (full cycle = 100,000 ≈
4.5 years for a keen winner). Don't "correct" this later without asking.

**`rankings` is UNCHANGED and still seasonal.** `/leaderboard` still ranks on current-year
points, so January still starts a fresh race and a newcomer can climb. Only the **colour**
went lifetime. One number became two, on purpose.

- **`player_totals`** keyed on `player_id` **alone**. This fixes a latent bug: `rankings` is
  keyed `(player_id, season_year, division)`, so when a Junior turns 17 or a player turns 40
  the trigger inserts a **fresh row starting at zero**. Seasonal reset hid it; a lifetime
  total keyed the same way would silently halve on a birthday. Salvador will trigger this.
- **Recomputed, never incremented.** `earned_points` is a full recompute from
  `session_player_summary` (+ a `results` fallback for pre-20260514 sessions). The ×2
  double-award bug was `total_points = total_points + …`; under seasonal points that class of
  bug self-heals each January, under lifetime points it is **permanent**.
- **`adjustment_points` is a separate column** precisely because of that: anything added to
  `earned_points` is wiped the next time the player finishes a session. It carries the
  historic points that `20260610000000_historic_points.sql` **never actually applied** (it
  UPDATEs `season_year = 2025` rows that have never existed in prod, and matches Zeke on a
  `full_name` that is NULL — he is in the DB as display_name "Zebe"). Salvador +800,
  Rodrigo +1500, Zeke +1500.
- **`colour_awards` is append-only.** A voided session or deleted score can lower
  `lifetime_points`; the row stays and display reads the **highest rung ever awarded**.
  `colourForPoints` is only for working out what comes *next*.
- **The alert is predictive, because it has to be.** Points are only written when a session
  *closes*, so a stored-data alert fires after everyone has gone home. Two states:
  `on-track` uses the current provisional placement and can retract; **`earned` uses
  `lifetime + 10 + (effort_level × 5)`** — the guaranteed floor, with **no placement ranking
  at all**, so no other player's result can take it back. Safe to say out loud.
  `hasEarnedDuringSession()` in `lib/colours.ts` and the `claim_colour_award` RPC are the
  same formula and must stay in step.
- **The coach releases it.** `claim_colour_award(player_id, session_id, rung)` writes the
  award mid-session on the "Celebrated" tap. The player sees nothing until then, or until the
  session closes (structural: the session-end takeover only renders after `sessionEnded`).
- **Rung-skip invariant:** smallest ladder gap (500) > max single session (200), so a session
  can never skip a rung and the alert never announces two colours at once. Pinned by a test
  that fails loudly if the points formula ever changes.

**Surfaces:** dashboard Colours card + colour timeline, `/leaderboard` colour column and
19-rung key (cycle 2 behind a "Beyond Taniwha" reveal), home colour list, `/profile` badge,
session-end takeover colour headline, Kaiwhakawā live banner, `/judge` standing watchlist
(sessions-away, not points-away).

**Six inline copies of the ladder deleted** (dashboard, leaderboard ×2, home, profile, live
session) plus a seventh in `__tests__/grades.test.ts`. Three had Kōwhai as `#FFE566` and three
as `#F9E051`; canonical is **`#F9E051`**. That test also carried a **wrong points formula**
(`Math.max(100 / playerCount, 10)` reintroduced the gap floor removed in May 2026) — migrated
and corrected into `__tests__/colours.test.ts`.

**Stale CLAUDE.md claims corrected in the same pass:** there were never any 2025 `rankings`
rows (so no 2025 year tab existed for anyone), and there is no "My Colour History" button on
the homepage.

---

## Taniwha grading system (August 2026 session 31) — LIVE, applied and verified 2026-08-25

Replaces the Colours ladder with a collection of **twelve taniwha**. Design settled in a
`/grill-me` session; the full record with 28 locked decisions is in `TANIWHA_SYSTEM_PLAN.md`.

**APPLIED AND VERIFIED IN PRODUCTION, 2026-08-25.** Checked by querying the objects with the
public anon key, not by trusting `db push`: `event_domains` 120 rows, `player_taniwha` seeded
for all 27 players, **197 wins backfilled**, `results.event_placement` present. The budget
invariant (`SUM(body_parts) <= taniwha_body_budget(lifetime_points)`) returns **zero breaches**,
nobody is building two taniwha, and no guest row carries a placement.

**What the backfill revealed, and it is the design working:** Tāne already holds **three domains
at or past 9 of 12** (Coordination 11, Calisthenics 10, Maximal Strength 9) and RGFell holds
one — but **nobody has crown room**, because everyone is under 10,000 lifetime points. The
crowns are earned and waiting on points. Points are the binding constraint, exactly as the
calibration assumed. Do not "fix" this by lowering a threshold; it is the intended shape.

- **Twelve taniwha, eleven parts each.** Te Taniwha ō te Whānau, one per domain, then
  **Te Kāhui** for holding all eleven. Parts in order: Pane (head), Tinana (body), Hiku (tail),
  Ringa mauī, Ringa matau, Waewae mauī, Waewae matau, Parirau (wings), Arero (tongue),
  **the implement**, **Tikitiki** (the crown).
- **Part TEN is the implement, and it is the only part that differs between taniwha** — each
  carries the tool of its own discipline, drawn from a REAL event in that domain rather than
  invented (Tika's bow from Archery, Tere's flag from Beach Flags, Ngāwari's block from Forward
  Split, which is literally scored as block height). It lives in `lib/taniwha.ts`, not in SQL:
  the database only needs to know how many parts a taniwha holds, never which. Resolve it with
  `partFor(taniwha, 10)` — `partByNumber(10)` returns the generic placeholder "Taputapu", which
  must never reach a player.
- **Ten parts by points, the crown by an act.** The whānau crown needs one qualified referral;
  a domain crown needs **9 of that domain's 12 events won**. `PEAK_POINTS` 100,000 → **110,000**.
- **Points grant a BUDGET, not an address.** body budget = `floor(p/1000)` capped at 110; crown
  capacity = `floor(p/10000)` capped at 11. A crown consumes NO part slot — crowns are a separate
  track, opened by points and filled by an act. (This got simpler on 26 Aug: the old budget
  subtracted `floor(p/10000)` only because every tenth slot was a crown.) The intuitive
  "slot 15 = taniwha two, part five" map is WRONG: a player may switch and their parts stay on
  the taniwha they were placed on, so under a fixed map an abandoned taniwha could never be
  resumed. **Crowns are fungible** — the points open your Nth crown and whichever act lands
  first takes it.
- **Parking.** An unearned crown leaves its slot empty and the next taniwha's Tinana arrives at
  the following 1,000. Points can never stall and crowns can never block them.
- **A win** = 1st in that event within the **unified pool** (men/women/juniors), in a session
  where **at least 3** pool players scored it, ties shared, guests excluded. Defined ONCE, in
  the `player_event_wins` view. Note this is a DIFFERENT pool from `results.placement`, which
  uses the exact division — on purpose, because the exact divisions are too small for the
  field-of-3 rule to ever fire.
- **The ten domain colours are now distinct.** `DOMAIN_COLORS` had six colours across ten
  domains (1/7 red, 2/8 amber, 4/9 purple, 5/10 blue) and lived in **three** places. Now ten
  hues in `lib/domainColours.ts`, in `lib/` so `app/events/page.tsx` (a server component) can
  use it without dragging a client module into the server graph.
- **`colour_awards` is NOT repurposed.** It records colours really awarded on real dates;
  rewriting them as taniwha parts would fabricate history, and the numbers do not line up
  (Kahurangi was rung 7 at 5,000 points; 5,000 points is 5 parts). The dashboard timeline still
  shows them as the colours era.

**The Colours fallbacks are GONE** (v0.6.0.1). They were deploy-order insurance and are spent.
`lib/colourAlerts.ts`, `components/ColourAlertBanner.tsx` and `components/ColourWatchlist.tsx`
are deleted. **`lib/colours.ts` survives, shrunk to a lookup table**: `colour_awards` records
colours really earned on real dates and the dashboard timeline still shows them as the colours
era. Rewriting them as taniwha parts would fabricate history, and the numbers do not line up
(Kahurangi was rung 7 at 5,000 points; 5,000 points is 5 parts). **Do not add to that file** —
a new threshold or predicate there means two grading systems are live at once.

**The points economy lives in `lib/taniwha.ts` now** (`MIN_PLACEMENT_POINTS`,
`EFFORT_POINTS_PER_LEVEL`, `MAX_EFFORT_LEVEL`, `MAX_SESSION_POINTS`). It describes the
session-to-points contract, which outlives any grading system built on it, and
`award_session_points()` is the other half of that contract. `RAINBOW` lives in
`lib/domainColours.ts`, which depends on nothing, because both modules need it.

**STILL TRUE: a missing COLUMN returns `42703` and takes the whole query down**, while a
missing table returns `PGRST205` in `error`. That is why every taniwha read is its own query
and nothing selects a column it is not sure of. **Never fold a taniwha column into an existing
select.**

**`event_domains` is the roster mirrored into SQL** (120 rows, from `lib/eventData.ts`), because
the server must know an event's domain to award a crown without trusting the client. It cannot
use `session_events.domain_number`: that records the numbering **of the day**, and June 2026
renamed AND renumbered the domains together (Power was #5, is now #3) while August 2026 moved
five more events. Counting on it would credit a May 2026 Power win to Anaerobic Endurance and
release a crown for a domain the player never competed in. Two tests read the migration file and
fail if it drifts from `EVENTS`. **Any roster change must update both.**

**A pre-existing bug fixed in the same migration:** `close_expired_sessions()` has failed for
every logged-in non-judge caller since `20260820000000`. It closes the session, the award trigger
does `UPDATE results SET placement`, and `guard_results_write()` sees a non-judge writing into a
now-closed session and raises 42501 — aborting the whole transaction. It went unnoticed because
`/leaderboard` is public so **anon** callers succeed, and pg_cron sweeps up within five minutes as
a superuser. Fixed with a transaction-local `allsport.server_write` flag the guard honours; a
client cannot set it, because PostgREST only populates GUCs under the `request.` prefix.

**Still blocked on people, not code:** the reo review (Hiko, Manawanui, Mataara and **Ruruku** are
placeholders, plus the near-collisions Kaha/Kaha Tinana, Manawanui/Manawaroa and **Hiko/Hiku**,
and the macron on `ō`), and the twelve drawings sliced into ten registered layers each.

## Dashboard redesign — stats page, player tabs, bottom nav (August 2026 session 32)

`/dashboard` stops being an action hub and becomes a **stats page**; the family
switcher becomes global; a **five-tab bottom bar** replaces the hamburger. Design
settled over two `/grill-me` rounds and a design canvas; the spec with all 16
locked decisions is `DASHBOARD_REDESIGN_PLAN.md`.

**BUILT, NOT COMMITTED, NOT APPLIED.** One new migration is written and waiting.

- **The dashboard is four blocks**: identity + seasonal rank → taniwha card →
  four numbers (Games · Events Won · Games Won · PRs) → a ten-spoke skill radar.
  Everything else moved: play history and the taniwha picker to **`/taniwha/history`**,
  the collection to **`/taniwha`**, and judge/koha/profile/PRs into the nav.
- **`lib/activePlayer.ts` is the pure half of the switcher, `lib/useActivePlayer.ts`
  the hook.** The split is not tidiness: the hook calls `createClient()` at module
  scope, so importing it from a test throws before an assertion runs. Same reason
  `lib/judgeRoster.ts` and `lib/percentile.ts` are pure.
- **`resolveActiveId` is a real guard.** `allsport_active_player_id` is editable
  from any console and RLS on `players` fails SILENTLY — a query for a stranger's
  row returns zero rows, not an error — so a stored id is honoured only when it
  names someone in the household. Without it the page renders empty under someone
  else's name instead of refusing.
- **The switcher must be set through the hook, never by writing localStorage.**
  `/profile` did the latter for three months, which is why only `/dashboard` ever
  followed a switch: writing the key persists the choice but tells nothing that is
  already mounted. A parent switched to their child, opened Personal Bests, and
  silently saw their own.
- **Limb dates are DERIVED, not stored.** `player_taniwha` holds a count, not a row
  per limb. `limbCrossings()` reconstructs when each limb landed by running session
  points in date order and watching each 1,000-point boundary — the same technique
  the colours backfill used. It deliberately does NOT claim which taniwha a limb
  went on, because switching is not recorded either.
- **`limbsHeld()` counts the crown as the LAST piece.** `body_parts` caps at
  `BODY_PARTS_PER_TANIWHA` because the crown is earned rather than bought, so a
  crowned taniwha STORES 10 and must DISPLAY 11. The off-by-one looks deliberate,
  so nobody reports it. Written against the constants, not literals, which is why
  it survived the ten-parts change on `main` unaltered.
- **Name a piece with `partFor(taniwha, n)`, never `partByNumber(n)`.** Piece ten
  is the implement and differs per taniwha — Kaha earns a barbell, Tika a bow.
  `partByNumber` would tell every player they earned a generic "Taputapu". The one
  deliberate exception is the limbs-earned list in Taniwha History, which uses
  `partByNumber` BECAUSE it does not know which taniwha the piece went on.
- **`player_dashboard(uuid[])` loads the whole household in one call**, so switching
  players costs no network. INVOKER rights, reads through RLS — a parent gets their
  child's rows because the child's own policy grants it, and a stranger's id returns
  an empty array from the policy rather than a leak. **Taniwha data is deliberately
  NOT in it**: a missing table degrades to a hidden card, a missing column returns
  42703 and would take the entire dashboard down with it.
- **`event_placement` is the one hard dependency.** My Events' average-placement
  column needs it, and it ships in the unapplied `20260824220633`. It is its own
  guarded query, so pre-migration the column shows dashes instead of 42703-ing the
  page. Everything else in this pass degrades cleanly.
- **`lib/colours.ts` now has exactly ONE consumer**: the pre-migration accent
  fallback in `components/PlayerTabs.tsx`. Once the taniwha migrations are applied
  and that fallback is removed, nothing imports it — the history page renders
  `colour_awards.colour_name` as a stored string, not through the ladder.
- **The macron is settled**: `Te Taniwha o te ___`, unmacronised, across all twelve.
  `app/leaderboard/page.tsx` strips that prefix by literal string match, so the
  spelling there and in `lib/taniwha.ts` must not drift apart.
- **`gloss` is new on `Taniwha`** — the English name shown under the te reo one.
  "Taniwha of Connection" is Tāne's; the other eleven are unconfirmed, as are the
  four placeholder names they sit under.

**`TaniwhaFigure` has TWO renderers and picks by probe.** Where the art exists it
layers `/taniwha/{slug}/{piece}.png` as CSS masks filled with the taniwha's ink —
the same pipeline as EventIcon, and the first call site `partAssetSrc()` has ever
had. Where it does not, it falls back to filler geometry, so the eleven taniwha
still undrawn render as shapes rather than nothing. The probe is one image load per
taniwha per page load, cached at module scope; a missing folder falls back silently
and must never produce half a creature. Whānau is drawn (11/11, verified by
`node scripts/check-taniwha-art.mjs whanau`); the other eleven are not.

---

## Security posture (August 2026) — read before touching RLS or players_public

An OWASP pass (SQL injection / XSS / auth / access control) found three
exploitable access-control holes. All three are closed in prod, verified
2026-08-19 with the public anon key and no account. SQL injection, XSS and
authentication came back clean: there is no dynamic SQL anywhere in the
migrations, no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere in the app,
auth is entirely Supabase Auth with no hand-rolled tokens, and no `service_role`
key exists in client code.

**`players` is no longer publicly readable.** It was `USING (true)` from the
April 2026 rebuild, so one unauthenticated request returned all 27 players with
19 emails, 9 phones, 27 dates of birth and one minor's guardian contact details.
Anything needing another player's row now reads **`players_public`**.

**Five rules that are not obvious and have each already cost a production
incident:**

1. **`CREATE OR REPLACE VIEW` can only APPEND a column.** It cannot rename,
   reorder, retype or remove one, and on a mismatch it aborts the ENTIRE
   `supabase db push` part-way through, leaving a half-migrated schema. This bit
   twice. `20260816000000` is therefore the single definition of
   `players_public` and uses **DROP + CREATE** so it lands whatever shape it
   finds. `20260813000002` is a deliberate no-op; do not put a definition back
   in it.
2. **Changing a `players_public` column means sweeping every caller in `app/`
   first.** The view and the client drifted apart twice in three days, and each
   time three queries began returning `42703` in prod — the live session's
   player-info map, the kaiwhakawā roster, and the game report — so the in-game
   leaderboard listed nobody and the game report showed no names. RLS failures
   are worse: they return zero rows rather than an error, so the page empties
   silently with nothing in the console.
3. **Apply migrations from `main` only.** A migration applied from an unmerged
   branch is recorded in prod's history with no file in the repo, and the CLI
   then refuses to push anything at all until that file is committed. That is
   what blocked the PII lockdown. The CLI suggests
   `supabase migration repair --status reverted <version>` — **do not use it**;
   that claims a change is absent from a database that has it. Commit the file.
4. **A `from('players')` grep does NOT find a PostgREST embed.** `/leaderboard`
   resolved every player name through
   `rankings … select('…, players(display_name, username)')`, which reads the
   players BASE table. It survived three separate sweeps for "every cross-player
   read", across three sessions, because nobody greps `players(`. **When
   restricting a table, grep `tablename(` as well as `from('tablename')`.**
   For what it actually does when it breaks, see the comment at the query in
   `app/leaderboard/page.tsx` — measured, not assumed: a 401 / `42501` that
   takes the whole request down, because PostgREST fails the entire query when
   an embedded table is unreadable. Not the silent null-names case.
5. **Never reuse a migration timestamp.** Two branches independently wrote a
   `20260813000000`. One ran; the other was recorded as applied and then
   **skipped forever** — so `guard_players_privileged_columns()` and its trigger
   were absent from production for six days while the PR that added them showed
   as merged, leaving kaiwhakawā self-promotion unguarded. Nothing surfaces
   this: `db push` says "Remote database is up to date" and `migration list`
   shows a tick against both columns. Only `pg_proc` / `pg_trigger` tell the
   truth. Create migrations with `supabase migration new`, which allocates the
   timestamp for you, and never hand-name one.

**Verify a migration by querying the objects it should have created, never by
trusting the migration history.** Every incident in this section was invisible
in `supabase migration list`.

**Parallel worktrees are the shared root cause.** Several Claude sessions work
this repo at once from `.claude/worktrees/`, and `supabase/.temp/` is gitignored
so a worktree is never CLI-linked. Before writing a migration or editing
`players_public`, `git fetch && git log --oneline --all` and check whether
someone is already doing it.

**`players.role` is pinned by a trigger, not by grants.** A table-level UPDATE
grant overrides column-level REVOKEs in Postgres, so the column-grant route
would mean enumerating every writable column and would silently break
registration the next time a column is added.

**`public.is_judge()` is `SECURITY DEFINER` for a reason.** A policy ON `players`
that subqueries `players` raises `infinite recursion detected in policy`. Use
the function in any new policy on that table.

**`raw_score` remains player-submitted, deliberately.** There is no server-side
truth to validate it against, and the sport already requires a filmed or
witnessed result. `20260813000001` bounds the damage instead: writes only into an
open session, points columns never accepted from a client, guests judge-only.

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
| Home | / | Complete | Hero, ethos, colours (cycle 1 + a "beyond Taniwha" line), CTA. *(No "My Colour History" button exists — an earlier claim here was wrong.)* |
| How To Play | /how-to-play | Complete | Rules, scoring, 10 domains. Links to /events |
| Events Index | /events | Complete | All 100 events grouped by domain, links to detail pages |
| Event Detail | /events/[slug] | Complete | Template page: how to perform, rules, tiers, personal best |
| Schedule | /schedule | Complete | Times correct (4:30pm Tue/Thu, 9am Sat), Championship 14 Mar 2027 |
| Leaderboard | /leaderboard | Complete | Real data, All-Divisions tab, active session live banner |
| Koha | /koha | Complete | Tiers, IRD rebate |
| Play | /play | Complete | Login/register landing, Google OAuth |
| Register | /register | Complete | 3-step form, division, display prefs, junior parent fields |
| Login | /login | Complete | Email + Google OAuth |
| Dashboard | /dashboard | Complete | Bento grid: Judge card (judge-only), Vote card (when active), Player Profile card, Colours card (points history on click), Personal Bests card, My Events card (segmented coverage bar + Top Domain/Event percentiles, opens My Events modal — session 24 redesign of the former "My 100" card), Join a Game card (next-session countdown when idle) |
| Judge Panel | /judge | Complete | Players tab opens with an **"Approaching a colour"** watchlist (sessions-away). Dedicated page — JudgeCard moved here. Create/end/void sessions, QR code, history, real-time player count, Event Votes panel (Kōwhiringa Tūāhuatanga). Judge bento card on dashboard links here. |
| Player Profile | /profile | Complete | Icon picker (20 sport emojis), username/display name editing, leaderboard display prefs, family member management (add/remove), active profile switcher (localStorage) |
| Scoring Setup | /scoring | Complete | Select 10 events, editable start time, create session |
| Live Session | /scoring/[sessionId] | Complete | Per-division leaderboard tabs, Kaiwhakawā mode (player picker + score/edit/delete for any player), difficulty tier selector, sport W/D/L display, missing scores = last place, post-game popup on session end |
| Personal Bests | /prs | Complete | Collapsible domain sections (collapsed by default, `DomainIcon` + `n/total` PB count + chevron per domain); expanded domain reveals event rows each with a 36px `EventIcon` (dimmed when no result); PR per event, expandable per-event history, this season + previous seasons tabs |
| Vote | /vote/[voteId] | Complete | Step-by-step voting flow, one domain per screen, partial save, review screen, locked on submit |
| Vote Results | /vote/[voteId]/results | Complete | Spoiler-free until voted, bar chart per domain, counts only while open / percentages on close, judge full breakdown |
| Game Review | /games/[sessionId] | Complete | Full all-player game report — every division, every event with score + placement, division standings. Linked from dashboard session history. Any logged-in player. Placements computed live from raw_score |
| Auth Callback | /auth/callback | Complete | Google OAuth handler |
| Invite Landing | /join/[code] | Planned | Public page — introduces AllSport, shows inviter name, Register CTA with referral code pre-filled. **The referral system itself is BUILT** (`20260515000002`: `referrals`, `players.referral_code`, the qualifying trigger; `/my-koha` reads it) — an earlier version of this doc listed the whole feature as Planned. Only this landing page is missing. |
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
id, created_at, full_name, email, phone, date_of_birth, gender, city, region, country,
parent_name, parent_email, parent_phone, is_active, is_guest, username, division,
role (default: player), show_full_name, show_username, show_division, show_location, display_name,
parent_id (uuid, references auth.users.id),
icon (TEXT — emoji placeholder; null = show initial letter),
referral_code (TEXT UNIQUE — 6-char alphanumeric, auto-generated on registration)
*(Column list verified against prod 2026-08-19; `bodyweight_kg` removed 2026-08-21
when `20260821000000_privacy_tidyup` dropped it. There is NO `address` column — an
earlier version of this doc listed one. `gender` and `is_guest` were missing.)*

**Keep this list honest.** It is not decoration: a plpgsql trigger that assigns
a field the table does not have raises at RUNTIME, not at migration time. The
first draft of `20260813000001` took `rank_in_session` and `adjusted_score` from
an earlier, stale version of this section, and would have broken every score
submission on the first insert. Verify against prod before writing SQL from it.

**RLS since 20260813000003: NOT publicly readable.** SELECT is own row, your
children (`parent_id = auth.uid()`), or kaiwhakawā via `public.is_judge()`, and
`anon`'s table grant is revoked outright. Anything needing another player's row
reads `players_public` instead. `role`, `is_guest`, `parent_id` and `id` are
pinned by a trigger — see the security block below.

### players_public (VIEW)
id, display_name (coalesced, never blank), username, full_name (NULL unless
`show_full_name`), division, icon, is_active, is_guest, age_years, age_group
(U10/U12/U14/U16, NULL past 16), show_division
Owner-rights (`security_invoker = off`) so it reads through the RLS that closes
`players`. Public read (anon + authenticated). **The only sanctioned path to
another player's row.** Exposes no email, phone, city, region, country, gender,
guardian contact, bodyweight, referral_code, role or date_of_birth.
Defined ONLY by `20260816000000` (DROP + CREATE), corrected for NZ-local age by
`20260819000000`. See the deploy-order warning below before changing a column.

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
id, created_at, player_id (nullable), session_id, event_id, raw_score, score_label,
placement, placement_points, points_earned, bonus_points_total, difficulty_tier,
exercise_variation, weight_kg, reps, time_seconds, distance_m,
opponent_name, match_score, result_type, notes, player_name,
is_pr (bool), effort_task_completions (int)
*(Verified against prod 2026-08-19. There is NO `score`, `rank_in_session`,
`adjusted_score` or `pose_variation` column — the v2 rebuild in 20260429000000
dropped them, and earlier versions of this doc still listed them. This matters:
a plpgsql trigger assigning a non-existent field raises at runtime and would
break every score submission.)*

**Writes are guarded since 20260813000001.** Non-judges may only write into a
session that is still open, `placement` / `placement_points` / `points_earned` /
`bonus_points_total` are preserved from OLD (never accepted from a client),
`effort_task_completions` is clamped 0–20, and only kaiwhakawā may create guest
rows (`player_id IS NULL`). Judges and `service_role` are exempt, which is what
lets `award_session_points` write placements at session close and lets the Judge
Summary tab edit after the fact.

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
**Still seasonal — drives the /leaderboard ranking only.** Colours no longer read this.
Known latent bug: division is in the unique key, so a player who changes division mid-season
splits across two rows and double-counts on the All-Divisions tab (logged in TODOS.md).

### colour_ladder
rung (1–19 PK), name, threshold. Seeded by 20260802000000. Mirrors `lib/colours.ts` so the
trigger and backfill can join on thresholds. Public read.

### player_totals
player_id (PK → players, NO season/division), earned_points (recomputed), adjustment_points
(manual, survives recompute), lifetime_points (GENERATED = earned + adjustment),
lifetime_sessions, highest_rung, updated_at
Public read; writes only via SECURITY DEFINER functions. Maintained by
`recompute_player_total()` — a full recompute, never an increment.

### colour_awards
id, player_id (→ players), rung (2–19; Mā is the start, not an award), colour_name (snapshot),
points_at_award, session_id (→ sessions, null for adjustment-only rungs), awarded_at,
celebrated_at (set by the kaiwhakawā's "Celebrated" tap)
UNIQUE(player_id, rung) — this is what makes the mid-session claim and the close trigger
idempotent against each other. **Append-only: a colour is never revoked.**
RLS: own + parent (family) + judge.

### Key Logic
- player_id on results is nullable (players can join by name without account)
- Realtime enabled on session_events and results
- RLS enabled on all tables
- Session auto-locks 100 minutes after `started_at`, via the `close_expired_sessions()` RPC
  (`20260820000000`), called from the live-session timer, the dashboard, the leaderboard, AND by
  pg_cron every 5 minutes (`20260820000002`). **This line used to claim the lock happened and it
  did not.** The old mechanism was a client-side `sessions.update()`, and `sessions_update_judge`
  is the only UPDATE policy on that table, so it silently affected zero rows for every player and
  a game only ever closed if a kaiwhakawā had the live screen open at the exact minute. An
  un-closed session awards NOBODY anything, because `award_session_points` fires on the
  `is_active` true→false transition — the 2026-08-19 game sat open overnight with 13 results and
  zero placements. The RPC derives expiry from `started_at` server-side, so it is granted to
  `anon` deliberately: a caller can only ask it to check, never choose the outcome, and
  restricting it would rebuild the original bug. `ended_at` records when the game actually ran
  out, not when it was noticed, and `points_awarded_at` is untouched so Void still suppresses
  points.
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
  next.config.ts                    # reactCompiler + headers() — serves the security header set on /:path*
  middleware.ts                     # REQUIRED — refreshes Supabase session on every request; also forwards Supabase's no-store headers onto the response
  lib/
    supabase.ts                     # Basic client (legacy — DO NOT USE in new code)
    supabase-browser.ts             # Browser client (use this in ALL client components)
    supabase-server.ts              # Server client
    supabase-cookies.ts             # AUTH_COOKIE_OPTIONS — MUST be passed to every Supabase client (secure/sameSite/path). See HTTP security below
    securityHeaders.ts              # buildCsp / buildSecurityHeaders — the CSP + 8 headers, unit tested in __tests__/securityHeaders.test.ts
    eventData.ts                    # Single source of truth for all events (120) + difficulty+time encode/decode helpers (encodeDiffTime/decodeDiffTime/isTimedEffort, TIMED_EFFORT_SLUGS); DifficultyTier has optional `detail` (judge criteria)
    dates.ts                        # parseLocalDate / formatNZDate — parse DATE columns in local time (avoids off-by-one)
    activePlayer.ts                 # Pure half of the family switcher — resolveActiveId/playerLabel. No React, no Supabase, so it is testable
    useActivePlayer.ts              # The hook over allsport_active_player_id. Cross-component + cross-tab sync
    useNavState.ts                  # Shared PLAY destination for BottomNav and the desktop top bar
    colours.ts                      # RETIRED ladder, kept as a LOOKUP TABLE so the dashboard timeline can render historical colour_awards. Do not add to it
    domainColours.ts                # THE ten domain colours. In lib/ so SERVER components can import it
    taniwha.ts                      # THE taniwha ladder — 12 taniwha, 10 parts, budget/capacity map, crown predicates
    taniwhaAlerts.ts                # taniwhaAlerts (live) + taniwhaWatchlist (/judge) + provisionalWins + crownHint + winsByDomain
    rating.ts                       # divisionPool (unified men/women/juniors pools) + sessionWins. The Elo engine was DELETED Aug 2026 (zero call sites once percentiles landed) — see PERF_AGGREGATION_PLAN.md
    judgeRoster.ts                  # Kaiwhakawā roster derivation — buildJudgeRoster/resolveJudgeTarget/resultsForTarget/scoredEventIds(ByTarget)/rosterKeyFor; guests keyed `guest:{player_name}`
    # fetchAll.ts DELETED Aug 2026 — /leaderboard + /dashboard moved to the stats_bundle/leaderboard_page RPCs, which have no 1000-row cap to page around
  app/
    page.tsx                        # Homepage — colour list sourced from lib/colours.ts (cycle 1 + Ngā Taniwha teaser)
    layout.tsx                      # Root layout
    globals.css                     # Design system
    play/page.tsx
    how-to-play/page.tsx            # Links to /events. SERVER component (Aug 2026) — interactive domain accordion split out below
    how-to-play/DomainAccordion.tsx # Client island for the domain accordion; receives `domains` already derived so eventData.ts stays server-side
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
    BottomNav.tsx                   # Five-tab bottom bar (phones) + the MORE sheet. Hidden >768px by .bottom-nav in globals.css
    PlayerTabs.tsx                  # Sticky family switcher + ViewingAsBanner. Renders null on a solo account
    DomainRadar.tsx                 # Ten-spoke skill radar, one spoke per domain, driven by Top %
    TaniwhaFigure.tsx               # The eleven pieces assembling. Real art via CSS mask where drawn, filler geometry where not
    TaniwhaCard.tsx                 # Dashboard taniwha card + TaniwhaPicker + TaniwhaTimeline
    TaniwhaWatchlist.tsx            # "Approaching a crown" panel — /judge, leads with the BLOCKER not sessions-away
    TaniwhaAlertBanner.tsx          # Live kaiwhakawā crown alert (earned / on-track)
    DomainIcon.tsx                  # Domain pictogram tile — CSS-mask of /domain-icons/{slug}.png in domain colour, domain-number fallback; exports domainSlug()
  public/
    event-icons/                    # Canva silhouette exports, transparent PNG named {slug}.png (see README.md inside)
    colour-emblems/                 # taniwha.png (Taniwha + all cycle 2) and nga-taniwha.png (rung 19) — masked + tinted like event icons. PENDING
    domain-icons/                   # Canva silhouette exports, transparent PNG named {domain-slug}.png (maximal-strength, calisthenics, power, speed, anaerobic-endurance, aerobic-endurance, flexibility, body-awareness, coordination, aim-and-precision); masked + tinted the domain colour like event icons
  supabase/
    config.toml                       # Supabase CLI config (project_id = "allsport"); linked project ref lives in supabase/.temp (gitignored)
    README.md                         # Migration workflow — how to link, baseline, and run `supabase db push`
    migrations/                       # All files renamed to unique 14-digit timestamps (YYYYMMDDHHMMSS) for CLI compatibility (July 2026)
      20260420000000_phase1.sql
      20260428000000_phase2.sql           # difficulty_tier column; updated award_session_points trigger
      20260505000000_judge_player_management.sql
      20260510000000_drop_disadvantage_columns.sql
      20260510000001_per_division_points.sql
      20260512000000_effort_system.sql
      20260513000000_drop_effort_scores.sql
      20260513000001_event_voting.sql     # event_votes, event_vote_nominations, event_vote_responses tables + RLS + functions
      20260514000000_dashboard_redesign.sql # players.icon, session_player_summary, get_player_top_event RPC, updated trigger
      20260526000000_fix_points_trigger.sql  # Remove bonus system; fix gap formula
      20260526000001_fix_trigger_add_summary.sql  # (was 20260526b)
      20260629000000_fix_placement_and_timed_events.sql  # Overall placement (missing event = last in division), points-doubling fix, timed-event raw_score re-encode — supersedes 20260526*; run ONCE
      20260707000000_leaderboard_cleanup.sql  # average_placement trigger + backfill, merge orphaned 'Youth' rankings rows
      # ── everything above is applied to prod and baselined as applied in the CLI (see supabase/README.md) ──
      20260713000000_fix_double_award.sql     # (was 20260713) Drop orphaned on_session_end trigger (×2 bug), atomic claim guard, rebuild 2026 rankings — run ONCE
      20260713000001_breath_hold_duck_walk.sql # (was 20260713b) One-time re-encode: Breath Hold → positive secs, Duck Walk → new walk ladder — run ONCE, after 20260713000000
      20260714000000_wellbeing_survey.sql     # (was 20260714) wellbeing_surveys table + RLS + get_wellbeing_report() RPC — idempotent
      20260801000000_roster_update_120.sql    # Repoint 24 renamed events on session_events.event_name; archive + delete Leg Extension results
      20260802000000_lifetime_colours.sql     # Lifetime colours: colour_ladder/player_totals/colour_awards, recompute_player_total,
                                              #   claim_colour_award RPC, award_session_points extension, backfill + timeline reconstruction.
                                              #   DEPLOY MIGRATION FIRST, THEN CODE (additive; the new client code requires player_totals).
      # ── ALL migrations above are APPLIED to prod, confirmed 2026-08-01. `supabase db push` offered only
      #    20260801000000, meaning the three 2026071x files were already recorded as applied; wellbeing_surveys
      #    was verified to exist, and db push applies in timestamp order, so they genuinely ran. There are NO
      #    pending migrations. Do NOT re-run the 2026071x files "to be sure" — 20260713000001 is a one-time
      #    re-encode and applying it twice corrupts Breath Hold / Duck Walk scores.
      20260813000000_role_escalation_guard.sql # public.is_judge() + trigger pinning players.role/is_guest/parent_id/id
      20260813000001_results_write_guard.sql   # results writes confined to an open session; points columns server-only; guests judge-only
      20260813000002_players_public_view.sql   # DELIBERATE NO-OP — see the file. Do not put a view definition back here.
      20260813000003_players_pii_lockdown.sql  # Closes public read on players (own/child/judge + REVOKE anon)
      20260816000000_players_public_show_division.sql # THE definition of players_public (DROP + CREATE)
      20260819000000_players_public_age_nz.sql # age_years/age_group in Pacific/Auckland, not UTC
      20260820000000_close_expired_sessions.sql # close_expired_sessions() + one-time backfill of stranded games
      20260820000001_harden_search_players.sql  # search_players_by_username → players_public, SECURITY DEFINER dropped, anon revoked
      20260820000002_schedule_close_expired_sessions.sql # pg_cron every 5 min; exception-guarded, NEVER aborts the push
      20260821000000_leaderboard_rpc.sql       # stats_bundle() + leaderboard_page(p_season): collapse the
                                               #   7-request /leaderboard fan-out into one round trip.
                                               #   INVOKER rights, reads players_public (NOT players).
      20260821000001_drop_orphaned_bonus_tables.sql # archive (RLS-on, no policies) then drop bonus_completions + bonus_sport_opponents
      20260821000002_pin_wellbeing_search_path.sql  # last SECURITY DEFINER function without a pinned search_path
      20260824220633_event_placements.sql      # APPLIED 2026-08-25. results.event_placement/event_field_size +
                                               #   backfill, player_event_wins view, guard extended,
                                               #   close_expired_sessions fix.
      20260824222612_player_taniwha.sql        # APPLIED 2026-08-25. player_taniwha, event_domains (120-row roster
                                               #   mirror), sync/choose/claim functions, backfill.
      20260824233516_leaderboard_taniwha.sql   # leaderboard_page(): colour_rungs key -> taniwha (crowned + building).
                                               #   ⚠ MIGRATION FIRST, THEN CODE — the client reads the new key.
      20260826004819_player_dashboard_rpc.sql  # NOT APPLIED. player_dashboard(uuid[]) — whole household in one call.
                                               #   INVOKER rights; taniwha data deliberately excluded (see its header).
      20260822000000_privacy_tidyup.sql        # self-serve export/erasure, optional legal name, drops players.bodyweight_kg.
                                               #   RENUMBERED from 20260821000000 — see the collision note below.
      # ── 20260813000003 needed `supabase db push --include-all`: its 13-Aug timestamp is older than the
      #    19-Aug migration already applied, and the CLI refuses out-of-order inserts without that flag.
      #
      #    TIMESTAMP COLLISIONS ARE INVISIBLE TO GIT AND FATAL TO THE CLI. Different filenames merge
      #    without a conflict, but schema_migrations is keyed on the numeric PREFIX ALONE, so one version
      #    cannot hold two files. This has happened THREE times in two weeks, each from a branch that was
      #    open while something else merged:
      #      · 20260816000000 — leaderboard_rpc vs players_public_show_division (caught pre-push)
      #      · 20260821000000 — leaderboard_rpc vs privacy_tidyup (privacy_tidyup renumbered → 20260822000000)
      #      · 20260821000000 — privacy_tidyup vs pin_wellbeing_search_path (the latter → 20260821000002)
      #    Run this before pushing any branch that has been open a while:
      #      ls supabase/migrations | cut -c1-14 | sort | uniq -d
      #
      #    ⚠️  UNRESOLVED: which file owns prod's 20260821000000 row. leaderboard_rpc was pushed under that
      #    version and its functions verified; privacy_tidyup's objects also exist but likely arrived by
      #    another route, since only one row can exist per version. `migration list` looks complete either
      #    way, which is why nobody noticed. Settle it before any `db reset` or rebuild-from-migrations:
      #      select version from supabase_migrations.schema_migrations where version = '20260821000000';
      #    then confirm which file's objects that row was actually meant to record.
  public/
    logo.png                          # 3666x2204 design master — NOT served; browsers get logo-hero-*.webp /
                                      #   logo-mark.webp / favicon-32.png (regenerate: scripts/gen-logo-assets.mjs)
```

### A duplicate migration version is applied SILENTLY AS A SKIP

This has now happened **twice in two weeks**, both times across parallel
worktrees, and both times `supabase db push` reported success.

The CLI keys on the **14-digit version alone**. It never looks at the rest of
the filename or the contents. So two files numbered `20260821000000` are one
migration as far as it is concerned: whichever is applied first claims the row
in `supabase_migrations.schema_migrations`, and the other is treated as already
applied and **skipped without a word**.

- `20260816000000` — `leaderboard_rpc` (this branch) vs `players_public_show_division`
  (main). Caught before pushing, by reading `supabase migration list` rather
  than trusting the branch.
- `20260821000000` — `leaderboard_rpc` vs `privacy_tidyup`. The RPC was pushed
  first and holds the row; `privacy_tidyup`'s objects reached prod by some other
  route (`delete_my_account()` does exist — checked, 2026-08-22), so nothing was
  broken, but the migration had no row of its own and the ledger no longer
  matched the files. Renumbered to `20260822000000` and re-applied, which is
  safe because that file is idempotent.

  Note the failure mode here was **silent and benign-looking from both ends**:
  `db push` reported success, and the feature worked. Only the ledger was wrong.
  Do not assume a collision means the second migration never ran — check whether
  its objects exist before concluding anything.

Rules that follow:

1. Before adding a migration, run `ls supabase/migrations | tail` against an
   **up-to-date main**, not your own branch. A worktree that is a few days old
   cannot see the collision it is about to create.
2. `supabase migration list` is the only trustworthy check. A row with a version
   in **both** columns is applied. A blank Remote is pending. A blank **Local**
   means prod has a migration this branch does not — you are behind, and any new
   file you add is at risk of colliding.
3. Renumber the file that has **never been applied**. The applied one has to keep
   its number or the recorded history stops matching the file that produced it.
4. `db push` reporting success is not evidence that your migration ran. Verify
   the objects exist.

### Verifying an RPC that public pages depend on

`supabase db push` and the SQL Editor both run as `postgres`, which has
**BYPASSRLS**. A function that reads the wrong table therefore passes every check
you can run there and still returns nothing to the visitors it exists for — and
RLS returns no rows rather than an error, so it fails silently.

Test the actual role:

```sql
begin;
set local role anon;
select jsonb_array_length(public.leaderboard_page(2026) -> 'stats' -> 'players') as players_as_anon;
rollback;
```

For `20260821000000` this was the difference between a green tick and a broken
board: the function originally read `players`, which `20260813000003` closed and
revoked anon's grant on. It now reads `players_public`. Confirmed as `anon` on
2026-08-21: 20 rankings, 27 players, names resolving.

**IMPORTANT:** Always use createClient() from @/lib/supabase-browser in client components.

---

## HTTP security (August 2026 session 29) — v0.5.5.0

Before this, the app sent **no security headers at all** (`next.config.ts` had no
`headers()` block), so the only one in production was the HSTS Vercel adds by itself.

**`lib/securityHeaders.ts` is the single source of truth** for the CSP and the other
seven headers; `next.config.ts` just applies it to `/:path*`. It lives in `lib/` so it
can be unit tested, because **a security header fails silently when it regresses** —
delete `frame-ancestors` and nothing breaks, no test goes red, the app is simply
framable again. `__tests__/securityHeaders.test.ts` is the only thing that notices.

- **`connect-src` is derived from `NEXT_PUBLIC_SUPABASE_URL`,** never hardcoded, and
  covers BOTH `https://` and `wss://`. Allowing https but not wss silently kills live
  score updates and is easy to miss, because the 15-second polling fallback masks it.
- **`script-src` keeps `'unsafe-inline'` deliberately.** Next's App Router injects
  inline bootstrap scripts on every page; removing it needs per-request nonces, which
  force every route dynamic and give up static prerendering. The CSP's value here is
  `default-src`/`connect-src` blocking exfiltration and `frame-ancestors` blocking
  clickjacking, NOT inline-XSS defence. Safe because there is no
  `dangerouslySetInnerHTML` anywhere in the app.
- **`style-src` keeps `'unsafe-inline'`** because the app styles via React
  `style={{ }}` props. Removing it blanks every page.
- `img-src` allows `https:` for `partners.logo_url`; `frame-src`/`object-src` are
  `'none'` (verified: no iframes, no external form actions anywhere in the app).
- **ACAO is pinned to the site origin** because Vercel serves prerendered HTML with
  `Access-Control-Allow-Origin: *`. **Next's `headers()` does override Vercel's
  static-asset layer — confirmed against prod 2026-08-13**, which returns
  `access-control-allow-origin: https://allsport.nz`. No `vercel.json` needed; this
  file's `headers()` block is the single source of truth. (Had Vercel won, the fix
  would have been to move the same list into a `vercel.json` `headers` block.)

**Verified live 2026-08-13:** all 8 headers serve on allsport.nz with the exact values
`buildSecurityHeaders()` produces.

**NOT verified end-to-end: the `no-store` forwarding on auth-cookie responses.** See
the P1 in TODOS.md. `curl https://allsport.nz/auth/callback` returns
`cache-control: public` and that is CORRECT — with no `?code=` the route skips the
Supabase block entirely, sets no cookies, and redirects to `/login?error=auth`, so
there is no session token in that response. Only a real OAuth code exchange exercises
the fixed path. **Do not read that curl output as a regression.**

### Auth cookies — three traps
1. **`@supabase/ssr`'s `setAll` takes a SECOND argument** (`headers`) carrying
   `Cache-Control: private, no-store`. It exists so a CDN cannot cache a response that
   sets auth cookies and serve one player's session token to another. Every call site
   here ignored it, and prod served `/auth/callback` (a 307 that sets session cookies)
   as `cache-control: public`. **Any new `createServerClient` call site must forward it.**
2. **The library defaults are `{ path:'/', sameSite:'lax', httpOnly:false }` with NO
   `secure` flag.** `cookieOptions: AUTH_COOKIE_OPTIONS` must be passed to all four
   clients (browser, server, middleware, callback route).
3. **`httpOnly` is deliberately OFF and must stay off** until auth moves server-side:
   the browser client reads the session from `document.cookie`, so setting it signs
   every player out. Logged as a P1 in TODOS.md, not an oversight.

`sameSite` stays `'lax'` — `'strict'` withholds the cookie on the cross-site top-level
navigation back from Google OAuth. `secure` keys off `NODE_ENV`, so a local production
build served over http cannot log in; that is expected, not a bug.

### Open redirect
`/auth/callback` built `${origin}${next}` from an unvalidated query param. `next=@evil.com`
produces `https://allsport.nz@evil.com`, where `allsport.nz` parses as *userinfo* and the
real host is `evil.com`. `safeNext()` now rejects that plus the `//` and `/\` variants.
**Any future redirect built by concatenating onto an origin needs the same guard.**

---

## What's Complete

- Full public website (5 pages)
- 3-step player registration with Google OAuth
- Player dashboard — Colours progress (bar + year tabs), stats, join by code, session history with View Summary
- Kaiwhakawā panel (JudgeCard) — tabbed (Sessions / Votes / Players); Sessions tab: create/end/void sessions, QR code, real-time player count; Votes tab: Kōwhiringa Tūāhuatanga vote management; Players tab: Tāngata — all players sorted by current-year points, tap to expand session history. Te reo term "Kaiwhakawā" used everywhere in display text (DB role value stays as `judge`)
- Live scoring — 100-event pool, all input modes including difficulty tier selector, Kaiwhakawā edit/delete/score-for-any-player, score edit (pre-fill form + UPDATE), missing scores = last place, post-game popup
- Sport results displayed as W/D/L (Wins/Draws/Losses) everywhere: live session event card + collapsed label, leaderboard expanded row, /prs page, /events/[slug] personal best. Format: "3W 1D 2L"
- Leaderboard competitive rows show "Nth of N" division rank context (e.g. "1st of 3")
- Points trigger fixed (May 2026): removed bonus system (was causing 140pts for 1st instead of 100); fixed gap formula (no floor on gap — min 10 applies to earned pts only). Migration: 20260526000000_fix_points_trigger.sql
- Live session leaderboard — redesigned (June 2026): three simultaneous sections (Men's, Women's, Juniors); top 3 expandable per section; each top-3 row tappable to show all event scores + placements; logged-in player pinned below top 3 showing actual rank; Masters/Grandmaster toggle per gender section; Junior age-group chips (exact age); event filter dropdown (session events only, replaces overall ranking with event-specific flat list); age + event filters combinable; effort leaderboard removed (effort shown on event buttons only)
- Live session leaderboard — bug fixes (June 2026 session 14): (1) unified Men's pool (Men's + Masters Men + Grandmaster Men ranked together); same for Women's — fixes Masters Women players being invisible; (2) Masters/Grandmaster players show sub-division rank badge alongside overall rank; (3) Masters/60+ chips are now filters within the full pool, not pool switchers; (4) all three sections (Men's, Women's, Juniors) always rendered even with zero scores — show "No scores yet" placeholder; (5) total placement score (sum of ordinal placements, lower = better) shown on every player row; (6) 15-second polling fallback added alongside realtime subscription so leaderboard always auto-refreshes; (7) Judge Summary tab added to Kaiwhakawā — all divisions, all players, all events, delete scores inline, works post-session
- Effort system — effort tasks generated per event, locked until comp score submitted, effectivePR baseline, reps/hold/sport/tiered modes all handled; event button always shows "Effort Level: N"; award trigger correct (×10 per task, cap 100)
- Divisions — 7 divisions with age labels: Men's, Women's, Juniors (U17), Masters Men (40+), Masters Women (40+), Grandmaster Men (60+), Grandmaster Women (60+)
- Post-game popup — placement, per-event breakdown, bonuses, total points, colour progression moment
- Session history — past session summaries accessible from dashboard
- Colours — LIFETIME points (Aug 2026): 19-rung ladder through Ngā Taniwha, colour timeline replacing year tabs, kaiwhakawā live alert + /judge watchlist, session-end colour headline. See the Colours rework block above
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
- Leaderboard cleanup (July 2026 session 20) — [DR-4] rankings.average_placement now populated by trigger + backfill (migration `20260707000000_leaderboard_cleanup.sql`), legacy Youth tab removed, Grandmaster tab keys fixed ('Grandmasters …' never matched the DB's 'Grandmaster …' so those tabs were always empty), Felix's duplicate Youth rankings row merged, hero + Colour Key copy corrected (colours are earned the moment a threshold is crossed; points reset each January)
- Dashboard next-session countdown (July 2026 session 20) — [DR-5] Card 8 with no session running now shows "Next session: {weekday} {time}" + "in {n} hours/days" computed from the fixed schedule in NZ time (`nextScheduledSession` in dashboard/page.tsx); active-session Join state unchanged
- "My 100" dashboard card (July 2026 session 20) — [DR-6] lifetime event coverage: 10 domain rows × 10 domain-coloured dots + "{n} of 100 events played", derived from distinct event names on results mapped through eventData EVENTS (legacy orphan names don't match — by design); taps through to /prs. Live session shows a "New event unlocked" toast for first-ever events (PR toast still wins)
- Placement-change flash (July 2026 session 20) — [DR-10] live session banner animates "3rd → 2nd" when a new result improves the player's division rank; no animation on first paint or rank drops
- My Events (renamed from "My 100") — percentile redesign (July 2026 session 24) — dashboard card + modal renamed to "My Events"; player-facing Elo "skill" score replaced everywhere (card, modal, /leaderboard Top Domain/Event columns) by a best-score percentile shown as "Top X%" ("1st" when nobody has a strictly higher best incl. shared top, "No comparison yet" for solo events). Card: heading + segmented domain coverage bar + "N / 105" count + Top Domain/Event with icons and Top%. Modal: Session Wins/Avg Place/Games Played header, Strongest+Weakest, collapsible domains (domain + event icons, unplayed dimmed + "Not played"), rewritten explainer, PRs link. `lib/percentile.ts` (pure, all-players, no new queries) + 14 unit tests. Elo (`lib/rating.ts`) retained internally for `sessionWins` only. Leaderboard verified on real data.
- Personal Bests page — domains collapsible (July 2026 session 23) — /prs now renders each of the 10 domains as a collapsible section, collapsed by default. Collapsed row: `DomainIcon` (CSS-mask of `/domain-icons/{slug}.png` in the domain colour, falls back to the domain number in the tinted tile until the PNG exists) + `{n}. DOMAIN NAME` + `{pbs}/{total}` PB-count (events in that domain with a result / total, respects the season/all tab) + rotating chevron. Domains toggle independently (not accordion). Expanded domain reveals the event rows, each with a 36px `EventIcon` left of the name (dimmed to 0.4 opacity for no-result events, which still render); two-level nesting preserved (event rows still expand to full PB history). New `components/DomainIcon.tsx`; new `public/domain-icons/` folder

---

## What's Next (In Priority Order)

1. ~~Apply the pending migrations~~ — **DONE, nothing pending (verified 2026-08-01).** Every migration through `20260801000000_roster_update_120.sql` is applied to prod. `supabase db push` offered only `20260801000000`, which means the three session-22 files (`20260713000000`, `20260713000001`, `20260714000000`) were already recorded as applied; `wellbeing_surveys` was confirmed to exist via the REST API, and `db push` applies in timestamp order, so they genuinely ran rather than being falsely baselined.
   - **Do NOT re-run the 2026071x migrations to "make sure".** `20260713000001` is a one-time re-encode of Breath Hold and Duck Walk `raw_score`s; a second application corrupts those scores. The earlier note in this file claiming they were pending was stale and caused exactly that hazard.
   - **CONFIRMED 2026-08-01:** `select tgname from pg_trigger where tgname in ('on_session_end','auto_award_points');` returns only `auto_award_points`. The orphaned `on_session_end` trigger is gone, so the ×2 games/points root cause is dead — and since dropping it is `20260713000000`'s headline action, this also upgrades that migration from "applied by inference" to directly verified. That migration rebuilt the 2026 rankings from `session_player_summary`, so session counts and point totals now reflect true values rather than the doubled ones.
   - `20260801000000` verified in prod: all 24 renamed names return 0 rows under their old label and non-zero under the new one; 0 results remain attached to Leg Extension (17 archived then deleted); the archive table returns HTTP 401 / `42501 insufficient_privilege` through PostgREST, so its RLS is doing its job.
2. **Felix's date of birth** — DOB is set (2016-12-19). Division was 'Youth' (legacy value); migration `20260617000000_fix_youth_division.sql` (applied) updated all 'Youth' → 'Juniors'. Code also treats 'Youth' as 'Juniors' in both leaderboard pool filters as a fallback.
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
13. ~~Duck Walk tier redesign~~ — DONE July 2026 session 22: all-walk ladder D1–D5 (10m/25m/50m/100m/200m), added to `TIMED_EFFORT_SLUGS`, history re-encoded by `20260713000001`. Old D1/D2 hold rows ('Squat Hold'/'OH Squat Hold') are left as legacy — labels intact, ranked below walks.
14. ~~Season-PR direction bug (time/sprint)~~ — FIXED July 2026 session 19: both PR loaders now always take max raw_score (time/sprint store negative seconds, so max = fastest).
15. ~~Breath Hold ranking direction~~ — FIXED July 2026 session 22: now `hold` mode (raw_score = +secs, longer wins); existing rows flipped by `20260713000001`; generic hold effort task is now 80% of PR ("Hold for X or longer") instead of a flat 2 minutes.
16. **Review drafted event content (session 19)** — Tāne to review the 94 drafted howToPerform/rules entries in lib/eventData.ts, especially the flagged ones: Toe Lift, Kelly Snatch, Repeat High Jump, Australian Football, Tag, Netball.
17. **July 2026 design review (session 20)** — ~~[DR-2] PR toast~~, ~~[DR-3] default to own tab~~, ~~[DR-8] effort cap moment~~, ~~[DR-9] full-house pulse~~ DONE (Phase 1); ~~[DR-1] session-end takeover~~, ~~[DR-7] session-count milestones~~ DONE (Phase 2); ~~[DR-4] /leaderboard cleanup~~, ~~[DR-5] dashboard next-session countdown~~ DONE (Phase 3 — DB side needs `20260707000000_leaderboard_cleanup.sql` run in the SQL Editor); ~~[DR-6] "My 100" card + new-event toast~~, ~~[DR-10] placement-change flash~~ DONE (Phase 4). ALL DR ITEMS COMPLETE — only the migration run remains.

---

## Key Decisions

- Koha only — no set fees
- Tagline: Play EVERYTHING
- Te reo Māori identity throughout
- Taniwha = Black = black belt equivalent, and the top of CYCLE 1. The peak of the whole ladder is **Ngā Taniwha** (rung 19, 100,000)
- **Colour points are LIFETIME (Aug 2026)** — never reset, never revoked. The seasonal `rankings` table still drives the /leaderboard ranking, so the board resets each January but the colour does not
- **Taniwha kept at 10,000 deliberately** despite real data showing that is ~4.5 months for a 3×/week winner, not the 1 year originally wanted. Cycle 2 (+10,000 each, to 100,000) carries the long game instead. Don't "fix" this without asking
- **Cycle 2 skips Mā** ("Taniwha Mā" reads as a demotion) and the ladder hard-caps at rung 19, so "Taniwha" never stacks into "Taniwha Taniwha"
- **A colour alert must be predictive, and conservative.** Points are only written at session close, so a stored-data alert fires after everyone leaves. "Has earned" = `lifetime + 10 + effort×5` (guaranteed floor, no placement ranking), so it can never be taken back and is safe to announce out loud. "On track" uses provisional placement and may retract
- **The kaiwhakawā releases the moment, not the app.** The player sees a new colour only after the coach taps "Celebrated" (or at session close, whichever comes first)
- **Any lifetime total must be RECOMPUTED, never incremented.** The ×2 double-award bug was an increment; seasonal points made that self-heal each January, lifetime points make it permanent. Manual adjustments therefore need their own column (`adjustment_points`) or the next recompute wipes them
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
- Points doubling (session 18): root cause was a stale prod award function summing per-row `points_earned` (duplicated across every event row → ×event count). Corrected trigger computes season total as placement + effort once. Migration `20260629000000_fix_placement_and_timed_events.sql`
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
- **Renaming an event requires a `session_events.event_name` backfill migration** (August 2026): keeping the slug is NOT enough. /prs, `lib/percentile.ts` and the My Events card all group results by event_name, so a rename detaches every score ever set on that event; `lib/scoring.ts` also matches weight-scored tiers on the name literal. Checklist for any future rename: (1) write the backfill, deriving old names from git history of eventData.ts rather than memory, (2) grep lib/ and app/ for the old name string, (3) deploy the code BEFORE running the migration or `getEventByName()` goes undefined mid-session
- **Never merge history across a rename that changed the movement** (August 2026): OHP → Clean & Press, Cornhole → Bocce and Sprint Repeats → Bronco were logged as renames but are different activities, so their old rows stay orphaned rather than crediting a PR to something nobody did. Bowling/Kubb is date-dependent (pre-May-2026 Bowling became Kubb; Bowling was re-added July 2026) so it is never swept by name
- **A Supabase archive table needs explicit RLS** (August 2026): `CREATE TABLE … AS SELECT` does not inherit RLS from its source, and anything in `public` is reachable through PostgREST. Enable RLS with zero policies — denies all API access while `service_role` keeps BYPASSRLS read for a restore
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
- Historic points migration: `supabase/migrations/20260610000000_historic_points.sql` — adds Salvador +800, Rodrigo +1500, Zeke +1500 to 2025 rankings; run in Supabase SQL Editor
- JudgeCard tab bar: Sessions / Votes / Players tabs; default tab is Sessions; switching to Players auto-loads player list; ordinal helper `ordinalJC` used inside JudgeCard to avoid naming conflict
- Bowling (session 22): `sport` mode W/D/L head-to-head over kaiwhakawā-set frames; slug `bowling`; Kubb unchanged (Bowling→Kubb was a 2026-05 rename; this is a NEW event)
- Skill ratings (session 22): multiplayer Elo per (player, event) from session placements, WITHIN unified division pools (Tāne's call — kinder to juniors than a global pool); K=64 split across field size; always full recompute from history (never incremental — the double-award saga is why); display only the 0–100 score (Elo number stays internal; 0 = unplayed, 50 = pool average, 100 = sustained top-1% dominance)
- "Win" = session win (session 22): finished 1st overall in your division that day (`results.placement = 1`), NOT per-event firsts; used on /leaderboard Wins column and the My Events stat row
- Top domain / top event (session 24): derived from **best-score percentile** (strongest = lowest Top%), NOT Elo skill, so /leaderboard, the My Events card, and the My Events modal tell one story; the old `get_player_top_event` RPC still powers the Player Profile card only
- **My Events = the renamed "My 100" feature (session 24)** — player-facing "skill"/Elo score is retired from the UI in favour of a literal best-score **percentile ("Top X%")**: per event = % of your unified-division pool (who've played it) your best beats, inverted to Top%, floored at 1, "1st" for the pool leader, "No comparison yet" for a solo field; per domain = average of your played-event Top%. Lifetime only. `lib/rating.ts` Elo stays internal for `sessionWins` only. New pure `lib/percentile.ts` (all-players output, no new queries) + unit tests
- Wellbeing survey (session 22): validated instruments only (WHO-5 + HBSC activity + self-rated fitness + 3 VoR-style items); max quarterly (91 days); all players incl. family-member profiles; judges see aggregates only (cohorts: all/rangatahi/adults, n<3 suppressed) + CSV for funder evidence — individual responses are never exposed to judges
- Tier naming rule (session 22): a tier name never repeats its event name and stays ≤~21 chars; judge criteria live in the tier `detail` field (shown in HOW TO + /events/[slug]), separator "·" matches score-label style

---

*Last updated: August 2026 (session 31b — **the taniwha migrations are APPLIED and verified in production**, and the Colours fallbacks are gone. Verified by querying the objects with the public anon key, never by trusting `db push`: 120 event_domains rows, 27 player_taniwha rows, **197 wins backfilled**, budget invariant zero breaches, no guest row with a placement, nobody building two taniwha. The backfill showed Tāne already holds three domains past 9 of 12 and RGFell one, but **nobody has crown room** because everyone is under 10,000 points — points are the binding constraint, exactly as the calibration assumed. Cleanup in the same pass: `lib/colourAlerts.ts` and the two colour components deleted, every fallback branch removed, the points economy moved into `lib/taniwha.ts`, RAINBOW into `lib/domainColours.ts`, and `player_taniwha` folded into `leaderboard_page()` so the performance pass's 7-into-1 collapse stops being 2. Coverage moved with the code rather than being lost — the component test was PORTED to the taniwha components, and the generic ranking helpers are tested in `__tests__/sessionRanking.test.ts`. `npm install` fixed the stale node_modules that had made `colourComponents.test.tsx` unrunnable. See the "Taniwha grading system" block above.)*

*Previous: August 2026 (session 31 — **the Colours ladder became a collection of twelve taniwha**, shipped as v0.6.0.0. Design settled via `/grill-me`; 28 locked decisions in `TANIWHA_SYSTEM_PLAN.md`. Nine parts of every taniwha are bought with lifetime points and the crown must be EARNED: one qualified referral for the whānau taniwha, 9 of 12 event wins for a domain. **The two migrations are written and NOT applied** — apply from `main`, in order, then verify by querying the objects. Until then production still runs Colours and every surface falls back to it, which was verified against prod with the anon key rather than assumed. Findings along the way: the domain palette had **six colours across ten domains in three separate copies**, so four pairs of domains were identical; `session_events.domain_number` cannot be used for domain rollup because June 2026 renumbered the domains and August moved five events, which is why `event_domains` mirrors the roster into SQL; `close_expired_sessions()` has been **failing for every logged-in non-judge caller** since 20260820000000 and only worked because anon callers and pg_cron hid it; and the referral system this doc listed as "Planned" has been built since May. 369 tests. Still blocked on people: the reo review (four domain words are placeholders, plus Hiko/Hiku and two other near-collisions) and the twelve drawings. See the "Taniwha grading system" block above.)*

*Previous: August 2026 (session 30 — **the OWASP remediation applied and verified in production, plus two bugs found while verifying it.** All three access-control findings are shut and confirmed with the public anon key: `players` returns 42501, role self-promotion is trigger-pinned, and score writes are confined to an open session. Verified end-to-end by a real game on 2026-08-19. **The bigger find was that games never auto-ended**: the 100-minute lock was a client-side `sessions.update()` against a table whose only UPDATE policy is judge-only, so it affected zero rows for every player, and the client set its own "Session Ended" state regardless, which is why nobody noticed. An un-closed session awards NOBODY anything — the 19 August game sat open overnight with 13 results and zero placements. Fixed by `close_expired_sessions()` plus pg_cron; the stranded game was backfilled and came back 13/13. Also closed the last three hygiene items (search_path, the orphaned bonus tables archived-then-dropped, the join-code ILIKE wildcard). **Read the "Security posture" block before touching RLS or players_public**, and note the new migration-timestamp warning: a collision is invisible to git and fatal to the CLI. Doc corrections: `players.bodyweight_kg` is gone, and the "session auto-locks" line in Key Logic described behaviour that had not worked for months. Still open, and both deliberately: whether session codes should be public at all, and which of the two parallel branches carrying their own `players_public` survives.)*
*Previous: August 2026 (session 29 — **OWASP access-control pass, closed in production 2026-08-19.** Three exploitable holes, all shut and verified with nothing but the public anon key: `players` was world-readable (27 players, 19 emails, 27 dates of birth, 8 of them minors, one guardian's contact details) and now returns 42501; any player could self-promote to kaiwhakawā via `PATCH {"role":"judge"}` on their own row, now pinned by a trigger; and any player could write fabricated scores into closed sessions, which `award_session_points` then turned into permanent lifetime colour points. SQL injection, XSS and authentication came back clean. New: `players_public` (the only sanctioned path to another player's row), `public.is_judge()`, and migrations 20260813000000-3 / 20260816000000 / 20260819000000. **Read the "Security posture" block before touching RLS or that view** — `CREATE OR REPLACE VIEW` cannot rename a column and aborts the whole `db push` if you try, a `players_public` column change needs a sweep of every caller in app/, and migrations must be applied from `main` only. Each of those three cost a production incident during this session: the view was built three times from three parallel worktrees and applied to prod twice out-of-band, which broke the live session and the game report on two separate days and once blocked `db push` entirely. Doc corrections in the same pass: `players.address`, `results.score`, `results.rank_in_session` and `results.adjusted_score` do not exist and never did in the v2 schema; `gender`, `is_guest`, `is_pr` and `effort_task_completions` were missing. Residual findings tracked in TODOS.md.)*
*Previous: August 2026 (session 28 — **Colours went LIFETIME**, ladder extended to 19 rungs, and a kaiwhakawā colour alert built. Design settled via `/grill-me`; the full record with 19 locked decisions is in `COLOURS_REWORK_PLAN.md`. Seasonal reset removed for colours only — `rankings` is untouched and `/leaderboard` still resets each January, so one number became two on purpose. Cycle 2 repeats the colours prefixed "Taniwha" (skipping Mā) at +10,000 each, hard-capped at **Ngā Taniwha** on 100,000. Taniwha stays at 10,000 **knowingly**: real data (149 pts/session for a winner, 93 for a runner-up) puts that at ~4.5 months for a 3×/week winner rather than the 1 year originally wanted, and Tāne chose to let cycle 2 carry the long game. New `lib/colours.ts` (19 rungs, single source of truth), `lib/colourAlerts.ts` (live alert + /judge watchlist), `components/ColourWatchlist.tsx`, and migration `20260802000000` (colour_ladder / player_totals / colour_awards + `claim_colour_award` RPC + backfill that reconstructs real crossing dates). The alert had to be **predictive** because points are only written at session close: "has earned" uses `lifetime + 10 + effort×5`, a guaranteed floor with no placement ranking, so it can never be retracted; the coach releases the moment to the player with a "Celebrated" tap. Findings along the way: `player_totals` is keyed on player_id alone because `rankings` keying on division would silently halve a lifetime total on a birthday; lifetime totals must be recomputed not incremented (the ×2 bug becomes permanent otherwise), so manual adjustments need their own column; `20260610000000_historic_points.sql` **never applied** (targets 2025 rows that have never existed, and matches Zeke on a NULL full_name) so 3,800 points were restored via `adjustment_points`; **six inline copies of the ladder** existed and disagreed on Kōwhai's hex; and `__tests__/grades.test.ts` carried a wrong points formula that reintroduced the gap floor removed in May 2026. **Migration NOT yet applied — deploy migration FIRST, then code** (additive; the client requires `player_totals`). Expected outcome simulated against live prod data and recorded in the plan: 19 colour_awards rows, nobody demoted, Rodrigo passes Tāne on lifetime points once his historic 1,500 lands. Tests 260 passing. PENDING: the two emblem PNGs — until they exist Taniwha and Ngā Taniwha render identically. See "Colours rework (August 2026 session 28)" block above.)*
*Previous: August 2026 (session 27 — **Event roster reconciled to 120 events, 12 per domain**, shipped as v0.5.3.0. 7 added (Arm Wrestling, Tug of War, Capture the Flag, Kabaddi, Wheelbarrow Push/Pull, Kubb restored), 9 removed, 9 renamed, 5 moved between domains, and Leg Extension became Leg Ext Hold (strength → difficulty+time, D1–D7). Domain names/numbers/order deliberately UNCHANGED — Tāne declined the sheet's reorder and the "Speed & Reactivity" rename. The big finding: **renaming an event was never safe just because the slug survived** — /prs, lib/percentile.ts and My Events all join PR history on `session_events.event_name`, and `lib/scoring.ts` matched weight-scored tiers on the name literal, so earlier renames (Handbalance and others) had already silently orphaned their history. Migration `20260801000000` repoints 24 old names derived from git history, and archives-then-deletes the un-convertible Leg Extension rows behind RLS. Icons 120/120. Tests 198 passing. Migration applied to prod 2026-08-01 AFTER the code deployed, and verified (renames landed, 17 Leg Extension rows archived+deleted, archive table correctly refuses PostgREST reads with 42501). The ×2 games/points bug is now CONFIRMED DEAD in prod — `pg_trigger` returns only `auto_award_points`, which also upgrades `20260713000000` from applied-by-inference to directly verified and means the 2026 rankings rebuild ran. Follow-up: the long-standing "three session-22 migrations are pending" note in this file was STALE — they were already applied, and re-running them would have corrupted Breath Hold / Duck Walk scores; corrected in the same follow-up PR. See "Event roster update (August 2026 session 27)" block above.)*
*Previous: July 2026 (session 26 — **Kaiwhakawā tab rebuilt onto the session-19 player layout** and shipped as v0.5.2.0. Chip player-picker (with guest recall) replaces the Registered/Guest toggle + native select; a session roster with per-player progress fills the no-selection state; selecting a player gives the same progress header + Still-to-play/Scored list + quick-entry sheet players get. `EventCard` deleted (~510 lines) — scoring now has one code path. New pure `lib/judgeRoster.ts` (+26 tests, suite at 162) and a real bug fixed along the way: stale `judgePRs` leaking the previous player's PR across a target switch. Deferred: focus states + 44px touch targets for the whole live-session screen (TODOS.md P2 — needs the ui.tsx migration). See "Kaiwhakawā tab rebuild (July 2026 session 26)" block above.)*
*Previous: July 2026 (session 25 — Event roster update from "AllSport Programming July 2026.xlsx": roster now 122 events (was 105). 18 new events fully defined (input mode + tiers + how-to/rules + emoji); Handbalance renamed → Handstand and moved Power → Calisthenics (slug stays hand-walk); Ham Curl + Sandbag to Shoulder moved → Anaerobic Endurance; Ultimate Frisbee moved → Coordination; Kubb removed (kept Clean & Press). Backwards Walk + Scooting added to TIMED_EFFORT_SLUGS. Typecheck clean, 132/132 tests pass (updated the count/Handstand assertions in __tests__/eventData.test.ts), /events verified in-browser. Event icons now 122/122 — the 18 new slugs plus the long-missing bowling.png were exported and imported (3 Canva files renamed to match their slugs). PENDING: deferred difficulty reorders (need a raw_score re-encode migration). See "Event roster update (July 2026 session 25)" block above. Nothing committed.)*
*Previous: July 2026 (session 24 — My Events redesign DONE: renamed the "My 100" card + modal to "My Events" and replaced the player-facing Elo "skill" score everywhere (card, modal, /leaderboard Top Domain/Event columns) with a literal best-score percentile shown as "Top X%" (per event = % of your unified-division pool you beat, inverted + floored at 1, "1st" whenever nobody has a strictly higher best incl. shared top, "No comparison yet" solo; per domain = average of played-event Top%). Card = segmented domain coverage bar + count + Top Domain/Event with icons; modal = Session Wins/Avg Place/Games Played header + Strongest+Weakest + collapsible domains with domain/event icons and dimmed unplayed events. New lib/percentile.ts (+14 unit tests, suite green at 132). Elo (lib/rating.ts) kept internally only for sessionWins. Leaderboard verified on real data; dashboard card/modal typecheck-clean, visual eyeball pending a logged-in session. Spec locked via /grill-me — see "My Events redesign" block above)*
*Previous: July 2026 (Supabase CLI migration setup — installed the CLI, renamed all migrations to unique 14-digit timestamps (incl. the session-22 20260713/b/20260714 files), added supabase/config.toml + README.md + baseline.sh, linked the prod project and baselined all migrations through 20260707 as applied. New migrations now go via `supabase db push`, not the SQL Editor. The three session-22 migrations remain pending — apply via `db push`. **[CORRECTED 2026-08-01: they were NOT still pending — they were already applied. Do not act on this line.]**)*
*Previous: July 2026 (session 23 — /prs Personal Bests page: domains now collapsible (collapsed by default) with a new `DomainIcon` component (masked/tinted `/domain-icons/{slug}.png`, domain-number fallback), per-domain PB count, and 36px per-event `EventIcon`s revealed on expand (dimmed for no-result events); new `public/domain-icons/` folder awaiting Tāne's 10 Canva silhouette exports)*
*Previous: July 2026 (session 22 — nine-item improvement pass: ×2 games/points root cause found (orphaned on_session_end trigger from 20260429; fix + rankings rebuild in migration 20260713000000), Bowling added (105 events), Breath Hold → hold mode + Duck Walk all-walk faster-wins tiers (re-encode migration 20260713000001), 73 overflowing tier names shortened with judge criteria moved to a new tier `detail` field, Selwyn Winter Jam recap with champions on /schedule, multiplayer-Elo skill ratings in lib/rating.ts (0–100 display score), My 100 → player stat card + My Stats modal, /leaderboard Wins/Top Domain/Top Event columns (Avg Place removed; season filter fixed), quarterly WHO-5 wellbeing survey + kaiwhakawā aggregate report (migration 20260714000000). PENDING: apply 20260713000000, 20260713000001, 20260714000000 via `supabase db push`, in that order)*
*Previous: July 2026 (session 20 — design review DR-1..10 implemented in four phases: (1) celebration pass — PR/effort toast variants, players land on own tab, effort-cap + full-house one-time moments; (2) session-end takeover with placement/points/PRs/colour-progress + 10th/25th/50th session milestones; (3) /leaderboard cleanup (avg place trigger migration 20260707, Youth tab removed, Grandmaster tab keys fixed, Felix duplicate merged, copy corrected) + dashboard next-session countdown; (4) My 100 coverage card + new-event-unlocked toast + banner placement-change flash. All DB migrations through 20260707 confirmed applied to prod.)*
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
