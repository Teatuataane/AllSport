# Dashboard redesign — stats page, player tabs, nav bar

Spec settled in a `/grill-me` session, August 2026. **Revised after v0.6.0.0 merged
to main**, which replaced the Colours ladder with the taniwha system — see
`TANIWHA_SYSTEM_PLAN.md` and the "Taniwha grading system" block in `CLAUDE.md`.

Design canvas: **AllSport Dashboard Redesign** (Stats — parent · Stats — child tab ·
The collection · Events — wins lens · Stats — first run · Taniwha card states ·
Nav bar system · Player switcher).

Three changes that only make sense together:

1. `/dashboard` stops being an action hub and becomes a **stats and play-history page**.
2. A **player switcher** makes the family-member context visible and global.
3. A **five-tab bottom nav** replaces the hamburger, so the game screen, stats and
   everything else are one tap apart.

---

## 0. What the taniwha merge changed in this spec

| Was | Now | Because |
|---|---|---|
| Colours card — one rung of 19, a continuous bar to the next threshold | **Taniwha card** — the taniwha under construction, nine body segments, crown line beneath | `taniwhaCardStyle()` in `lib/taniwha.ts` is the definition; the crown is never a segment because it is earned by an act, not bought |
| Chart: cumulative points against colour-rung thresholds | Chart: **points into parts**, a faint line every 1,000 and the crown gate dashed at the next 10,000 | The ladder is uniform now — every 1,000 places a part — so the only dramatic gate left is the crown |
| Headline stat "Wins" (session wins) | Headline stat **"Events won"** | A win now means 1st in the **unified pool** with **≥3** players scoring it (`player_event_wins`), and nine of them crown a domain taniwha. Session wins are a different number and stay on `/leaderboard` |
| `/prs` third lens: PLAYED | `/prs` third lens: **WINS** | Wins are what release a crown; times-played answers nothing a player acts on |
| Six domain colours across ten domains | **Ten distinct hues** from `lib/domainColours.ts` | Domains 1/7, 2/8, 4/9 and 5/10 were identical pairs. Survivable when a colour only tinted an icon; not survivable now the colour **is** the taniwha's identity |
| "Colours earned" timeline | **"Taniwha crowned"**, then **"The colours era"** below it | `colour_awards` is deliberately NOT repurposed — those colours were really earned on real dates, and 5,000 points was rung 7 but is 5 parts |

Everything about the nav bar and the player switcher survived the merge unchanged,
except that the switcher's accent now follows the taniwha a player is **building**
rather than their colour rung.

---

## 1. Locked decisions

