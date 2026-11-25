# Multi-location games plan

Agreed with Tāne on 23 November 2026, in a question session of 23 decisions. Nothing here is built yet. This builds on weekly games (v0.54.0.0, `20261118010039_weekly_games.sql`) and its phase 2 push and email branch (`claude/weekly-games-push-email`, migration `20261118234820_weekly_game_push.sql`).

There is enough time to build this well. Do not rush it for Burnside.

---

## 1. What it is for

1. **AllSport games anywhere in the country**, run by people other than Tāne.
2. **Internal knowledge:** which games work, and why the others fail.
3. **Evidence for funders and schools:** who registered, who played what and when, reach, and outcomes.
4. **Notices players can rely on:** is the game on, where is it, who is running it, is anyone coming.

---

## 2. Decisions

### People: three levels of Kaiārahi

| Level | Stored as | Who | Can do |
|---|---|---|---|
| **Kaiwhakawā** | `head` | Head staff | Everything: create funded games and programmes, grant and suspend levels, edit or void any game, approve pay, export reports |
| **Kaimahi** | `staff` | Paid staff | Run and edit the funded games they are rostered on (including covers they claim), and any community game |
| **Kaiako** | `community` | Earned from the weekend course | Create and run unpaid community games when they please |

- **Kaiārahi** is the general word for whoever runs a game, at any level. Where a person is named, show their name and level ("Mikaere · Kaimahi").
- Kaiārahi are shown publicly by their **player name and avatar**, never their legal name.
- The display names are labels only. The database stores `head`, `staff`, `community`.
- **Kaiwhakawā changes meaning.** It means head staff only from now on. Every screen and help text that says "kaiwhakawā" for whoever runs a game must be reworded to Kaiārahi.
- Kaiako means teacher, and real teachers will be second adults at school games. Expect some confusion; it is accepted.

**Requirements**
- **Kaimahi and Kaiwhakawā:** police vetting (3 years) and first aid (usually 2 years). Status and expiry date are recorded, never the vetting result. A lapse blocks rostering, not playing. Reminders at 60 and 14 days.
- **Kaiako:** one-time qualification, no expiry, no vetting or first aid required. Record when and how they qualified (which course).
- **Kaiako from age 16.** A Kaiako under 18 can only run a game with an adult (18 or over) present as the second adult. Report them as **youth leaders**.
- **Juniors at a game run only by a Kaiako need their parent or guardian present.** The Kaiako ticks "Parent or guardian present" when adding a junior; a parent adding their own child counts automatically. The rule does not apply when a Kaimahi or Kaiwhakawā is there. Find a game shows these games as "Adults, or juniors with a parent".
- A Kaiwhakawā can **suspend** anyone, with a recorded reason.

### Games

- **Funded games** are paid. Only a Kaiwhakawā creates them. Each belongs to a **programme**.
- **Community games** are unpaid. Any Kaiārahi creates them: weekly, one-off, or a pop-up started on the spot.
- **Programme:** funder, name, start and end dates, and the targets promised in the application (for example 30 rangatahi a week). Reports are "everything under this programme, against what we promised".
- **Every session belongs to a game.** New Game shows the games the Kaiārahi is rostered on today. With nothing scheduled, "Start a pop-up" creates a one-off community game.
- **Sites have a map pin.** Adding a site first shows existing sites within 500m ("Is it one of these?").
- **2026 sessions are back-filled** to AllSport HQ, matched to the Tue, Thu or Sat slot by start time.
- Each game is **Public** or **Unlisted**. Unlisted games are reached only by link or QR code. School games default to unlisted.
- **Two-adult rule** is a setting per game (on for Burnside). When on, the game cannot start until a second adult is recorded: a Kaiārahi of any level or a named helper from the host (a teacher) with no account needed.

### Roster and cover

