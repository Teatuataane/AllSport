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
| 1 | Maximal Strength | 1A Press, Deadlift, OHP, Pause Dips, Pause Chin Up, Pause Squat, Zercher Dead, Ham Curl, Pause Bench, Turkish Get Up |
| 2 | Relative Strength | 1 Leg Squat, Flag, Windshield Wipers, Toe Lift, Planche, Back Lever, Iron Cross, Front Lever, Chin Hang, Climbing |
| 3 | Muscular Endurance | Chinup Contest, Pushup Contest, Reverse Hyper, L-Sit Hold, Tibialis Curl, Headstand, Finger Push Up, GHD Situp, Leg Extension, Ab Rollout |
| 4 | Flexibility & Mobility | Rear Hand Clasp, Bridge, Forward Fold, Needle Pose, Forward Split, Middle Split, Standing Split, Foot Behind Head, Shoulder Dislocate, Pancake |
| 5 | Power | Kelly Snatch, 1A Snatch, Triple Jump, Javelin, Shotput, Australian Football, Vertical Jump, Hand Walk, Clean & Jerk, Snatch |
| 6 | Aerobic Endurance | Burpee Broad Jump, Running, Cycling, Ski Erg, Row Erg, Breath Hold, Weighted Carry, Duck Walk, Bronco, Walking |
| 7 | Speed & Agility | 100m Sprint, Tag, T-Race, 400m Race, Beach Flags, 50m Sprint, 200m Sprint, Touch Rugby, Football Dribble, Repeat High Jump |
| 8 | Body Awareness | Tae Kwon Do, Breakdancing, Trampolining, Jump Rope, Wrestling, Gymnastics, Balance Ball, SKATE, Fencing, Juggling |
| 9 | Co-ordination | Volleyball, Baseball, Teqball, Tennis, Cricket, Badminton, Basketball, Football, Hockey, Squash |
| 10 | Aim & Precision | Netball, Handball, Bocce, Dodgeball, Carrom, Archery, Kubb, Darts, Disc Golf, Golf |

### Event renames / changes (from previous names)
- "T-Test" → **T-Race** (sport/win-loss input mode)
- "Chin Lift" → **Chin Hang**
- "Turkish" → **Turkish Get Up** (strength mode, no tiers)
- "Toe Lift" → **Toe Lift** (strength mode, no tiers)
- "Pause Dips" → **Pause Dips** (`difficulty+reps` D1–D5; D5 = Weighted RTO Dip, weight-scored)
- "Pause Chin Up" → **Pause Chin Up** (`difficulty+reps` D1–D5; D5 = Weighted Chinup, weight-scored)
- "Ham Curl" → **Ham Curl** (`difficulty+reps` D1–D5, was `strength`)
- "50m Hand Walk" → **Hand Walk** (`difficulty+time` D1–D4; D3 = Wall Handstand Walk)
- "Cornhole" → **Bocce** (sport mode)
- "Bowling" → **Kubb** (sport mode)
- "Sprint Repeats" → **Bronco** (`difficulty+time` D1–D3)
- "30-15 Test" → **Walking** (`difficulty+time` D1–D3)
- Domain 6 completely redesigned — see Domain Display Order above. Old slugs (1k-run, sprint-repeats, 30-15-test, etc.) are legacy/orphaned in session history.

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
| Shoulder Dislocate | D1–D4 |
| Jump Rope | D1–D5 |
| Gymnastics | D1–D8 |
| Juggling | D1–D4 |
| Ab Rollout | D1–D5 |
| Chin Hang | D1–D6 |
| Breakdancing | D1–D6 |
| 1 Leg Squat | D1–D6 |

Events without tiers (objective measure): all lifts, sprints, throws, jumps, rows, runs, cycles, sport/racket events, aim events, Toe Lift, Turkish Get Up, F Split, M Split.

F Split and M Split use distance input mode (block height from ground in cm).

---

## Divisions

| Division | Label | Eligibility |
|---|---|---|
| Men's | Men's | Male competitors aged 17–39 |
| Women's | Women's | Female competitors aged 17–39 |
| Juniors | Juniors (U17) | All competitors aged 16 and under |
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
| Event Detail | /events/[slug] | Complete | Template page: how to perform, rules, tiers, personal best |
| Schedule | /schedule | Complete | Times correct (4:30pm Tue/Thu, 9am Sat), Championship 14 Mar 2027 |
| Leaderboard | /leaderboard | Complete | Real data, All-Divisions tab, active session live banner |
| Koha | /koha | Complete | Tiers, IRD rebate |
| Play | /play | Complete | Login/register landing, Google OAuth |
| Register | /register | Complete | 3-step form, division, display prefs, junior parent fields |
| Login | /login | Complete | Email + Google OAuth |
| Dashboard | /dashboard | Complete | Colours progress, stats, join by code, recent sessions with View Summary, My Personal Bests button, VoteBanner |
| Judge Panel | dashboard (JudgeCard) | Complete | Create/end/void sessions, QR code, history, real-time player count, Event Votes panel (Kōwhiringa Tūāhuatanga) |
| Scoring Setup | /scoring | Complete | Select 10 events, editable start time, create session |
| Live Session | /scoring/[sessionId] | Complete | Per-division leaderboard tabs, judge edit/delete scores, difficulty tier selector, missing scores = last place, post-game popup on session end |
| Personal Bests | /prs | Complete | All 100 events, PR per event, expandable history, this season + previous seasons tabs |
| Vote | /vote/[voteId] | Complete | Step-by-step voting flow, one domain per screen, partial save, review screen, locked on submit |
| Vote Results | /vote/[voteId]/results | Complete | Spoiler-free until voted, bar chart per domain, counts only while open / percentages on close, judge full breakdown |
| Auth Callback | /auth/callback | Complete | Google OAuth handler |

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
bodyweight_kg, parent_id (uuid, references auth.users.id)

