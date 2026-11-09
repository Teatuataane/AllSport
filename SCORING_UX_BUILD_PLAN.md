# Scoring screen: speed and entry build plan

Build instructions for the agent doing the work. Written 10 November 2026 against commit `d77c267` (v0.47.0.1). Line numbers are from that commit and will drift as you edit, so treat them as pointers.

Read `CLAUDE.md` first. It overrides anything here that conflicts with it.

## Why this work exists

Players enter scores on a phone, standing in a gym, between events, often with wet or chalky hands. Tāne asked for two things on the in-game screen:

1. **No lag.** A tap should show its result at once.
2. **As functional and good looking as it can be.**

A review of the code found that the lag is almost all waiting on the network, and that the entry sheet makes the player scroll to reach the main button. This plan fixes those in four phases. Each phase stands alone and ships alone.

The screen is `app/scoring/[sessionId]/page.tsx` (2,030 lines). The entry sheet is `components/play/QuickEntrySheet.tsx` (780 lines), shared with personal workouts (`app/workout/[id]/page.tsx`) and with events added at a game (`lib/useGameSwaps.ts`). The list is `components/play/GameEventList.tsx` and `EventListRow.tsx`. Shared controls are in `components/play/chrome.tsx`.

## Rules for the whole job

- **No database migration.** Nothing here needs one. If you think something does, stop and say so.
- **Do not change what a score is worth.** `lib/scoring.ts`, `lib/grading.ts`, `lib/standards.ts`, `lib/eventData.ts` and the encoders stay untouched. `GRADING_RULES_VERSION` stays untouched.
- **Realtime stays Broadcast only.** `__tests__/liveSession.test.ts` blocks `postgres_changes`. Do not add load to the database: the compute is small and Tāne will not pay for a bigger one. Every change in phase 1 should reduce requests, never add them.
- **A score belongs to the tab or target it was entered under.** The sheets are keyed by player and event so one player's values never show under another. Keep every key that does this.
- **One code path for scoring.** The player tab, the kaiwhakawā tab and personal workouts share the sheet and the list. Change the shared part, not three copies.
- **Pure logic goes in `lib/` with a test.** No Supabase or React imports in it.
- **No emoji in the UI.** Use te reo terms as the app does (kaiwhakawā, not judge). New copy should be short and plain.
- **Match the file you are in.** These files use inline `style={{}}`. Use the tokens in `app/globals.css` (`var(--surface)`, `var(--radius-lg)`, `var(--font-label)` and so on) for anything you add or restyle.
- **The dev server talks to the production database.** There is no test database. Do not create games, scores, workouts or players to test with. Verify with unit and component tests, the build, and read-only viewing. Saving a real score to check the flow is Tāne's call, so ask.
- **You cannot sign in.** Pages behind a login need Tāne to sign in in the browser pane, or to test on his phone. Say plainly what you could not check.
- **Do not push, open a PR or merge unless Tāne asks.** Commit each phase on its own. When he asks for a PR, `gh` is not signed in here: push the branch and give him the full compare link.

### Setup

This worktree has no `node_modules` and no `.env` file. Run `npm install`. The build throws without `NEXT_PUBLIC_SUPABASE_URL`; the main checkout at `~/allsport` has a `.env.local`. Ask Tāne before copying it.