| # | Decision | Why |
|---|---|---|
| D1 | Dashboard = stats page + ONE conditional action strip | Live session, join/next-session and active vote collapse into a single banner that only renders when relevant. |
| D2 | Bottom tab bar on mobile; tabs move into the top bar at ≥768px | Players use this one-handed mid-session. |
| D3 | Tabs: **PLAY · STATS · BOARD · EVENTS · MORE** | PLAY is context-aware (D9). |
| D4 | `/prs` and the "My Events" modal MERGE into one page. **No lens toggle** — every event row shows PR, average placement and wins side by side | A toggle hides two thirds of the answer behind a tap. All three fit on one row at 390px. |
| D5 | The active-player switch is **GLOBAL**, via `useActivePlayer()` | Today only `/dashboard` reads the localStorage key. |
| D6 | Player tab strip renders ONLY when `familyMembers.length > 0` | Most accounts are solo. |
| D7 | The stats page is **four blocks**: identity → taniwha card → four numbers → skill radar. Nothing else | Play history, the collection tiles, the crown-progress bars and the colours era all moved off it. |
| D8 | The one visualisation is a **ten-spoke skill radar**, driven by average Top % per domain | Replaces the points-over-time line. Points now live as three numbers on the taniwha card, where they mean something specific; the radar answers "what am I good at", which nothing else on the page did. |
| D9 | PLAY is judge-aware | `role = 'judge'` → live session, else `/judge`. |
| D10 | **Lifetime** governs the page; the only seasonal things are a timeline filter chip and an explicitly-labelled "2026 board" rank line | Taniwha points are lifetime, `rankings` is seasonal, `lib/percentile.ts` is lifetime-only. |
| D11 | Headline stats: **Total Games · Events Won · Games Won · Total PRs** | Avg Place dropped — the radar carries relative standing better than a mean ordinal does. Events Won and Games Won are different numbers and both matter: events release crowns, games are division wins. |
| D12 | One new RPC loads the whole household; tab switching does **zero** network | Measured per-request overhead here is ~2.2s for a 20-row read. |
| **D13** | **New screen: MY TANIWHA** (`/taniwha`) — four counts, then each taniwha as an expandable row revealing its ten named limbs | The card can only show the one under construction. |
| **D15** | **New screen: TANIWHA HISTORY** — opens from the taniwha card. Holds the choose/switch control, limbs earned with dates, the play-history timeline, and the colours era | The card should show one thing well. Everything historical or configurational sits one tap behind it. |
| **D16** | Ten **limbs**, not nine parts plus a crown, in all player-facing copy | The card reads "5 of 10 limbs". The crown is limb 10 and is still earned by an act, but a player counts to ten, not to nine-and-then-something-else. |
| **D14** | Every taniwha surface keeps the **Colours fallback** | The two migrations are written and NOT applied. `loadTaniwhaState()` returns null on `PGRST205` and the old card renders. The rewrite must preserve that, and must never fold a taniwha column into an existing select — a missing **column** returns `42703` and takes the whole query down. |

---

## 2. Navigation

### `components/BottomNav.tsx` (new)

Fixed, `height: 64px` + `env(safe-area-inset-bottom)`, `#0a0a0a` at 96% with a
`#1e1e1e` top border. Five equal grid columns, each ~78px wide. Inline stroke SVG
icons at 22px, `stroke-width: 1.8`, plus a 10px Barlow Condensed label.

| Tab | Resting | Active | Special |
|---|---|---|---|
| PLAY | `#5c5c5c` | — | Session live → `#4DB26E` + pulse dot. Judge → label **JUDGE**, `#EA4742` |
| STATS | `#5c5c5c` | `#ffffff` | — |
| BOARD | `#5c5c5c` | `#ffffff` | — |
| EVENTS | `#5c5c5c` | `#ffffff` | — |
| MORE | `#5c5c5c` | `#ffffff` | — |

```
PLAY   judge + live session → /scoring/{id}
       judge, nothing live  → /judge
       player + live session → /scoring/{id}   (opens the active player's tab — §3)
       player, nothing live  → /dashboard#join
STATS  /dashboard
BOARD  /leaderboard
EVENTS /prs
MORE   bottom sheet
```

MORE sheet: **Kaiwhakawā Panel** (judges only, tinted red), My Profile & Family,
Schedule, Koha, How to Play, Supporters & Partners, Sign out. Personal Bests is
absent — it is the EVENTS tab.

### `components/Navbar.tsx` (rewrite)

60px → **48px**, rainbow stripe kept, logo only when logged in. The DASHBOARD pill,
SIGN OUT and the whole hamburger are deleted. At ≥768px the five tabs render as top-bar
text links and `BottomNav` does not mount.

Net chrome on a solo phone account: **112px**, against today's 65px — and nothing is
buried behind a hamburger.

---

## 3. Player switcher

### `lib/useActivePlayer.ts` (new)

Wraps `allsport_active_player_id`. Returns `{ activePlayerId, activePlayer,
familyMembers, setActivePlayer, isViewingSelf }`. Falls back to the auth user when the
stored id is not one of the user's own children — that guard exists inline at
`app/dashboard/page.tsx:141` today and must be preserved, since `parent_id = auth.uid()`
is what RLS allows.

