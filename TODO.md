# AllSport — TODO

Outstanding work in priority order. Update this file after each session.

---

## Urgent / Production

- [ ] **Run migration 20260526 in production Supabase** — fixes 140pt scoring bug (1st place was awarding 140pts instead of 100). Run `supabase/migrations/20260526_fix_points_trigger.sql` in the Supabase SQL Editor.
- [ ] **Enable Realtime on `results` table in Supabase dashboard** — Table Editor → results → Enable Realtime. The 15-second polling fallback now covers this but realtime is faster.

---

## In Progress / Next

- [ ] **Breakdancing tiers** — change from `difficulty+reps` to `difficulty+time` with new tier descriptions. Awaiting tier content from Tane.
- [ ] **Referral system** — DB migration (referral_code on players, referrals table, trigger), /join/[code] invite landing, dashboard "Invite Friends" section, /koha referral tier display.
- [ ] **Funding campaign block** — update /koha with "Wheels for AllSport" campaign section (hardcoded progress bar, milestones at $1k, $3k, $8k target).
- [ ] **Partners page** — DB migration (partners table, partner_id on sessions), /supporters page (partner clubs grid), partner badge on /schedule.

---

## Judge Summary — Improvements

The current Judge Summary tab shows all scores and allows delete. Two planned improvements:
- [ ] **Inline score editing** — currently clicking Edit shows existing scores with delete only; adding/updating a score requires switching to Kaiwhakawā tab. Consider embedding a lightweight edit form directly in the summary panel.
- [ ] **Post-session score lock override** — judges can delete scores post-session from the summary, but cannot submit new scores (EventCard locks on sessionEnded). Add a judge override to allow score submission post-session.

---

## Planned Features

- [ ] Welcome email on registration (Supabase Edge Function + Resend)
- [ ] Kaiwhakawā approval flow (replace manual SQL for granting judge role)
- [ ] Leaderboard icons — player emoji icon next to name on /leaderboard
- [ ] Per-event placement storage — `event_placement` column on results so points history can show "1st in Deadlift"
- [ ] Designed icon set — replace emoji placeholders with branded SVG icons (infrastructure already in place)
- [ ] Championship registration flow (target: 6 months before 14 March 2027)

---

## Known Issues Fixed (Session 14)

- ✅ Women/Masters Women invisible on leaderboard (root cause: Masters Women siloed behind chip toggle; fix: unified pool)
- ✅ Leaderboard required manual page refresh (fix: 15s polling fallback + realtime subscription)
- ✅ Empty divisions hidden instead of showing placeholder (fix: always render sections)
- ✅ Total placement score not shown (fix: `{N}pts` on every leaderboard row)
- ✅ No judge game overview (fix: Judge Summary tab with all players/events/scores)
