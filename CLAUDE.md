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
- Rainbow stripe at top of navbar
- Logo in navbar (left) and hero (right, floating)

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

| # | Domain | Events (10) |
|---|--------|-------------|
| 1 | Maximal Strength | 1A Press, Deadlift, OHP, Pause Dips, Pause Chinup, Pause Squat, Zercher Dead, Ham Curl, Pause Bench, Turkish Get Up |
| 2 | Relative Strength | 1L Squat, Flag, Windshield Wipers, Toe Lift, Planche, Back Lever, Iron Cross, Front Lever, Chin Hang, Climbing |
| 3 | Muscular Endurance | Chinup Contest, Pushup Contest, Reverse Hyper, L Sit Hold, Tib Curl, Headstand, Finger Pushup, GHD Situp, Leg Ext, Ab Rollout |
| 4 | Flexibility & Mobility | Rear Hand Clasp, Bridge, Forward Fold, Needle Pose, Forward Split, Middle Split, Standing Split, Foot Behind Head, Shoulder Dislocate, Pancake |
| 5 | Power | Kelly Snatch, 1A Snatch, Triple Jump, Javelin, Shotput, Australian Football, Vert Jump, 50m Hand Walk, Clean & Jerk, Snatch |
| 6 | Aerobic Endurance | Burpee Broad Jump, 1k Run, 1k Cycle, Ski 1k, 1k Row, Iron Lungs, 200m Carry, 2k Run, 200m Repeats, Bronco |
| 7 | Speed & Agility | 100m Sprint, Tag, T-Race, 400m Race, Beach Flags, 50m Sprint, 200m Sprint, Touch Rugby, Football Dribble, Repeat High Jump |
| 8 | Body Awareness | Tae Kwon Do, Breakdancing, Trampolining, Jump Rope, Wrestling, Gymnastics, Balance Ball, SKATE, Fencing, Juggling |
| 9 | Co-ordination | Volleyball, Baseball, Teqball, Tennis, Cricket, Badminton, Basketball, Football, Hockey, Squash |
| 10 | Aim & Precision | Netball, Handball, Cornhole, Dodgeball, Carrom, Archery, Bowling, Darts, Disc Golf, Golf |

### Event renames (from previous names)
- "T-Test" → **T-Race** (now uses sport/win-loss input mode, not sprint timing)
- "Chin Lift" → **Chin Hang**
- "Turkish" → **Turkish Get Up** (strength mode, no tiers)
- "Toe Lift" → **Toe Lift** (strength mode, no tiers)
- "Calf Raise" → **GHD Situp** (slug: `ghd-situp`, difficulty+reps D1–D4; D4 is weight-scored)
- "Glute Bridge" → **50m Hand Walk** (slug: `hand-walk`, difficulty+time D1–D4)
- "Side Bend" → **Pancake** (slug: `pancake`, difficulty+time D1–D7)
- "F Split" → **Forward Split** (slug: `front-split`, difficulty+time D1–D6)
- "AFL" → **Australian Football** (slug: `australian-football`, sport)
- "1 Arm Press" → **1A Press** (slug: `one-arm-press`)
- "Overhead Press" → **OHP** (slug: `overhead-press`)
- "Zercher Deadlift" → **Zercher Dead**
- "Hamstring Curl" → **Ham Curl**
- "Pause Bench Press" → **Pause Bench** (slug: `pause-bench`)
- "Rope Climb" → **Climbing** (slug: `rope-climb`, difficulty+time D1–D8)
- "1 Arm Snatch" → **1A Snatch** (slug: `one-arm-snatch`)
- "Javelin Throw" → **Javelin**
- "Shot Put" → **Shotput**
- "200m Burpee Broad Jump" → **Burpee Broad Jump**
- "1k Ski Erg" → **Ski 1k**

---

## Scoring, Points & Bonuses

### Points Formula
- 1st place always = 100 points
- Gap = max(100 / players, 10)
- Minimum earn = 10 points
- Players who joined a session but submitted no score for an event are ranked **last** for that event

| Session Size | Gap | Example |
|---|---|---|
| 5 players | 20 pts | 100/80/60/40/20 |
| 10 players | 10 pts | 100/90/80/10 |
| 20+ players | min 10 | 100/90/80/10 |

### Bonus Points

| Bonus | Points |
|---|---|
| Attend a session | +10 |
| Set a personal best | +10 per event |
| Top performance in an event | +10 per division |
| First session ever | +10 |
| Consistency streak (4 in a row) | +10 |
| Championship participation | +100 |
| Championship podium finish | +500 |