- Each funded weekly game has a **regular Kaiārahi**, assigned by a Kaiwhakawā.
- The regular Kaiārahi taps **Need cover** for a date. Every eligible Kaiārahi is told; the first to claim it takes the slot. The Kaiwhakawā is told but does not approve.
- **Unfilled 48 hours out:** the Kaiwhakawā is alerted. **Unfilled 4 hours out:** the Kaiwhakawā decides whether to cancel, and players are told.
- Community games are run by whoever created them, who can hand them on.
- A Kaiako can be the second adult at a funded game (unpaid unless decided otherwise).

### Cancelling and moving

- The **rostered Kaiārahi** can cancel or move their own game for a date. A Kaiwhakawā can cancel any.
- A **reason is required:** weather, no Kaiārahi, not enough players, venue unavailable, other (with a note).
- Cancelling a funded game alerts the Kaiwhakawā at once.
- Once a session has started, it cannot be cancelled, only voided (as today).
- If fewer than 4 have said Coming 2 hours before, the Kaiārahi is prompted ("Only 2 coming. Still on?"). It never cancels on its own.

### Pay

- The app holds **hours and approvals only**. Pay rates, bank accounts and tax stay in the payroll system.
- Each funded session makes a **timesheet line:** Kaiārahi, date, game, programme, role (lead or second adult), status.
- Paid time is a **fixed block per game**, set on the weekly game.
- **Paid only if they ran it.** "Ran" means the Kaiārahi started the game at the venue, however few players came. If nobody came, the Kaiwhakawā decides at approval.
- A Kaiwhakawā approves each pay period and exports a CSV per Kaiārahi and per programme. A Kaiārahi sees their own lines and can query one.

### Players and bookings

- Registration to a weekly game stays. On top of it, a **per-date "Coming tomorrow? Yes / Not this time"** goes out the day before, at about 4pm. No notices between 9pm and 7am.
- The Kaiārahi and HOME show "6 coming, 3 not, 11 haven't said". A "No" stops that day's reminders. A "Yes" shows on the game screen so the Kaiārahi can tick people off.
- Walk-ups still play. Booking is never required.
- The existing away dates (`weekly_game_absences`) become a "No".
- **Juniors:** notices and the Coming question go to the **parent**, who can answer for each child at once, and to the child too if they have a login. Parents choose push, email or both; email is the default for parents.
- Parents without an account get **email links that work without logging in.** Each link is signed, answers only for that child and that date, and expires when the game starts.

### What players are asked

- **At sign-up:** ethnicity, using the Stats NZ question (multi-select tick boxes, with "prefer not to say").
- **At sign-up, for juniors:** parent consent ticks: "Share my child's attendance with their school", and consent for the wellbeing survey.
- **In the wellbeing survey** (`app/components/WellbeingSurvey.tsx`), first survey only, saved to the private profile:
  - **Suburb**, from a list, so it maps to the NZ Deprivation Index.
  - **School**, from the Ministry of Education list, juniors only.
  - **Disability**, optional yes / no.
  - **Active before AllSport?** Asked once, ever, and never overwritten.
- Suburb, school and disability are re-confirmed **once a year**.
- Existing players get these through the survey card on HOME.
- Each survey records the programme the player was in, so wellbeing can be reported as change over a programme.
- All of it is private, like date of birth. Only counts ever leave the app.

### Leaderboard and colours

- **One national season board.** No filter by site, no automatic site groups.
- **Community games count the same as funded games** for colours and the season board, provided:
  - **at least 4 players** take part, not counting the Kaiārahi. Below that the session is saved as training: scores and records count, but it adds nothing to anyone's games count;
  - a Kaiārahi's **own results** in a game they run earn colours only if another accredited person is there to witness them.
- **Separate grading change (its own release):** the games cap (`GAMES_REQUIRED` in `lib/grading.ts`) is replaced by a **floor of 6 games that year** before any overall colour, then no cap. Domain colours still show before 6 games. Bump `GRADING_RULES_VERSION` and update the owner-decision note in CLAUDE.md §9.

### Find a game

- A public page replacing `/schedule` (and the fixed times in `lib/schedule.ts`).
- Each upcoming game: site, map link, day and time, status for that date (On / Cancelled / Moved), the Kaiārahi (player name and avatar), and **how many are coming** (a count, never names).
- Sorted by nearest if the visitor allows location, otherwise by region.
- One tap to register for a weekly game or say Coming to a one-off.
- Unlisted games never appear.