### sessions
id, created_at, session_date, start_time, location, max_participants, duration_minutes,
is_tournament, is_championship, is_active, started_at, ended_at, session_code, notes,
points_awarded_at

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
    eventData.ts                    # Single source of truth for all 100 events: name, slug, domain, inputMode, difficultyTiers, howToPerform, rules
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
    dashboard/page.tsx              # Colours section, My Personal Bests button, View Summary on sessions
    prs/page.tsx                    # Personal best history — all 100 events
    scoring/page.tsx
    scoring/[sessionId]/page.tsx    # Live session — per-division leaderboard tabs, judge edit/delete, tier selector, post-game popup
    auth/callback/route.ts
    vote/
      [voteId]/
        page.tsx                    # Step-by-step voting flow, one domain per screen, partial save
        results/page.tsx            # Bar chart results, spoiler-free until voted, judge full view
    components/
      JudgeCard.tsx                 # Judge panel — sessions + Event Votes (Kōwhiringa Tūāhuatanga)
      VoteBanner.tsx                # Dashboard banner — vote state + live countdown + CTA
  components/
    Navbar.tsx
    Footer.tsx
  supabase/
    migrations/
      20260420_phase1.sql
      20260428_phase2.sql           # difficulty_tier column; updated award_session_points trigger
      20260513_event_voting.sql     # event_votes, event_vote_nominations, event_vote_responses tables + RLS + functions
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
- Live scoring — 100-event pool, all input modes including difficulty tier selector, judge edit/delete scores, missing scores = last place, post-game popup
- Live session leaderboard — "Effort Level (All-Divisions)" tab + dynamic division tabs (competitive, player-ranked by total placement); expanded player row shows per-event score + ordinal placement; effort tasks unlock on first score submission using effectivePR = max(sessionBest, seasonPR)
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
- Event voting system — judges create votes (name, event date, close date, 2–10 events per domain nominated), players vote step-by-step (one domain per screen, partial save, locked on final submit), spoiler-free results (hidden until voted, counts only while open, percentages after close), judge full breakdown with voter names

---

## What's Next (In Priority Order)

1. Welcome email on registration (Supabase Edge Function + Resend)
2. Judge approval flow (replace manual SQL)
3. Player profile page — edit display prefs
4. Verify Te Reo "Kaiwāwao" is correct for judge/referee in sports context
5. Championship registration flow (6 months before March 2027)

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
- Weight-scored final tiers: GHD Situp D4, Pause Dips D5 (Weighted RTO Dip), Pause Chin Up D5 (Weighted Chinup) — these tiers switch input to weight_kg instead of reps
- Domain 6 events redesigned (May 2026): old events (1k Run, Sprint Repeats, 30-15 Test, etc.) are legacy orphans in session history; new slugs are running, cycling, ski-erg, row-erg, breath-hold, weighted-carry, duck-walk, bronco, walking, burpee-broad-jump
- Domain 10 updated (May 2026): Cornhole → Bocce, Bowling → Kubb
- disadvantage system removed entirely (dropped from DB in migration 20260510, removed from eventData.ts and all UI)
- Disadvantage: self-declared by players, small/large, three options per event per level; multiplier on strength events only (×1.2 / ×1.5)
- Missing scores: players with any result in session but no score for a specific event = last place for that event
- Post-game popup: triggers on session close, dismissed via localStorage, viewable in session history
- lib/eventData.ts is the single source of truth for all 100 events
- Score resubmission: upsert on (player_id, session_id, event_id) — updates existing row
- Time events: raw_score stored as negative seconds so faster = higher
- Void vs End: Void sets points_awarded_at before closing to prevent trigger firing
- middleware.ts is mandatory — without it, Supabase sessions don't persist across page loads
- Event voting: only one active vote at a time; judges create via JudgeCard (id="vote-panel"); players vote one domain at a time; partial saves stored with is_final=false; final submit sets all rows to is_final=true; locked after submit; votes have a set close datetime; results hidden until player has voted (spoiler-free); counts shown while open, percentages after close; judges see full breakdown with names via get_vote_details() SECURITY DEFINER function; players see anonymised bar charts; VoteBanner on dashboard shows state (not voted / partial / voted) with live countdown; judge vote history accessible in JudgeCard; player results access expires when competition begins (event_date); judge results persist permanently
- Gap formula: 100 ÷ players, no floor on gap; minimum earn = 10 on awarded points only
- Effort points: separate effort_scores table; 100pt session cap (= effort level 20 × 5 pts); +5 per qualifying submission; feeds Colour System total; one repeatable task per event at 80% of PR
- Effort tasks: generated from `effectivePR = max(sessionBest, seasonPR)` — if no season PR, session score becomes baseline; one repeatable task per event; strength: 5 reps @80% PR; hold events: 2-minute hold; sport events: extra match vs any opponent; score events: additional 4-hole round; tasks locked until at least one comp score submitted this session
- Effort matching: exact tier, time ≥ required; harder tier does not substitute; repeats allowed
- Live session leaderboard: single tab row — first tab always "Effort Level (All-Divisions)" (effort ranking); then division tabs (competitive ranking, lowest total placement = 1st); division tabs only visible if players from that division have scored; expanded player row shows all events with score label + ordinal placement
- Event button collapsed label: always shows "Effort Level: N" (not "— pts")
- Golf and Disc Golf use 'score' mode (stroke count for 4 holes; raw_score = -strokes; lower = better).

---

*Last updated: May 2026 (session 8)*
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