### Scoring Multipliers

| Group | Multiplier |
|---|---|
| Juniors (under 17) | x1.2 |
| Women (open) | x1.2 |
| Masters Men (40+) | x1.2 |
| Masters Women (40+) | x1.4 |

### Disadvantage System

Players self-declare a disadvantage before competing in an event when a physical advantage difference exists between them and their opponents. No reason is required — they simply declare small or large.

**Mechanical effect:**
- Domain 1 (Maximal Strength) and Domain 2 (Relative Strength): disadvantage applies a score multiplier.
  - Small: raw_score × 1.2 → stored in `adjusted_score`
  - Large: raw_score × 1.5 → stored in `adjusted_score`
- All other domains: disadvantage is recorded and displayed only. No score change. Physical rule modification is agreed between players and enforced by the judge in person.

**Options:** Each event has three small-disadvantage options and three large-disadvantage options defined in `lib/eventData.ts`. Players choose which option they took. Stored in `disadvantage_type` ('small'/'large') and `disadvantage_option` (the chosen option text).

**Display:** Small badge on result row — "S" (small) or "L" (large) in amber (#F9B051).

---

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
| Shoulder Dislocate | D1–D4 |
| Jump Rope | D1–D5 |
| Gymnastics | D1–D8 |
| Juggling | D1–D4 |
| Ab Rollout | D1–D5 |
| Chin Hang | D1–D6 |
| Breakdancing | D1–D6 (+ hold/performance time in seconds) |
| 1 Leg Squat | D1–D6 |

Events without tiers (objective measure): all lifts, sprints, throws, jumps, rows, runs, cycles, sport/racket events, aim events, Toe Lift, Turkish Get Up, F Split, M Split.

F Split and M Split use distance input mode (block height from ground in cm).

---

## Divisions

| Division | Eligibility |
|---|---|
| Men's | Male competitors aged 17+ |
| Women's | Female competitors aged 17+ |
| Juniors | All competitors aged 16 and under |

The combined division leaderboard tab is labelled **"All-Divisions"** (not "Overall") everywhere.

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

| Amount | Acknowledgement |
|---|---|
| Any amount | Name on supporters wall |
| > $50 | Digital certificate |
| > $200 | Sticker pack + certificate |
| > $500 | Grading T-shirt |
| > $2,000 | AllSport clothing stack |
| > $5,000 | Personal coaching — 50 sessions/year |
| > $10,000 | AllSport comes to you (corporate sessions) |

IRD 33% tax rebate applies to all koha.

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
| Event Detail | /events/[slug] | Complete | Template page: how to perform, rules, tiers, disadvantage, personal best |
| Schedule | /schedule | Complete | Times correct (4:30pm Tue/Thu, 9am Sat), Championship 14 Mar 2027 |
| Leaderboard | /leaderboard | Complete | Real data, All-Divisions tab, active session live banner |
| Koha | /koha | Complete | Tiers, IRD rebate |
| Play | /play | Complete | Login/register landing, Google OAuth |
| Register | /register | Complete | 3-step form, division, display prefs, junior parent fields |
| Login | /login | Complete | Email + Google OAuth |
| Dashboard | /dashboard | Complete | Colours progress, stats, join by code, recent sessions with View Summary, My Personal Bests button |
| Judge Panel | dashboard (JudgeCard) | Complete | Create/end/void sessions, QR code, history, real-time player count |
| Scoring Setup | /scoring | Complete | Select 10 events, editable start time, create session |
| Live Session | /scoring/[sessionId] | Complete | All-Divisions tab, judge edit/delete scores, difficulty tier selector, disadvantage selector, missing scores = last place, post-game popup on session end |
| Personal Bests | /prs | Complete | All 100 events, PR per event, expandable history, this season + previous seasons tabs |
| Auth Callback | /auth/callback | Complete | Google OAuth handler |

---

## Database Schema

### players
id, created_at, full_name, email, phone, date_of_birth, address, city, region, country,
parent_name, parent_email, parent_phone, is_active, username, division,
role (default: player), show_full_name, show_username, show_division, show_location, display_name,
bodyweight_kg, parent_id (uuid, references auth.users.id)

### sessions
id, created_at, session_date, start_time, location, max_participants, duration_minutes,
is_tournament, is_championship, is_active, started_at, ended_at, session_code, notes,
points_awarded_at

### session_events
id, created_at, session_id, domain_number, domain_name, event_name

### results
id, created_at, player_id (nullable), session_id, event_id, score, points_earned,
rank_in_session, notes, player_name, raw_score, score_label, adjusted_score, placement,
exercise_variation, weight_kg, reps, time_seconds, pose_variation,
opponent_name, match_score, result_type,
difficulty_tier (TEXT — D1/D2/etc or null),
disadvantage_type (TEXT — 'small'/'large' or null),
disadvantage_option (TEXT — the chosen option or null)

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
- Disadvantage multipliers (×1.2 small, ×1.5 large) apply only to Domain 1 and Domain 2 events; stored in adjusted_score
- Input modes: strength (weight+reps), reps, time (mm:ss), hold (mm:ss), difficulty+time (tier selector + seconds), difficulty+reps (tier selector + reps), distance (m/cm), flexibility (blocks, legacy), sport (win/draw/loss + opponent), sprint (ss.cs), weight+time, distance+time, dynamic (legacy)
- difficulty+time raw_score = tierIdx * 10000 + seconds (0-based tierIdx). Used for all tiered hold events (planche, bridges, splits, etc.)
- difficulty+reps raw_score = tierIdx * 10000 + reps (0-based tierIdx). Used for all tiered rep events. Special case: GHD Situp D4 is weight-scored (raw_score = weight_kg)
- Sprint mode: seconds + centiseconds (0–99), raw_score = -(secs*100 + cs). Used for 100m/50m/200m/400m Sprint, Football Dribble (T-Race uses sport mode)
- Effort points (getBonusTargets): returns 3 tiers. strength = 90%×3 / 80%×5 / 70%×8 reps. time/sprint = 1/2/3 efforts within 90%/80%/70% of PR. distance = 1/2/3 attempts at 90%/80%/70% of PR. difficulty+time = hold current tier 1min / hold tier-below 2min / 4min. difficulty+reps = 90%/80%/70% of PR reps at current tier. sport = 1/2/3 extra games.
- Pre-session timer: if started_at is in the future, shows purple "until start" countdown. Game clock begins at started_at
- Score submission re-fetches results after upsert (realtime alone misses UPDATEs from re-submissions)
- Post-game popup: triggers on is_active → false, dismissed per player per session via localStorage, viewable in session history thereafter
- All-Divisions = the combined tab (previously called "Overall") — renamed everywhere
- Guest players: created by judges during a live session, stored in players with is_guest=true and no auth account. player_id FK to auth.users was dropped in migration 20260505 — registered players still have id=auth.uid() by construction, guests use gen_random_uuid()
- Judge player tabs: judges see their own + family tabs by default, can add any registered player or create a guest via "+" button. Tabs persist in localStorage keyed by sessionId. Added players stored as [{id, label, isGuest}]
- Guest player RLS: judges can insert players (is_guest=true), results (any player_id), and bonus_completions (any player_id) — covered by policies in migration 20260505

---

## File Structure

```
~/allsport/
  middleware.ts                     # REQUIRED — refreshes Supabase session on every request
  lib/
    supabase.ts                     # Basic client (legacy — DO NOT USE in new code)
    supabase-browser.ts             # Browser client (use this in ALL client components)
    supabase-server.ts              # Server client
    eventData.ts                    # Single source of truth for all 100 events: name, slug, domain, inputMode, difficultyTiers, disadvantageOptions, howToPerform, rules
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
      [slug]/page.tsx               # Event detail — how to, rules, tiers, disadvantage, PB
    register/page.tsx
    login/page.tsx
    dashboard/page.tsx              # Colours section, My Personal Bests button, View Summary on sessions
    prs/page.tsx                    # Personal best history — all 100 events
    scoring/page.tsx
    scoring/[sessionId]/page.tsx    # Live session — All-Divisions tab, judge edit/delete, tier selector, disadvantage, post-game popup
    auth/callback/route.ts
    components/
      JudgeCard.tsx                 # Judge panel — real-time player count
  components/
    Navbar.tsx
    Footer.tsx
  supabase/
    migrations/
      20260420_phase1.sql
      20260428_phase2.sql           # difficulty_tier, disadvantage_type, disadvantage_option columns; updated award_session_points trigger
      20260505_judge_player_management.sql  # guest players (is_guest), drop players.id FK, judge RLS for results/bonuses
  public/
    logo.png
```

**IMPORTANT:** Always use createClient() from @/lib/supabase-browser in client components.

---

## What's Complete

- Full public website (5 pages)
- 3-step player registration with Google OAuth
- Player dashboard — Colours progress (bar + year tabs), stats, join by code, session history with View Summary
- Judge panel (JudgeCard) — create/end/void sessions, QR code, real-time player count
- Live scoring — 100-event pool, all input modes including difficulty tier selector and disadvantage selector, All-Divisions tab, judge edit/delete scores, missing scores = last place, post-game popup
- Post-game popup — placement, per-event breakdown, bonuses, total points, colour progression moment
- Session history — past session summaries accessible from dashboard
- Colour history — accessible from homepage colour progression section (logged-in players)
- Colours section on dashboard — renamed from Grade, conditional year tabs, coloured progress bar
- Event detail pages — /events/[slug] with how-to, rules, difficulty tiers, disadvantage options, personal best
- Events index — /events, all 100 events grouped by domain
- Personal bests page — /prs, all 100 events, expandable history, this season + previous seasons
- All-Divisions tab — renamed from Overall everywhere
- T-Race — renamed from T-Test, now uses sport/win-loss input mode
- Chin Hang — renamed from Chin Lift
- Effort points system — getBonusTargets rewritten: 3 tiers (was 4), correct PR decoding from raw_score, all inputModes supported
- difficulty+time and difficulty+reps InputModes — new modes for tiered hold and tiered rep events; raw_score = tierIdx*10000 + value
- All 100 events updated — correct inputMode, hasDifficultyTiers, tier names from EVENT_DEFINITIONS.md
- 20+ event renames/slug changes — see "Event renames" section above
- Difficulty tiers — now defined for all 100 tiered events in lib/eventData.ts
- Disadvantage system — self-declared, recorded per result, mechanical multiplier on strength events
- Judge score edit/delete fix — delete confirmation works correctly, leaderboard recalculates immediately
- Judge player management — judges can add any registered player or create a guest during a live session; tabs persist across refresh via localStorage; guest players earn placement points
- Guest players — stored in players table with is_guest=true and no auth account (players.id FK to auth.users removed); created via judge modal
- Supabase SSR middleware, browser client, Google OAuth, RLS, points trigger — all confirmed working
- allsport.nz live domain

---

## What's Next (In Priority Order)

1. Populate full content (howToPerform, rules, disadvantage options) for remaining 95 events in lib/eventData.ts
2. Welcome email on registration (Supabase Edge Function + Resend)
3. Judge approval flow (replace manual SQL)
4. Player profile page — edit display prefs
5. Disadvantage option definitions for all 100 events (currently placeholder for 95)
6. Verify Te Reo "Kaiwāwao" is correct for judge/referee in sports context
7. Championship registration flow (6 months before March 2027)
8. Guest player claim flow — link a guest player record to a newly registered account (optional, post-MVP)

---

## Key Decisions

- Koha only — no set fees
- Tagline: Play EVERYTHING
- Te reo Māori identity throughout
- Taniwha = Black = peak grade = black belt equivalent
- Colours reset January, history kept forever — section called "Colours" not "Grade"
- All-Divisions = combined division tab (not "Overall")
- T-Race (not T-Test) uses sport/win-loss input mode
- Chin Hang (not Chin Lift)
- Difficulty tiers: D1 = easiest, purely informational, stored in results.difficulty_tier as tier name string
- difficulty+time: raw_score = tierIdx*10000 + seconds; difficulty+reps: raw_score = tierIdx*10000 + reps (both 0-based tierIdx)
- GHD Situp D4 special case: scoring switches to weight_kg (not reps); handled in computeScore by checking event.name === 'GHD Situp' && tierIdx === 3
- Disadvantage: self-declared by players, small/large, three options per event per level; multiplier on strength events only (×1.2 / ×1.5)
- Missing scores: players with any result in session but no score for a specific event = last place for that event
- Post-game popup: triggers on session close, dismissed via localStorage, viewable in session history
- lib/eventData.ts is the single source of truth for all 100 events
- Score resubmission: upsert on (player_id, session_id, event_id) — updates existing row
- Time events: raw_score stored as negative seconds so faster = higher
- Void vs End: Void sets points_awarded_at before closing to prevent trigger firing
- middleware.ts is mandatory — without it, Supabase sessions don't persist across page loads

---

*Last updated: May 2026 (session 5)*
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