Consumers: `/dashboard`, `/prs`, `/taniwha`. `/leaderboard` and `/events` are global.

### `components/PlayerTabs.tsx` (new)

Sticky under the top bar. Returns `null` when `familyMembers.length === 0`.

- Chip: 26px avatar + Barlow Condensed 14px name. **45px × ~92px.**
- Active chip: white label, tinted avatar, and a 2px underline in
  **`taniwhaOnDark(building)`** — the accent of the taniwha that player is building.
  Falls back to the colour rung pre-migration, matching D14.
- Parent first, trailing dashed **+** → `/profile#family`.
- Overflow: `overflow-x: auto`, right-edge fade. Same gesture as the live-session strip.
- Viewing-as banner when `!isViewingSelf`, tinted in the **child's** taniwha accent.

### Live session

`app/scoring/[sessionId]/page.tsx:2140` currently does
`setActiveTab('player-' + authUser.id)`. Change to: if `activePlayerId` has a result row
in this session, open that tab; else keep today's behaviour. Attribution is unchanged.

---

## 4. The stats page — `app/dashboard/page.tsx`

Four blocks, plus the conditional action strip. Nothing else.

1. **Action strip** — conditional, at most one: live session (green) > active vote
   (purple) > next-session countdown (blue). On a child's tab this slot carries the
   viewing-as banner instead.
2. **Identity** — 54px icon tile, name in Bebas 30px, `DIVISION · ROLE`, and the
   seasonal division rank labelled `OF n · 2026 BOARD`. Unchanged.
3. **Taniwha card** — the page's centrepiece.
   - `CURRENTLY EARNING` label.
   - Taniwha name, then its **English gloss** on the line beneath
     ("Te Taniwha ō te Whānau" / "Taniwha of Connection").
   - `TAP FOR TANIWHA HISTORY`.
   - **The creature, assembling** — the eleven pieces layered: earned solid in the
     accent, the piece under construction faint, the rest ghosted. Real artwork
     where it exists (Whānau today), filler geometry everywhere else.
   - `5 / 10 LIMBS`, then `CURRENTLY BUILDING · Ringa Matau · right arm · limb 6`.
   - **Three point figures side by side**: `THIS TANIWHA` (limbs placed × 1,000),
     `THIS LIMB` (progress toward the next 1,000), `ALL TIME` (lifetime), with a thin
     progress bar for the current limb underneath.
   - **No crown-condition line and no choose button.** Both moved to Taniwha History.
   - Four treatments from `taniwhaCardStyle()`: domain flood, Whānau/Kāhui crest,
     Pango inverted, and the idle "choose your next" state.
4. **Headline stats** — Total Games · Events Won · Games Won · Total PRs.
5. **Skill across the domains** — a ten-spoke radar, one spoke per domain in that
   domain's colour, each reaching `100 − averageTopPct` for that domain. Two rings and
   ten spokes for reference, vertices dotted in the domain colours, labels outside.
   Beneath it, `STRONGEST` and `WEAKEST` named with their Top %, so the shape never has
   to be decoded. Unplayed domains sit at the centre.

**Bottom nav is fixed** — `position: fixed`, `env(safe-area-inset-bottom)`, and a
`0 -12px 28px rgba(0,0,0,0.65)` top shadow so it reads as floating above the content
rather than ending it. Same on every page.

**Deleted from the dashboard:** the Judge card, Player Profile card, Personal Bests
card, My Events card, My Koha card, standalone Join a Game card, the points-history
modal, the My Events modal, the play-history timeline, the collection tiles, the
played/crown-progress bars and the colours-era list.

**First run** (zero sessions): countdown card elevated, honest `NO GAMES YET` block,
and the taniwha card showing Te Whānau at 0/10 with Tinana named as what the first
1,000 points buys.

---

## 4b. Taniwha History — new page

Opens from the taniwha card. In order:

1. Compact summary of the taniwha under construction.
2. **Change what you are building** — the picker, with the standing warning that limbs
   stay where they were placed. This is `TaniwhaCard`'s existing `choose_taniwha` flow,
   relocated.
3. **Limbs earned** — one row per limb, newest first: number, name, English, the date
   and venue it landed, and the lifetime total at that moment.
4. **Play history** — the session timeline, moved here from the dashboard. Placement
   badge, date, `venue · n in division`, `total` over `placement + effort`; expands to
   the session's events with `WON` in amber where the event was won. `ALL TIME` / `2026`
   chips. Paginate at 20.
5. **The colours era** — `colour_awards`, with the line saying it is kept as history and
   never rewritten as taniwha limbs.

---

## 4c. My Taniwha — new page

1. Four counts across the top: **Taniwha · Limbs · Crowns · Points**
   (`1/12`, `5/110`, `0/11`, `5,720`). "Taniwha" counts those **started**, not crowned.
2. The explanation paragraph (points place pieces, the crown is earned, pieces stay put).
3. **Te Taniwha ō te Whānau**, then the ten domains, then Te Kāhui — each an expandable
   row. Collapsed: icon, name, gloss, wins toward 9, limbs placed. Expanded: all ten
   limbs by number and name with their English, earned / building (showing
   `720 / 1,000`) / locked, and the crown's condition spelled out on limb 10.

---

## 5. My Events — `app/prs/page.tsx`

Two parts.

**Domain comparison, above the list.** Ten rows, sorted strongest to weakest: a domain
colour swatch, the domain name, a bar reaching `100 − Top%`, and the Top % itself.
Answers "what am I good at, what am I bad at" before any domain is opened, and one line
underneath explains what Top % measures.

**The domains themselves**, collapsible as today. Header shows `n PLAYED · x OF 9 WINS ·
y TO CROWN` and the domain Top %. Expanded, a column-header row then every event in the
domain with **all three numbers at once**:

| Column | Value |
|---|---|
| PERSONAL BEST | the PB score label, or `NOT PLAYED` |
| AVG | mean placement in that event, 1dp |
| WON | times won, amber when > 0 |

Never-played events stay visible at 0.4 opacity with dashes in the numeric columns.
No lens toggle — a toggle would hide two thirds of the answer behind a tap.

---

## 6. Data

### New migration — `player_dashboard(p_player_ids uuid[])`

Same Stage-1 pattern as `20260821000000_leaderboard_rpc.sql`: **INVOKER rights**, reads
`players_public` (never `players`), one JSONB object.

```
{ totals:    [player_totals rows],
  rankings:  [current-season rankings rows],
  summaries: [session_player_summary joined to sessions(session_date, location, is_championship)],
  awards:    [colour_awards joined to sessions(session_date, location)],
  prCounts:  [{player_id, pr_count}] }
```

**Taniwha data stays OUT of this RPC and keeps its own two queries** — `player_taniwha`
and `player_event_wins`, exactly as `loadTaniwhaState()` does them today. Folding them in
would make the whole bundle fail with `PGRST205` before the migrations land, taking the
rest of the dashboard down with it. That is the deploy-order rule from `CLAUDE.md`, and
it is the reason the taniwha reads are separate in the first place.

Called once with `[authUserId, ...familyMemberIds]`. Combined with `stats_bundle()`,
which already returns every player's full result history, the page holds every tab's
data before the parent taps. Switching players is pure React state.

Deploy order: **migration first, then code** (additive). Before adding the file:

```bash
ls supabase/migrations | cut -c1-14 | sort | uniq -d
```

Create it with `supabase migration new`, never by hand-naming. Verify as `anon`, not as
`postgres` (BYPASSRLS):

```sql
begin;
set local role anon;
select jsonb_array_length(public.player_dashboard(array['<uuid>']::uuid[]) -> 'totals');
rollback;
```

