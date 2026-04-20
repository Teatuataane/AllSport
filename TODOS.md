# AllSport — TODOS

## P1 — Do Next

### Deploy to Vercel
**What:** Deploy AllSport to Vercel so players access it from their phones.
**Why:** Without deployment, sessions require everyone on the same local network or ngrok. No real public session without this.
**Effort:** S (human) → S (CC)
**Where to start:** Connect GitHub repo to Vercel, set env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).

### Points auto-calculation on session end
**What:** When a session ends (is_active = false), automatically calculate placements per event and award points to each player. Update the rankings table.
**Why:** Grade progression (Mā → Whero) is the viral growth driver. Players can't climb grades without this. A player telling a friend "I just hit Whero" is the word-of-mouth engine.
**Effort:** L (human) → M (CC)
**Logic:** Placement-based scoring. 1st place = 100 pts. Gap = max(100/players, 10). Apply multipliers (Juniors x1.2, Women x1.2, Masters Men x1.2, Masters Women x1.4). Add bonuses (session attend +10, PB +10, top performance +10, streak +10).
**Where to start:** Add a trigger or server action that fires on `UPDATE sessions SET is_active = false`.

### Verify Te Reo label "Kaiwāwao" on Judge Panel
**What:** Confirm "Kaiwāwao" is the correct and culturally appropriate Te Reo Māori term for judge/referee in a sports context.
**Why:** The Judge Panel heading uses this term. Shipping incorrect te reo would be disrespectful to tikanga and to AllSport's identity.
**Effort:** S (human) — ask a te reo advisor or native speaker before first public session.
**Where to start:** [app/components/JudgeCard.tsx](app/components/JudgeCard.tsx) — heading on line ~88.

## P2 — Soon

### Real-time player count in JudgeCard
**What:** Player count on active session rows in JudgeCard updates in real time as players join — no manual refresh.
**Why:** Static count loaded at dashboard open is stale during an active session. Judge needs live data.
**Effort:** M (human) → S (CC) — Supabase realtime subscription pattern already exists in /scoring/[sessionId]/page.tsx.
**Where to start:** Subscribe to `results` table inserts filtered by `session_id`. Update count state on each insert.

### Live leaderboard with real data
**What:** Replace placeholder data on /leaderboard with real Supabase queries.
**Why:** First thing a new player checks after their session.
**Effort:** M (human) → S (CC)

### QR code on a large display mode
**What:** Judge can open a fullscreen QR code view to display on a TV or projector so players scan to join.
**Why:** Reduces friction at session start for groups.
**Effort:** S (human) → S (CC)

## P3 — Later

### created_by column on sessions table
**What:** Add created_by (player_id) to sessions table so judge panel can scope "your sessions" vs all sessions.
**Why:** Only needed when there are multiple judges.
**When:** Add when second judge joins.

### Judge score management from live session view
**What:** Judge can edit/delete any player's score from within /scoring/[sessionId] without navigating to a separate panel.
**Effort:** M (human) → S (CC)

### Structured score entry
**What:** Variation + weight + reps for strength events; time for flexibility; win/loss for sports.
**Why:** Current score entry is a free-text field. Structured entry enables PB tracking and auto-calculation.
**Effort:** L (human) → M (CC)

### Judge approval flow (replace manual SQL)
**What:** Judges can be assigned via the app (admin UI) rather than running `UPDATE players SET role = 'judge'` manually.
**Effort:** M (human) → S (CC)

### QR code for session join (basic)
**What:** Show QR code on the session code screen so players can scan instead of typing the 6-digit code.
**Status:** Partially in scope for JudgeCard feature (basic QR on dashboard). This tracks the fullscreen/large-display variant.
