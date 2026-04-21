# AllSport — TODOS

## ✅ Done

- Deploy to Vercel
- Custom domain allsport.nz — DNS configured, SSL live, Supabase Auth URLs updated
- Google OAuth redirect URLs configured for production
- RLS policies — results INSERT, UPDATE, rankings write
- Points auto-calculation trigger (award_session_points on session close)
- season_year on rankings, unique constraint (player_id, season_year)
- calculate_streak() function
- Live leaderboard — real Supabase data, division tabs, podium
- Active session banner on leaderboard (realtime, shows current leader)
- Session scoring — per-event structured inputs (10 modes: strength, reps, time, hold, distance, flexibility, sport, sprint, weight+time, distance+time, dynamic)
- Sprint timing mode — seconds + centiseconds for 100m/50m/200m Sprint, T-Test
- Score upsert — resubmitting updates instead of erroring
- Score submission re-fetch — results always appear after submit (fixes realtime UPDATE miss)
- Unique constraint: results_player_event_unique (player_id, session_id, event_id)
- Expandable event scores in session leaderboard (shows ranked list, current best)
- Judge Void button — cancels session without awarding points
- Session start time — editable field, pre-filled with now
- Pre-session timer — purple "until start" countdown before started_at, then game clock
- Bodyweight field in session scoring — saves to player profile
- Schedule page — corrected session times (4:30pm Tue/Thu) and championship date (14 Mar 2027)
- Removed "Train Everything" tagline from login screen
- QR code fullscreen in JudgeCard
- Sport events — record opponent name + conflict detection between players
- 1 Leg Squat — variation picker with free-text override
- Distance score decimal fix — stored as whole cm integers (no DB type errors)
- Division tabs on live session leaderboard — Overall / Men's / Women's / Juniors
- Overall tab multipliers — Women's/Juniors ×1.2, Masters Men ×1.2, Masters Women ×1.4
- Supabase SSR middleware (middleware.ts) — fixes session persistence and Google double sign-in
- Navbar — switched to browser client, PLAY NOW hides when logged in (shows DASHBOARD)
- /play — redirects already-logged-in users to dashboard
- Browser tab — "AllSport — Play EVERYTHING" + logo favicon
- Bodyweight SQL migration — `ALTER TABLE players ADD COLUMN IF NOT EXISTS bodyweight_kg NUMERIC;`

---

## P1 — Do Next

### Judge score management from live session
**What:** Judge can edit or delete any player's score from within /scoring/[sessionId] without going to a separate screen.
**Why:** Currently judges have no in-session correction flow. Errors require manual Supabase queries.
**Effort:** M (CC) — add a judge-only mode to the leaderboard tab that shows edit/delete on each score row.
**Where to start:** `app/scoring/[sessionId]/page.tsx` — check player.role === 'judge', render edit icons on expanded event score rows.

### Real-time player count in JudgeCard
**What:** The "joined" count on active sessions updates live as players submit scores — no manual refresh.
**Why:** Count loaded at dashboard open goes stale immediately during a session.
**Effort:** S (CC) — subscribe to results INSERT filtered by session_id, increment count state.
**Where to start:** `app/components/JudgeCard.tsx` — add Supabase realtime channel in useEffect.

---

## P2 — Soon

### Judge approval flow
**What:** Judges can be assigned via the app rather than running `UPDATE players SET role = 'judge'` manually.
**Why:** Manual SQL is not viable once there are multiple judges or the community grows.
**Effort:** M (CC) — admin UI or invite link that sets role.

### Player profile page
**What:** Players can view and edit their display name, division, privacy settings, and grade history.
**Why:** No self-service profile editing currently exists.
**Effort:** M (CC)
**Where to start:** New route `/profile` or modal from dashboard.

### Event detail pages
**What:** Each event has a page showing rules, how to score, and the player's personal best.
**Why:** New players don't know how to perform or score events.
**Effort:** L (CC)

---

## P3 — Later

### created_by column on sessions
**What:** Add created_by (player_id) to sessions so judge panel can show "your sessions" vs all.
**When:** Add when second judge joins.

### Verify Te Reo "Kaiwāwao"
**What:** Confirm "Kaiwāwao" is correct and culturally appropriate for judge/referee in a sports context.
**Why:** Used as the heading on the Judge Panel. Incorrect te reo would be disrespectful.
**Effort:** S (human) — ask a te reo advisor or native speaker before first public session.
**Where:** `app/components/JudgeCard.tsx` heading.

### Disadvantage system
**What:** Define and implement the disadvantage rules for events where a multiplier is not appropriate.
**Why:** Referenced in rules but not yet defined.
**When:** Before 2027 Championship.

### Championship registration flow
**What:** Separate registration/confirmation flow for the annual championship.
**Why:** Championship has different entry requirements and needs a headcount.
**When:** 6 months before March 2027.