### Checks, run after every phase

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
node scripts/check-react-compiler.cjs
```

The last one is a script you add in phase 1 (below). `npm run build` is the authoritative compile check; the dev server can replay stale errors.

Tests that already cover these files, and what they pin:

- `__tests__/playComponents.test.tsx`: the sheet and list. It finds the weight and reps inputs by `getAllByPlaceholderText('0')` in that order, clicks `Submit — 100kg`, and expects `Enter your score`, `Scoring is closed`, `Best today`, `Your best`, `Tap to score`. Keep these working or update the test with a reason.
- `__tests__/oneRmHint.test.tsx`, `__tests__/shortDistanceEffort.test.tsx`: hint lines in the sheet.
- `__tests__/navMenu.test.tsx` (line 124 on): reads the sheet files as text and requires every `position: 'fixed'` layer's `zIndex` to sit above the top bar (1000 to 1010). If you add a fixed layer to a sheet, give it a `zIndex` above 1010.
- `__tests__/judgeRoster.test.ts`, `__tests__/prBoard.test.ts`, `__tests__/prBoardView.test.tsx`.

### Finishing a phase

Bump `VERSION`, add a `CHANGELOG.md` entry, and update `CLAUDE.md` (current facts) and `docs/PROJECT_HISTORY.md` (the story), as the repo does for every shipped change. Then report: what changed, what the checks printed, what you could not verify on a real screen.

---

## Phase 1: speed

Goal: a saved score is on screen in the same frame as the tap, and a save costs one request.

### What is slow today, with evidence

1. **A save waits for the server twice.** `handleSheetSubmit` (`QuickEntrySheet.tsx:204`) awaits `onSubmit`. That is an insert round trip, then for a win, draw or loss a second one (`record_match`). Only then does the sheet close. Then `onSubmitted` (`page.tsx:1661`) awaits `afterOwnWrite`, which re-reads every result in the game, and only then does the row stop saying "Tap to score". The code's own comment at `page.tsx:1043` puts a round trip at about 250ms warm and 1 to 2.8s cold.
2. **A save sets off about six more reads.** These are the whole game (`loadResults`), the player's records (two queries in `usePRRows`), every match in the database (`sportRatings.reload()`, even after a deadlift), `players_public` (the effect at `page.tsx:1110` depends on `results`), and the contest table.
3. **The 15 second poll** (`page.tsx:1264`) calls `setResults` with a new array every time, changed or not. That re-runs the `players_public` read every 15 seconds on every phone.
4. **The page redraws every second.** The clock's `setTimeLeft` (`page.tsx:1322`) lives in `SessionPage`. The React Compiler skips `SessionPage` because of two `eslint-disable-next-line react-hooks/exhaustive-deps` comments (lines 1212 and 1245), so nothing in it is memoised and the open sheet redraws with it. The colour maths in a redraw is cheap (0.05ms measured), so this is a smaller cost than items 1 and 2, but it is waste on a phone that is also running an animation or a keyboard.
5. **The same player's lifetime results load three times** on open: season PRs (`page.tsx:1184`), all-time event names (`page.tsx:1272`) and `usePRRows`. The kaiwhakawā's target adds a fourth and fifth.
6. **Touch.** No rule sets `touch-action`, so fast taps on a stepper can zoom the page on an iPhone. No button has a pressed state, because inline styles cannot express `:active`. Both sheets blur the page behind them (`backdropFilter`), which is heavy on older Android phones.

### 1a. Save an official result optimistically

Split what the page holds into rows the server has confirmed and writes still in flight, and draw the two together.

- Add `lib/pendingResults.ts`, pure, with a test. Something like: an op is an insert (temp id and row), an update (id and row) or a delete (id); `applyPending(confirmed, ops)` returns the rows to draw. A confirmed row that arrives with the same id as a finished op must not appear twice.
- In `SessionPage`, the state now called `results` becomes the confirmed rows, plus a list of pending ops. Derive the drawn rows from both. A poll or a broadcast re-read replaces the confirmed rows only, so a re-read that lands mid-write cannot drop the score the player just entered. This is the reason for the two lists; do not shortcut it by writing the optimistic row into the confirmed state.
- The save: work out the columns (`scoreColumns`) and the PR flag (`isNewPR`, as `submitEntry` does now) before any request. If the score is not valid, return the error to the sheet as today. Otherwise add the op, return success to the sheet at once so it closes and the toast shows, and write in the background.
- Ask the insert for the whole row back (`.select('*').single()`), not just the id. The database may rewrite `raw_score` (`enforce_lift_estimate`), so the returned row is the truth. On success, put it in the confirmed rows and drop the op in the same update, then call `announceResultsChanged`, then `record_match` if there is one. Do not call `loadResults` after your own write.
- On failure, drop the op and show an error toast that stays until dismissed, with `role="alert"`, the event and the score in it, and a "Try again" button that re-sends the same save. Map `42501` to "That game has finished, so it can no longer be scored." and `23514` to "One of the numbers is out of range. Check the weight, time and distance." (the swap store already uses these words).
- A row still in flight has a temp id, so it cannot be edited or deleted yet. Give `EntryRow` an optional `pending` flag; the sheet shows such a row without Edit or delete.
- An edit is the same shape: draw the edited row at once, update in the background, and if the update returns no row keep today's message ("This score was deleted by a kaiwhakawā…").
- A delete: hide the row at once, delete in the background, restore it with an error toast on failure. (Phase 2 puts a confirm in front of it.)
- While any op is in flight, add a `beforeunload` handler so a player who closes the tab inside that window is warned.
- Some things must read confirmed rows only, because they are one-time or written elsewhere: the "all events scored" effect that writes localStorage (`page.tsx:1301`), the end-of-game recheck (`page.tsx:1171`), `SessionEndTakeover`, and the `useContest` refresh key (`page.tsx:938`). Everything a player looks at reads the drawn rows.

The kaiwhakawā tab's official-event sheet uses the same save. `JudgeSummaryTab.handleDelete` (`page.tsx:336`) ignores a failed delete today; route it through the same path.

**Boundary.** Events added at a game (`useGameSwaps.submit`) and personal workouts (`app/workout/[id]/page.tsx` `submit`) write to `workout_entries` and may need to create the workout first. Do not make them optimistic in this phase. Do give them the cheaper half: ask for the row back and patch local state with it instead of calling `load()` after every save, so each save is one round trip, not two.

### 1b. Stop the extra reads

- After a save, do not reload the PR rows. `submitEntry` already merges this game's rows into the PR rule with `mergeRows`. Pass the same merged rows to the sheet's `prRows`, so the records list shows today's score without a request.
- Call `sportRatings.reload()` only when the saved entry was a game (`isGameEntry` in `lib/matches.ts`), and only after `record_match` has answered, since the rating reads the match.
- Key the `players_public` effect on the sorted list of distinct player ids as a string, so it reads again only when a new player appears.
- In `loadResults`, do not call the setter when the rows are the same as last time. A string signature of the sorted rows is enough at this size.
- Pause the poll while `document.hidden`, and re-read once when the page becomes visible again. A phone coming out of a pocket should be fresh at once.

### 1c. One read for records, season PRs and "new event"

- Give `usePRRows` a `loaded` flag in its return value (empty and not-yet-loaded look the same today).
- Add two pure helpers beside the PR rules in `lib/prBoard.ts`, with tests: the season best (highest `raw_score` among `source === 'game'` rows dated in the NZ year, from `lib/seasonYear.ts`), and whether the player has any game row on the event.
- Derive `seasonPRs`, `judgePRs` and the "new event unlocked" check from `playerPRRows` and `targetPRRows`. Then delete the three effects that load them (`page.tsx:1184`, `1216`, `1272`) and their state. "New event" must stay false until `loaded` is true, or every first score of the day would announce one.
- The old loaders read game results only, so keep the season PR to `source === 'game'`.

### 1d. Take the clock out of the page

- Move the banner (colour score, timer, status label) into its own component that owns the per-second state. `SessionPage` should keep no state that changes every second. It still needs to know when the clock hits zero: pass one callback that sets `sessionEnded` and calls `close_expired_sessions`, as the timer effect does now.
- The two lint suppressions go away with 1c. Do not add new ones.
- Fix the two hooks the compiler also skips: `lib/usePRRows.ts` (the `||=` at line 47) and `lib/useGameSwaps.ts` (its manual `useCallback` deps do not match what the compiler infers; dropping the manual memoisation is fine).
- Add `scripts/check-react-compiler.cjs`. It runs `babel-plugin-react-compiler` through `@babel/core` (`parserOpts: { plugins: ['typescript', 'jsx'] }`, `babelrc: false`, `configFile: false`) over the files below, passes a `logger` with `logEvent`, prints every event whose `kind` is not `CompileSuccess` with its reason and line, and exits non-zero if there are any. Files: the scoring page, everything in `components/play/`, `components/EventIcon.tsx`, `lib/usePRRows.ts`, `lib/useGameSwaps.ts`, `lib/useContest.ts`, `lib/useGradeProfile.ts`, `lib/useSportRatings.ts`. Done means it prints nothing.
- If `SessionPage` still will not compile for a reason that is not cheap to fix, split the player tab and the kaiwhakawā tab into their own components. They are natural seams and the file is too long anyway. This is welcome but not required.
- One trap: with the per-second redraw gone, anything that only looked current because the page redrew every second will go stale. Look for values read during render from `localStorage`, refs or `Date`.

### 1e. Touch

In `app/globals.css`:

- `touch-action: manipulation` on `button, a, input, select, textarea, [role="button"]`.
- A `.press` class: a short transform and brightness change on `:active:not(:disabled)`, `-webkit-tap-highlight-color: transparent`, `user-select: none`, and no motion under `prefers-reduced-motion`. Add it to every button in `components/play/` and on the scoring page.

Remove `backdropFilter` from the scrim in `QuickEntrySheet.tsx` and `AddEventsSheet.tsx` and darken the scrim slightly to make up for it.

### Done when

- Tapping Submit on a valid score closes the sheet and paints the row with no request finished. A component or hook test proves it with a save that never resolves.
- A failed save removes the row and shows the error toast with a working "Try again". Tested.
- A re-read arriving mid-write does not drop or double the row. Tested in `pendingResults`.
- One save of a non-game score makes one write request and no reads. Check in the browser's network panel if Tāne is signed in; otherwise say it is unverified.
- The compiler script prints nothing.

---

## Phase 2: the entry sheet

Goal: the number goes in and the button is under the thumb, with no scrolling in the common case.

### What is wrong today

- Submit is the last thing in a scrolling body (`QuickEntrySheet.tsx:724`), under the best and PR tiles, the records list, the levels, the fields and the quick picks. With the keyboard up it is off screen.
- The sheet opens filled in with today's best or the season PR and Submit is live. One stray tap saves a duplicate.
- Steppers are one size (2.5kg, 5 seconds, 1 rep) and holding one does nothing.
- Levels are a sideways row of chips labelled D1, D2 with the name cut off at 110px. The chosen level can be off screen, and the label tells the player to open How To to find out what a level is.
- Edit is 11px text and delete is a 14px ✕, side by side (`QuickEntrySheet.tsx:757`). Delete is instant.
- After a save the sheet closes and the player hunts for the next event.

### 2a. Pin the action

Make the sheet three parts: header, scrolling body, footer. The footer does not scroll. It holds the error line and Submit; in the How To view it holds "Back to scoring"; when scoring is closed it is empty. Keep the bottom safe-area padding on the footer.

The keyboard is the hard part. On iOS a `position: fixed` sheet does not move when the keyboard opens, and `dvh` does not shrink for it, so a pinned footer would sit under the keyboard. Add a small hook (for example `lib/useKeyboardInset.ts`) that reads `window.visualViewport` and gives the height the keyboard covers, and lift the sheet by it. This cannot be proven in jsdom. Say in your report that it needs a real iPhone and a real Android phone, and ask Tāne to try it.

### 2b. Order of the body

1. The "Editing" banner, when editing.
2. Variation, where the event has one.
3. Levels.
4. The fields.
5. The hint line for what was typed (estimated 1RM, pace, what ranks).
6. Quick picks.
7. Today's scores.
8. Records.

Make the best and PR tiles one compact row at the top. Keep their labels, the tests read them.

### 2c. Filled in is not ready

In a game (`natural` false), a sheet that opens pre-filled is not ready to submit until the player changes something: a field, a stepper, a level, a quick pick or a record row. Until then the button is disabled and says so in a few words. The pre-fill stays, because stepping up from the last score is the fastest way to enter the next one.

Do not apply this where `natural` is true. A training log really does take the same set twice, and the sheet's own comment (line 129) says another set of the same should be two taps.

### 2d. Fields and steppers

- Select the field's contents on focus, so typing replaces the pre-fill.
- `enterKeyHint="done"`, and Enter submits when the score is valid.
- `StepBtn` (`chrome.tsx:88`) repeats while held: one step on press, then after a short pause a steady repeat, stopping on release, on leaving the button, or on cancel. Use pointer events. It must still work from the keyboard and for assistive tech, so keep a click path for clicks that did not come from a pointer.
- Add small step chips under the field where one size does not fit: weight −5, −1, +1, +5 beside the 2.5kg buttons; reps +5 and +10; time −1s and +1s beside the 5 second buttons. Keep the placeholders and the field order, the tests find the fields by them.

### 2e. Levels

Keep the row, fix what hurts: scroll the chosen level into view when the sheet opens and when it changes; let a name wrap to two lines instead of cutting it off; show the chosen level's full name and its `detail` text on one line under the row; label the section "Level". The How To view keeps the full ladder.

### 2f. Edit and delete

Both become 44px targets with space between them. Delete asks first, in the row itself ("Delete?" with Delete and Keep), so it works the same for every host of the sheet. `JudgeSummaryTab` gets the same confirm.

### 2g. What next

The "Score in" toast gains a "Next: {event}" button that opens the sheet for the next official event this player has not scored, in list order after the one just scored, wrapping round. No button when all are scored. Give the toast `role="status"` and enough time on screen to be tapped.

### Done when

- On a 375 by 667 screen with the keyboard closed, a strength event and a hold with levels both show every field and Submit without scrolling. (Check in the pane at phone size with the sheet rendered; if you cannot reach a logged-in sheet, build a jsdom test for structure and say the layout is unverified.)
- A pre-filled game sheet cannot be submitted untouched; a pre-filled training sheet can. Tested.
- Hold to repeat is tested with fake timers.
- Existing tests pass, updated only where the behaviour changed on purpose.

---

## Phase 3: kaiwhakawā, by event

**Dropped (Tāne, 10 Nov 2026): not needed for how games run now.** Kept here in case it comes back.

Goal: a kaiwhakawā running one station can score a line of players without choosing the event again for each.

**Ask Tāne before you build this phase.** It is a new feature, not a fix. Confirm that scoring a group on one event is how kaiwhakawā work at a game, and whether "By event" or "By player" should be the default.

### Shape

- A two-way switch at the top of the Kaiwhakawā tab: By player (today's view, unchanged) and By event. Remember the choice on the device.
- By event, nothing chosen: the ten events, each with how many of the roster have a score.
- An event chosen: its name, a way back, and the roster as rows. Each row shows the player's best today on that event, or that they have none. The + Player and + Guest controls work here too.
- Tapping a player opens the same sheet for that player and that event. After a save the kaiwhakawā is back on the list, and the toast offers "Next: {player}", the next player on the roster with no score on this event.

### Things that will bite

- **The roster is built from results** (`buildJudgeRoster` in `lib/judgeRoster.ts`). A player added with + Player has no result yet, so they vanish from the roster as soon as another is chosen. By event needs players to stay once added. Extend the pure function with the added players, and test it.
- **The sheet works out its starting values when it mounts.** In By event the target changes and the sheet opens in the same tap, before that player's records have loaded, so it would open empty and never fill. Either load the records for every player on the roster for that one event when the station opens (preferred, it makes every sheet instant and is one read), or hold the form until the target's records are loaded. Do not let the sheet mount on another player's data.
- **A PR flag must not be guessed.** `isNewPR` with no rows loaded calls nearly anything a PR. If the target's rows are not loaded at save time, save with `is_pr` false.
- **The sheet for a target is drawn inside the By player view today** (`page.tsx:1845` on). Lift it out so both views share one.
- The grade profile, swaps and ratings hooks follow the target and load after the switch. They only affect colour and the standards panel, so the sheet may open before they land. Keep them keyed by player as now.
- A guest has no id: no records, no colour, no match, no added events. Keep every guard that says so.

### Done when

- Scoring three players on one event takes, per player, one tap to open, the entry, and one tap to submit.
- The roster helper and the "next player" rule are pure and tested.
- By player behaves exactly as before.

---

## Phase 4: finish

Goal: the screen is easy to read in a gym and looks like one design. This is a polish pass, not a redesign. Load the `allsport-design` skill before starting.

- **Contrast and size.** Small text in `#555` on near black is hard to read (the tab labels, several 10 to 11px labels). Secondary text should be no darker than `var(--grey)` and labels no smaller than 12px.
- **Tokens.** In the files this plan touches, replace hard-coded hex and radii with the tokens in `globals.css`. Six different radii are in use; bring them to the token set.
- **No emoji.** `JudgeSummaryTab` draws `ed.emoji` (`page.tsx:386`). Use `EventIcon`. Replace the ▲ and ▼ text with a drawn chevron.
- **One call to action in the list.** "Tap to score" sits on all ten rows. Keep it on the next event to play and give the other unscored rows a quiet marker. `EventListRow` tests render single rows and expect the pill, so make the quiet form the opt-in.
- **Sticky tab bar.** Its offset is a hard-coded `60px` (`page.tsx:1424`). Take it from the banner's real height.
- **Toasts** on the scoring page and the workout page should be one component.

### Done when

- No emoji and no hard-coded hex in the touched files, other than colours that carry meaning from `lib/domainColours.ts` and the grade colours.
- Tāne has seen it on a phone.

---

## Out of scope

- Any change to scores, colours, places or the leaderboard.
- Optimistic saves for added events and personal workouts (a later step, once phase 1 has proven itself in a real game).
- The logged-out `/play` page showing two "Continue with Google" buttons at phone width. Seen in production during the review; note it in `TODOS.md`, do not fix it here.