### Reports and privacy

- **No logins for anyone outside AllSport.** Schools and funders get reports a Kaiwhakawā exports and sends.
- **Names only with consent.** Without the parent tick, a school export leaves names out.
- **Groups under 5 show as "fewer than 5"** in every export.
- Schools never get ethnicity, wellbeing answers or bodyweight per student, only totals.
- **Account deletion:** personal details go for good (name, email, phone, birth date, parent details, wellbeing answers). What stays, with no link to the person: that "a player" played these sessions, with **age band, sex, ethnicity and deprivation band**. Nothing finer, and no wellbeing answers. The privacy page and sign-up say so.

### What success means

One shared piece of code (pure, in `lib/`) so the scorecard, exports and any dashboard always agree. Per game:

- **Average turn-up** per session, and its 8-week trend.
- **Regular players:** played 3 or more of the last 6 sessions.
- **Comeback rate:** first-timers who return at least twice within 6 weeks.
- **Show-up rate:** of those who said Coming, how many played.
- **Reach:** new players this term, by age, sex, ethnicity and deprivation.
- **Reliability:** sessions cancelled, by reason.

---

## 3. Data model sketch

To be designed properly in each PR. New objects follow CLAUDE.md §12 and §13: RLS on, `SECURITY DEFINER` pins `search_path`, checks on `current_user` for client vs server writes, new columns read in their own query with fallbacks.

**New tables**
- `kaiarahi`: `player_id` (PK), `level` (`head` | `staff` | `community`), `granted_at`, `granted_by`, `qualified_via`, `vetting_expires`, `first_aid_expires`, `suspended_at`, `suspended_reason`. Age for the under-18 rule comes from `players.date_of_birth`.
- `programmes`: `id`, `name`, `funder`, `starts_on`, `ends_on`, `targets` (jsonb), `notes`.
- `game_roster`: one row per game, date and slot: `weekly_game_id`, `game_date`, `role` (`lead` | `second`), `player_id` or `helper_name`, `status` (`rostered` | `cover_needed` | `covered`), `claimed_by`, `claimed_at`.
- `game_bookings`: `weekly_game_id`, `game_date`, `player_id`, `answer` (`yes` | `no`), `answered_by` (the parent or the player), `answered_at`. Replaces `weekly_game_absences`.
- `session_adults` and a junior "parent present" record per session, for the two-adult and Kaiako rules.
- `player_profile_private`: `player_id`, `ethnicity` (text[]), `suburb_id`, `school_id`, `disability`, `active_before`, `confirmed_at`, consent flags. Owner and Kaiwhakawā only; never in `players_public`.
- Reference data: `nz_suburbs` (with NZ Deprivation Index band) and `nz_schools` (Ministry of Education directory). Public, read only.
- Release 2: `timesheet_lines`, `attendance_anonymous`.

**Changed tables**
- `sites`: add `lat`, `lng`, `created_by`.
- `weekly_games` (becomes every scheduled game): add `kind` (`funded` | `community`), `programme_id` (required when funded), `one_off_date` (with `dow` and `start_time` nullable for a one-off), `listed`, `two_adults`, `paid_block_minutes`, `regular_kaiarahi_id`, `created_by`. Consider renaming to `games` in the same migration, since it will no longer be only weekly.
- `game_notices`: add `reason` for cancellations.
- `sessions`: `weekly_game_id` and `game_date` become required after the 2026 backfill.
- `wellbeing_surveys`: add `programme_id`.

**Permissions**
- `players.role = 'judge'` and `public.is_judge()` are one national switch, used **65 times across 27 migrations** and in about 12 app files. Replace with:
  - `is_head()`: a current Kaiwhakawā.
  - `can_run_game(session or game)`: rostered on it (or claimed the cover), or created it if community, or `is_head()`; and not suspended, and vetting and first aid current for funded games.
