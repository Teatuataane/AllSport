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
| Hosting | Vercel (not yet deployed — running locally) |
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
| 1 | Maximal Strength | 1A Press, Deadlift, OHP, Pause Dips, Pause Chinup, Pause Squat, Zercher Dead, Ham Curl, Pause Bench, Turkish |
| 2 | Relative Strength | 1L Squat, Flag, Windshield Wipers, Toe Lift, Planche, Back Lever, Iron Cross, Front Lever, Chin Lift, Climbing |
| 3 | Muscular Endurance | Chinup Contest, Pushup Contest, Reverse Hyper, L Sit Hold, Tib Curl, Headstand, Finger Pushup, Calf Raise, Leg Ext, Ab Rollout |
| 4 | Flexibility & Mobility | Rear Hand Clasp, Bridge, Forward Fold, Needle Pose, F Split, M Split, Standing Split, Foot Behind Head Pose, Shoulder Dislocate, Side Bend |
| 5 | Power | Kelly Snatch, 1A Snatch, Triple Jump, Javelin, Shotput, AFL, Vert Jump, Glute Bridge, Clean & Jerk, Snatch |
| 6 | Aerobic Endurance | Burpee Broad Jump, 1k Run, 1k Cycle, Ski 1k, 1k Row, Iron Lungs, 200m Carry, 2k Run, 200m Repeats, Bronco |
| 7 | Speed & Agility | 100m Sprint, Tag, T Race, 400m Race, Beach Flags, 50m Sprint, 200m Sprint, Touch Rugby, Football Dribble, Repeat High Jump |
| 8 | Body Awareness | Tae Kwon Do, Breakdancing, Trampolining, Jump Rope, Wrestling, Gymnastics, Balance Ball, SKATE, Fencing, Juggling |
| 9 | Co-ordination | Volleyball, Baseball, Teqball, Tennis, Cricket, Badminton, Basketball, Football, Hockey, Squash |
| 10 | Aim & Precision | Netball, Handball, Cornhole, Dodgeball, Carrom, Archery, Bowling, Darts, Disc Golf, Golf |

---

## Scoring, Points & Bonuses

### Points Formula
- 1st place always = 100 points
- Gap = max(100 / players, 10)
- Minimum earn = 10 points

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
For events where a multiplier is not appropriate. Judges determine the specific disadvantage. Not yet fully defined — rules to be confirmed before 2027 Championship.

---

## Divisions

| Division | Eligibility |
|---|---|
| Men's | Male competitors aged 17+ |
| Women's | Female competitors aged 17+ |
| Juniors | All competitors aged 16 and under |

---

## Colour/Grade System

Resets each January. History kept permanently.

| # | Te Reo | Colour | Points |
|---|---|---|---|
| 1 | Mā | White | 0-499 |
| 2 | Kiwikiwi | Grey | 500 |
| 3 | Whero | Red | 1,000 |
| 4 | Karaka | Orange | 2,000 |
| 5 | Kōwhai | Yellow | 3,000 |
| 6 | Kākāriki | Green | 4,000 |
| 7 | Kahurangi | Blue | 5,000 |
| 8 | Poroporo | Purple | 6,000 |
| 9 | Uenuku | Rainbow | 8,000 |
| 10 | Taniwha | Black | 10,000+ |

Taniwha = Black = singular peak grade = equivalent to black belt.

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
| Home | / | Complete | Hero, ethos, colours, CTA |
| How To Play | /how-to-play | Complete | Rules, scoring, 10 domains |
| Schedule | /schedule | Complete | Session times, Championship section |
| Leaderboard | /leaderboard | Placeholder data | Needs real Supabase queries |
| Koha | /koha | Complete | Tiers, IRD rebate |
| Play | /play | Complete | Login/register landing, Google OAuth |
| Register | /register | Complete | 3-step form, division, display prefs, junior parent fields |
| Login | /login | Complete | Email + Google OAuth |
| Dashboard | /dashboard | Complete | Grade progress, stats, join by code, recent sessions |
| Judge Panel | /judge | Complete | Create sessions, manage scores, history |
| Scoring Setup | /scoring | Complete | Select 10 events, create session |
| Live Session | /scoring/[sessionId] | Complete | Live leaderboard, timer, score submission, session code |
| Auth Callback | /auth/callback | Complete | Google OAuth handler |