---

## 7. Build order

**Status: SHIPPED.** Merged as PR #91 and all migrations applied and verified in
production on 2026-08-26.

1. Migration `player_dashboard` → push → verify as `anon`.
2. `lib/useActivePlayer.ts` + `components/PlayerTabs.tsx` (taniwha accent, colour-rung fallback).
3. `components/BottomNav.tsx` + `Navbar.tsx` slim-down + MORE sheet, mounted in
   `app/layout.tsx` behind auth.
4. Rewrite `app/dashboard/page.tsx` against the new RPC, reusing `TaniwhaCard` and
   `TaniwhaTimeline` as they stand and keeping the Colours fallback intact.
5. New `/taniwha/history` page (D15) — relocate the picker and the play-history
   timeline out of the dashboard.
6. New `/taniwha` My Taniwha page (D13).
7. Merge the My Events modal into `app/prs/page.tsx` with the three-column event rows
   and the domain-comparison strip; delete the modal and the My Events card.
8. Point `/scoring/[sessionId]`'s default tab at the active player.

Steps 2–7 are all safe before the taniwha migrations land, because every taniwha read
falls back. Do NOT gate this work on those migrations.

---

## 8. Open / deliberately deferred

- **The two taniwha migrations are not applied.** Apply from `main`, in order
  (`20260824220633` then `20260824222612`), and verify by querying the objects rather
  than trusting `supabase migration list`.
- **Four taniwha names are placeholders** — Hiko, Manawanui, Mataara and Ruruku, plus the
  Hiko/Hiku, Kaha/Kaha Tinana and Manawanui/Manawaroa near-collisions and the macron on
  `ō`. The canvas draws them as they stand in the code so the layout is judged at real
  string lengths. A rename costs nothing in storage (the award row snapshots the name)
  but will change line wrapping on the card and the collection rows.
- **Twelve drawings × ten registered layers each** are outstanding. Until they exist the
  card and collection carry tinted tiles, which is what the canvas shows. All ten parts of
  a taniwha must be exported on one canvas with the same registration or they will not
  layer, and a filename that is not the exact slug falls back silently.
- **Focus states across the new nav** — P2 in TODOS.md. An earlier draft of this plan
  claimed the bottom bar and player tabs were built on `components/ui.tsx` primitives.
  They are NOT: they use inline styles, matching the surrounding code, which means no
  `:focus-visible` on any of them. Touch targets ARE at the 44px floor (tabs 44, chips
  45), so what is left is keyboard focus, and it now covers three surfaces rather than
  one. Folded into the existing TODOS entry.
- **Season lens for percentiles** — `lib/percentile.ts` is lifetime-only by design.
- **Limb dates are derived, not stored.** `player_taniwha` holds a count, not a
  row per limb, so Taniwha History reconstructs the date each limb landed by
  running the session points in order and watching each 1,000-point boundary —
  `limbCrossings()` in `lib/taniwha.ts`, 6 unit tests. It deliberately does NOT
  claim WHICH taniwha a limb went on: switching is not recorded either.
- **`gloss` added to `lib/taniwha.ts`** — the English name under each te reo one.
  "Taniwha of Connection" is Tāne's; the other eleven are mine.
- **Macron on the particle** — the code has `Te Taniwha ō te …`; Tāne wrote
  `Te Taniwha o te …`, and `lib/taniwha.ts` already flags the macron as unsettled. The
  canvas follows the code. One decision, twelve strings.
- **English glosses** — "Taniwha of Connection" is Tāne's; the other eleven are mine and
  need confirming, especially for the four placeholder names.
- **Average placement per event** is not stored. `results.placement` is the session's
  division rank, repeated on every row — it is NOT a per-event placement. The `AVG`
  column on My Events needs `results.event_placement`, which `20260824220633` adds and
  backfills. **That column is a hard dependency for My Events**, unlike everything else
  here, which degrades gracefully.