- During the switch, keep `is_judge()` returning true for `head` and `staff` so nothing breaks, then move each policy across and test each one as `authenticated` in a rolled-back transaction.
- The role pin trigger and `__tests__` structural rules must move with it.

---

## 4. Build order

### Before anything
1. **Check the weekly games migration is really live.** TODOS.md still lists it as not applied. Query `pg_class` / `information_schema` for the five tables (CLAUDE.md: claims in docs are not evidence).
2. **Merge and apply the phase 2 push and email branch.** Its second server route changes the service-key rule in `__tests__/autoConferral.test.ts`.

### Grading release (independent, can go any time)
3. Six-games floor replacing the games cap.

### First release
Each a separate PR, in this order because each needs the one before:

4. **Kaiārahi levels and permissions.** *Built in v0.61.0.0 (`20261123024501_kaiarahi_levels.sql`, applied 23 Nov 2026). Tāne, 23 Nov: Kaimahi see no contact details (not even a parent's phone), exemptions stay Kaiwhakawā only, voiding is Kaiwhakawā only. Vetting and first aid dates are recorded but enforced only once funded games exist (PR 5).* `kaiarahi` table, `is_head()`, `can_run_game()`, granting and suspending in `/judge`, vetting and first aid expiry. The riskiest PR: a mistake either locks Kaiārahi out on game day or lets one edit games anywhere. Test every policy as `authenticated`.
5. **Programmes and game types.** *Built in v0.63.0.0 (`20261123035106_games_and_programmes.sql`, applied 24 Nov 2026). `/judge` opens to every Kaiārahi by level; New Game asks which game, with pop-ups. HQ is left unpinned for Tāne to pin from a map link. Programme targets are free-form until the reports PR.* Funded and community games, one-off games, map-pinned sites with the nearby check, pop-ups, every session tied to a game, 2026 backfill to HQ.
6. **More than one live game at once.** *Built in v0.64.0.0, no migration. Tāne, 24 Nov: HOME shows every live game, the player's own first.* New Game refuses a second active game today; HOME and the top bar read one active session (`maybeSingle`). All go per game.
7. **Roster and cover.** *Split (Tāne, 24 Nov): 7a built in v0.65.0.0 (`20261123202226_roster_and_cover.sql`, applied 24 Nov 2026): regular Kaiārahi, Need cover and claiming, cancel and move with reasons, start only by the lead of the day, unfilled alerts at 48h and 4h shown in the app (push and email later). 7b built in v0.66.0.0 (`20261123205536_two_adults.sql`, applied 24 Nov 2026): two-adult rule and under-18 Kaiako rule enforced at the start; Kaiārahi 16+, Kaimahi and Kaiwhakawā 18+; the parent-present rule is a reminder only (Tāne, 24 Nov: juniors nearly always play on a parent's phone). The under-4 prompt moves to step 8, since it needs bookings.* Regular Kaiārahi, Need cover, claiming, two-adult rule, parent-present rule, under-18 Kaiako rule, cancel and move with reasons, unfilled alerts at 48h and 4h, the under-4 prompt. Needs scheduled sends (pg_cron calling the notices route).
8. **Bookings.** *In the app first (Tāne, 24 Nov 2026): built in v0.67.0.0 (`20261123214052_bookings.sql`, applied 24 Nov 2026): Coming? on HOME from 4pm the day before, parents answer for each child, counts, the Yes list on the game screen, "Still on?" two hours out under four, away dates become a No. Push, email and signed email links follow with the push and email branch (TODOS.md).* Day-before Coming question, counts on HOME and the game screen, parent answers, signed email links.
9. **Sign-up and survey.** *Built in v0.68.0.0 (`20261123230958_signup_survey.sql` and `20261123232725_reference_lists.sql`, applied 24 Nov 2026). Tāne, 24 Nov 2026: Canterbury suburbs and schools only ("Somewhere else", "Other school", "Not at school"); ethnicity required, "Prefer not to say" counts; a junior's check-in held back until a parent says yes; suburb, school and disability re-confirmed in the first check-in each January. The lists are `20261123232725_reference_lists.sql`: 318 Canterbury SA2 areas with their NZDep2023 decile (University of Otago) and 293 open Canterbury schools (Ministry of Education directory, CC BY 4.0), generated by `scripts/build-reference-lists.mjs`. Erasure also fixed: it failed for anyone who had played a finished game.* Ethnicity and consent ticks at sign-up; suburb, school, disability and active-before in the survey; programme on each survey; suburb and school reference data. Update the privacy page.
10. **Find a game.** *Built in v0.69.0.0 (`20261123234843_find_a_game.sql`, applied 24 Nov 2026). Tāne, 24 Nov 2026: the Kaiārahi and the coming count for signed-in players only; soonest first with Near me on tap; Kaiako community games public straight away. The address stays `/schedule`. Logged-out visitors now read listed games only.* Public page replacing `/schedule`, Public / Unlisted.
11. **Wording sweep.** *Built in v0.70.0.0, no migration. Tāne, 24 Nov 2026: the nav link, panel and scoring tab say Kaiārahi; `/judge` keeps its address. Kaiwhakawā stays for head-only powers.* Kaiwhakawā to Kaiārahi wherever it means whoever runs a game; level names where a person is named.

### Second release
12. Timesheets, approval and payroll export. *Built in v0.71.0.0 (`20261124223426_timesheets.sql`, applied 26 Nov 2026). Tāne, 24 to 25 Nov 2026: a Kaiako gets no line, even as second adult; the second adult gets the same block as the lead; fortnights from Monday 8 Feb 2027; lines made when the game starts; a game nobody scored in is held for Pay or Don't pay; a query holds the line until answered; two CSVs, per Kaiārahi and per programme.*
13. Success measures (`lib/`), scorecard for Kaiwhakawā. *Built in v0.72.0.0, no migration. Tāne, 26 Nov 2026: the Kaiwhakawā sees every game with reach, a Kaimahi or Kaiako their own games without reach; terms are NZ school terms; deprivation in quintiles with Q5 highlighted; Sport NZ age bands; ethnicity by total response.*
14. Funder and school exports (consent and under-5 rules). *Built in v0.73.0.0 (`20261125225819_programme_wellbeing.sql`, applied 26 Nov 2026). Tāne, 26 Nov 2026: a printable report plus CSV; a funder report is one programme over a date range; a school report is attendance, with names only where a parent agreed; wellbeing is the change from first to latest check-in, shown only when 5 or more answered twice.*
15. Anonymous attendance on account deletion. *Built in v0.74.0.0 (`20261125231115_former_players.sql`, applied 26 Nov 2026). Attendance had always stayed (results under "Former player"); what erasure lost was the bands, and it never deleted the sign-in. Tāne, 26 Nov 2026: the age band on each game day is kept; the sign-in is deleted; erasing a parent erases their children; vote answers stay with no player.*

---

## 5. Risks

- **Permissions rewrite** (PR 4) touches every judge-only rule. Highest risk, test hardest.
- **Disk IO and RAM:** the database is on the smallest compute (CLAUDE.md §4). Find a game and booking counts must be cheap: one RPC, no polling in hidden tabs, Broadcast only, never `postgres_changes`.
- **Email links without login** are a new way to act on the app. Signed, single purpose, short life.
- **Re-identification** in small groups. Coarse bands and the under-5 rule everywhere.
- **The repo is public.** No player names in this or any design file.

---

## 6. Still open

- ~~Are Kaiako paid when they are the second adult at a funded game?~~ Settled 25 Nov 2026: no, and they get no timesheet line.
- Check the level names (Kaiwhakawā, Kaimahi, Kaiako, Kaiārahi) with a te reo speaker.
- Size of the fixed pay block per funded game.
- ~~Source and licence for the suburb list and school list.~~ Settled 24 Nov 2026: NZDep2023 by SA2 (University of Otago; cite Atkinson, Salmond, Crampton 2024) and the Schools Directory (Ministry of Education, CC BY 4.0). A "suburb" is a Stats NZ SA2, so some read as "Sockburn North" or "Rolleston Izone".
- Push and email are phase 2; is SMS ever needed for parents without email?