---

## Database Schema

### players
id, created_at, full_name, email, phone, date_of_birth, address, city, region, country,
parent_name, parent_email, parent_phone, is_active, username, division,
role (default: player), show_full_name, show_username, show_division, show_location, display_name

### sessions
id, created_at, session_date, start_time, location, max_participants, duration_minutes,
is_tournament, is_championship, is_active, started_at, ended_at, session_code, notes

Session code: auto-generated 6-character code via PostgreSQL trigger on insert.

### session_events
id, created_at, session_id, domain_number, domain_name, event_name
(10 rows per session — one per domain)

### results
id, created_at, player_id (nullable), session_id, event_id, score, points_earned,
rank_in_session, notes, player_name, raw_score, score_label, adjusted_score, placement,
exercise_variation, weight_kg, reps, time_seconds, pose_variation,
opponent_name, match_score, result_type

### rankings
id, updated_at, player_id, total_points, total_sessions, average_score,
best_score, current_rank, division, average_placement

### Key Logic
- player_id on results is nullable (players can join by name without account)
- Realtime enabled on session_events and results
- RLS enabled on all tables
- Session auto-locks when timer hits zero (is_active set to false)

---

## File Structure

```
~/allsport/
  app/
    page.tsx                        # Homepage
    layout.tsx                      # Root layout
    globals.css                     # Design system
    play/page.tsx                   # Login/register landing
    how-to-play/page.tsx
    schedule/page.tsx
    leaderboard/page.tsx            # Placeholder data — needs real queries
    koha/page.tsx
    register/page.tsx               # 3-step registration
    login/page.tsx
    dashboard/page.tsx              # Player home — grade, stats, join session
    judge/page.tsx                  # Judge panel
    scoring/page.tsx                # Session setup
    scoring/[sessionId]/page.tsx    # Live session
    auth/callback/route.ts
  components/
    Navbar.tsx                      # PLAY NOW, auth-aware, judge link
    Footer.tsx
  lib/
    supabase.ts                     # Basic client
    supabase-browser.ts             # Browser client (use this in all client components)
    supabase-server.ts              # Server client
  public/
    logo.png
```

**IMPORTANT:** Always use createClient() from @/lib/supabase-browser in client components. Do not use the basic supabase.ts client in pages — it does not handle SSR auth sessions correctly.

---

## What's Complete

- Full public website (5 pages)
- 3-step player registration with Google OAuth, division, display preferences
- Play page — login/register landing
- Player dashboard — grade progress, year tabs, stats, join by code, recent sessions
- Judge panel — create/end sessions, edit/delete scores, history
- Live scoring app — 100-event pool, live leaderboard, 100-min timer, session code, real-time
- Navbar rebuilt — PLAY NOW button, auth-aware, judge link
- Role system (player/judge)
- Session code system — 6-character auto-generated, join from dashboard
- Full database schema with all new columns
- Supabase browser client (fixes auth in Next.js App Router)
- Brand colours, points formula, grades, koha, mission — all confirmed
- How to Play branded PDF — complete
- Strategy 2026-2027 branded PDF — complete

---

## What's Next (In Priority Order)

1. Deploy to Vercel
2. Live leaderboard data — replace placeholder on /leaderboard
3. Points calculation — auto-award points when session ends
4. Structured score entry — variation + weight + reps for strength; time for flexibility; win/loss for sports
5. Event detail pages — rules and personal bests
6. Division split on live leaderboard
7. QR code for session join
8. Judge score management from within live session view
9. Judge approval flow (replace manual SQL)

---

## Key Decisions

- Koha only — no set fees
- Tagline: Play EVERYTHING
- Te reo Maori identity throughout
- Taniwha = Black = peak grade = black belt equivalent
- Grades reset January, history kept forever
- Role system: player and judge — judge panel at /judge
- Session join: 6-digit code or QR (QR pending)
- Login required to submit scores
- 100-min timer auto-locks session
- Supabase browser client required in all client components
- Judge assignment: manual SQL for now, approval flow planned
- Domain display order confirmed (Maximal Strength first)

---

*Last updated: April 2026*
*Project started: March 2026*

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

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
