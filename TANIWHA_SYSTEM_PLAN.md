# Taniwha — Ranking & Grading System Rework

**Status:** design locked, ready to build
**Date:** 25 August 2026
**Supersedes:** the "Colours" ladder defined in `COLOURS_REWORK_PLAN.md` (August 2026 session 28)
**Settled in:** a `/grill-me` session with Tāne

Every decision below was chosen deliberately. Where a decision goes against the obvious
default, or against my recommendation, the reason is recorded.

---

## 1. What changes, in one paragraph

The ranking system stops being a ladder of 19 coloured rungs and becomes a **collection of
twelve taniwha**, each assembled from ten named body parts. Nine parts of every taniwha are
bought with lifetime points, exactly as colours are today. The tenth part, **the crown**, is
released by an act: a qualified referral for the first taniwha, and **winning 9 of the 12
events in that domain** for each of the ten domain taniwha. The twelfth taniwha, **Te Kāhui**,
is awarded for holding all eleven crowned. The ten brand colours move off the rungs and onto
**the domains**, so each domain taniwha wears its own colour, and the rank names become the
**body parts in te reo**. The competitive `/leaderboard` ranking stays seasonal and untouched.

The point of the change: the old ladder rewarded dedication only, and its story ("you are
purple") said nothing about the sport. The new one says something true and specific. Nine
parts are earned by turning up; **the crown is always earned by doing something.**

---

## 2. Decisions locked

| # | Decision | Chosen | Note |
|---|---|---|---|
| 1 | Shape | **12 taniwha × 10 parts** | 1 whānau + 10 domain + 1 amalgam. 111 awards in total. |
| 2 | Part cost | **flat 1,000 lifetime points, forever** | Consistent across all taniwha including the first. Replaces the old uneven 500/1,000/2,000 spacing. |
| 3 | Points map | **fixed and uniform** | Every 1,000 points fills one slot; every tenth slot is a crown. Total to Te Kāhui = **110,000**. |
| 4 | Crown cost | **points slot AND its condition** | Chosen over "crown by wins alone". Keeps the map uniform and removes any incentive to stall. |
| 5 | Whānau crown | **one qualified referral** | Someone you brought who has played 10 sessions. The only crown a player cannot earn alone. |
| 6 | Domain crown | **win 9 of the 12 events in that domain** | Distinct events, each won at least once. |
| 7 | What counts as a win | **1st in that event, within your division pool, in a session where ≥3 pool players scored that event** | Ties count as shared 1st, matching the sport's own rule. |
| 8 | Parking | **yes** | An unearned crown leaves its slot empty and the next taniwha's spine arrives at the following 1,000. The crown fills in retroactively whenever the condition lands. Points can never stall. |
| 9 | Choosing the next taniwha | **the player chooses** | Prompted on their next dashboard visit after the session in which the crown slot's points landed. |
| 10 | Switching | **allowed, points do NOT transfer** | Parts stay on the taniwha they were placed on and are resumed if that taniwha is chosen again. Switching costs tempo, not value. |
| 11 | Domain locks | **when the crown slot is passed** | Free switching up to that point. Once passed without the wins, the taniwha parks headless as that domain forever. |
| 12 | Selection during a live session | **locked** | So a player cannot change their crown condition while the kaiwhakawā is about to announce it. |
| 13 | Choice visibility | **public** | Shown on the leaderboard and profile. A declared intention the coach can work with. |
| 14 | Crowned domains | **removed from the picker** | The eleventh choice is forced: your last taniwha is whatever you avoided. |
| 15 | Rank | **parts held**, 0–111 | Two players on equal points differ only by crowns. Points set the ceiling; crowns are how much of it you have claimed. |
| 16 | Badge | **crowned taniwha count** | "A four taniwha player." Parts are the progress bar underneath. |
| 17 | Leaderboard sort | **parts held, lifetime points as tiebreak** | |
| 18 | Colours | **move to the domains** | Ten basic colour categories, one per domain. Chosen over a spectrum walk: basic categories are the most separable ten the eye can hold, all six brand hexes are reused unchanged, and a nine year old can name every one. |
| 19 | Rank names | **the ten body parts, in te reo** | |
| 20 | Naming convention | **Te Taniwha ō te ___**, descriptive | Not proper names. Needs nobody's permission, explains itself, and `colour_awards` already snapshots names so a later rename is cheap. |
| 21 | Taniwha proper names | **deferred** | Real taniwha from pūrākau are iwi taonga; several Ōtautahi and Canterbury taniwha are named Ngāi Tahu ancestors. Not invented by Claude, not borrowed. A gift from a kaumātua later drops in over the top. |
| 22 | Peak name | **Te Kāhui**, the assembly | Preferred over Uenuku, which is a named atua and tupuna and carries more weight than a descriptive title. |
| 23 | Section name | **Taniwha** | Replaces "Colours" on the dashboard, leaderboard, homepage and profile. |
| 24 | Event wins | **stored, not computed** | New `event_placement` + `event_field_size` on `results`, written at session close, plus a full backfill of history. |
| 25 | Guests | **excluded** | Neither as winners nor toward field size: a guest row has no `player_id` and therefore no division to pool them into. |
| 26 | Wins are historical facts | **independent of what you were building** | Switching to a domain instantly inherits every win you ever earned in it. This is what makes switching at the crown slot work. |
| 27 | Seasonal leaderboard | **unchanged** | `rankings` still drives `/leaderboard`'s competitive ranking, still resets each January. Only the grading system changed. |
| 28 | Second path to a crown | **rejected** | "Win 9 of 12 **or** play all 12" was considered and declined: because a session draws one event from every domain simultaneously, coverage completes in all ten domains at once at ~50 sessions, so every crown would arrive in one clump and the wins requirement would become decorative. |

---

## 3. The structure

### 3.1 The points map

Uniform. **Every 1,000 lifetime points fills one slot. Every tenth slot is a crown.**

> **A slot is not a fixed cell.** The intuitive reading, that slot 15 is "taniwha two, part
> five", is wrong and was corrected while building step 5. Decision 10 says a player may
> switch and their parts STAY on the taniwha they were placed on, resumable later. Under a
> fixed map that taniwha's slots are gone and it could never be finished. So points grant a
> **budget**, not an address:
>
> - body-part budget = `floor(p/1000) − floor(p/10000)`, capped at **99** (11 × 9)
> - crown capacity = `floor(p/10000)`, capped at **11**
>
> At 110,000 that is exactly 99 body parts and 11 crowns, so every threshold in the table
> below is unchanged. Which taniwha the budget is spent on is the player's choice and lives in
> the database. **Crowns are fungible**: the points open your Nth crown, and whichever act
> lands first takes it — so a player who wins 9 of 12 before earning a referral crowns a
> domain first and Whānau second.

| Taniwha | Body part slots | Crown slot | Crown condition |
|---|---|---|---|
| 1 · Te Taniwha ō te Whānau | 1,000 → 9,000 | **10,000** | one qualified referral |
| 2 · chosen domain | 11,000 → 19,000 | **20,000** | win 9 of 12 events in that domain |
| 3 · chosen domain | 21,000 → 29,000 | **30,000** | " |
| … | … | … | … |
| 11 · last domain | 101,000 → 109,000 | **110,000** | " |
| 12 · **Te Kāhui** | — | — | hold all eleven crowned |

**111 awards. `PEAK_POINTS` moves from 100,000 to 110,000.** That is the only number
carried over from the old system that changes.

If a crown's condition is unmet when its slot arrives, **the slot stays empty** and the next
taniwha's Tinana appears at the following 1,000. The crown fills in later, at no further
points cost. Crowns therefore fill **out of order**, which is fine: by the time you are
building taniwha five you are long past taniwha two's points threshold.

### 3.2 Invariants worth pinning with tests

- **Total parts placed ≤ `floor(lifetime_points / 1000)`**, with equality once every
  outstanding crown has landed. The difference is exactly the number of empty crown slots.
- **No slot can be skipped in one session.** The smallest gap is now a uniform 1,000 and the
  theoretical maximum for one session is 200 (100 placement + 100 effort, per
  `MAX_SESSION_POINTS`). The old ladder's 500-point gap is gone, so this invariant is now
  even safer than before. It is what lets the kaiwhakawā alert announce one thing at a time.
- **Parts are never destroyed.** Switching leaves them on the taniwha they were placed on;
  choosing that taniwha again resumes from where it stopped.

### 3.3 Pace

Using the real figures measured in `COLOURS_REWORK_PLAN.md` from 113 player-sessions:
**149 pts/session** for a division winner, **93** for a runner-up.

| Milestone | Keen winner (3×/wk) | Casual non-winner (1.5×/wk) |
|---|---|---|
| First part (1,000) | ~7 sessions, 2–3 weeks | ~11 sessions, ~7 weeks |
| First taniwha crowned (10,000) | ~4.5 months | ~1.4 years |
| Each further taniwha (10,000) | ~4.5 months | ~1.4 years |
| **Te Kāhui (110,000)** | **~5 years** | ~15 years |

**Accepted cost:** flat 1,000 moves the first award from 500 points to 1,000, roughly seven
sessions instead of three to five. The old ladder deliberately put a rung at 500 on the
reasoning that a player's first colour is the best celebration you get to give them. Tāne
accepted the trade for consistency. **If the first-session moment needs compensating, do it
outside the ladder** (the existing DR-7 session-count milestones are the obvious home).

---

## 4. The eleven parts

Award order is the assembly order, and it tells a story: the body assembles, gains its
wings, issues the wero, picks up the tool of its discipline, and only then earns its crown.

| Slot | Part | Te reo |
|---|---|---|
| 1 | body | **Tinana** |
| 2 | head | **Pane** |
| 3 | tail | **Hiku** |
| 4 | left arm | **Ringa mauī** |
| 5 | right arm | **Ringa matau** |
| 6 | left leg | **Waewae mauī** |
| 7 | right leg | **Waewae matau** |
| 8 | wings / fins | **Parirau** |
| 9 | tongue | **Arero** |
| 10 | **the implement** | per taniwha — see §5 |
| 11 | **crown** | **Tikitiki** |

**Ten body parts bought with points, plus a crown that must be earned.** Revised 26 August
2026 from the original nine-plus-crown:

- **Neck and head merged.** "You have unlocked a neck" was never going to feel like anything,
  and a merged head reads far better in silhouette.
- **Parirau added**, because it changes the top edge of every silhouette, which is what makes
  twelve black shapes tellable apart at 24px.
- **Part ten became the implement**, the only part that differs between taniwha.

**The arithmetic got simpler, not harder.** The budget was
`floor(p/1000) − floor(p/10000)`; that subtraction existed only because every tenth slot was
consumed by a crown. With ten body parts the crown stops consuming a slot at all, so:

- body-part budget = `floor(p/1000)`, capped at **110** (11 × 10)
- crown capacity = `floor(p/10000)`, capped at **11**

`PEAK_POINTS` is unchanged at 110,000 and no crown threshold moved.

*Mauī* and *matau* keep the four limbs distinct without inventing anything. PENDING A REO
SPEAKER, along with **Parirau** and the four implement names marked below.

## 5. The twelve taniwha

| | Taniwha | Domain | Colour | Te reo | Hex |
|---|---|---|---|---|---|
| 1 | **Te Taniwha ō te Whānau** | — | gold | Kōura | `#F9B051`, crest treatment |
| 2 | Te Taniwha ō te **Kaha** | 1 Maximal Strength | red | Whero | `#EA4742` |
| 3 | Te Taniwha ō te **Kaha Tinana** | 2 Calisthenics | orange | Karaka | `#F9B051` |
| 4 | Te Taniwha ō te **Hiko** | 3 Power | yellow | Kōwhai | `#F9E051` |
| 5 | Te Taniwha ō te **Tere** | 4 Speed | green | Kākāriki | `#4DB26E` |
| 6 | Te Taniwha ō te **Manawanui** | 5 Anaerobic Endurance | blue | Kahurangi | `#2371BB` |
| 7 | Te Taniwha ō te **Manawaroa** | 6 Aerobic Endurance | purple | Poroporo | `#B87DB5` |
| 8 | Te Taniwha ō te **Ngāwari** | 7 Flexibility | pink | Māwhero | `#F397C0` |
| 9 | Te Taniwha ō te **Mataara** | 8 Body Awareness | brown | Kōkōwai | `#B87333` |
| 10 | Te Taniwha ō te **Ruruku** | 9 Coordination | white | Mā | `#F2F2F2` |
| 11 | Te Taniwha ō te **Tika** | 10 Aim & Precision | black | Pango | inverted card |
| 12 | **Te Kāhui** | all | rainbow | Uenuku | `var(--rainbow)` |

### 5.0 The implements — part ten

Every one is drawn from a **real event in that domain** rather than invented. That is also how
the two domains with no obvious equipment got one: Speed has Beach Flags and Capture the Flag,
and Flexibility's Forward Split and Middle Split are literally scored as block height from the
ground. The same two domains had no natural colour either, which is a pattern rather than a
coincidence.

| Taniwha | Implement | Te reo | From |
|---|---|---|---|
| Whānau | many hands | Ngā Ringaringa | the invitation — its crown is a referral, and the sport needs no equipment to start |
| Kaha | barbell | Pou Taumaha *(reo TBC)* | Deadlift, Clean & Press |
| Kaha Tinana | rings | Porowhita | Iron Cross, Front Lever |
| Hiko | javelin | Tao | Javelin |
| Tere | flag | Kara | Beach Flags, Capture the Flag |
| Manawanui | ab wheel | Wīra *(reo TBC)* | Ab Rollout |
| Manawaroa | oar | Hoe | Row Erg, Ski Erg |
| Ngāwari | block | Papa *(reo TBC)* | Forward Split, Middle Split |
| Mataara | jump rope | Taura | Jump Rope |
| Ruruku | racquet | Rākete *(reo TBC)* | Tennis, Badminton, Squash |
| Tika | bow | Kōpere | Archery |
| Te Kāhui | the other eleven | Ngā Taniwha | holding all eleven crowned |

**One consequence worth knowing.** The implement is the last part before the crown, so for most
of the months spent building a taniwha it is not there. That is arguably perfect — the creature
assembles, picks up the tool, then earns its crown — but it means the implement cannot be what
makes the twelve tellable apart on the dashboard. The build still has to carry that.

**Gold and rainbow bracket the set** as the two that are not domains: gold where everyone
begins, rainbow where everyone is trying to arrive.

### 5.1 Three colour treatments that are not just a hex

- **Black (Aim & Precision) inverts the card**: pale surface, black creature. Taniwha render
  as CSS masks tinted the domain colour, the same pipeline as `EventIcon`, so a black tint on
  the `#0a0a0a` background is literally invisible. `colourCardStyle()` already varies the
  surface per rung, so this costs nothing structurally and makes the black taniwha the most
  arresting of the ten rather than the one that broke. **Black is on Aim & Precision on
  purpose**: a bullseye is black, a pupil is black, and black is the heaviest colour in the
  set so it belongs on the domain with the most iconic image, not on ball sports.
- **Brown is kōkōwai, red ochre**, not a neutral brown. Red, orange and brown are the same
  hue family separated only by value and saturation, so brown is this palette's crowded
  stretch and needs to be pushed warm and light enough to survive at 24px. Kōkōwai is the
  ochre on carvings and wharenui, so it carries weight instead of being the dull one.
  **Shipped as `#B87333`**, brighter than the `#A9663C` first drafted here, which went
  muddy against `#0a0a0a` at chip size. Verified on screen at 46px tile, 24px chip, 8px
  bar and as text: clearly separate from both Whero and Karaka.
- **Whānau gold and Calisthenics orange are the same hex.** They are separated by treatment,
  not hue: Whānau wears the crest (black card, amber accent, twin taniwha), Calisthenics is a
  solid orange card. **Verify this reads at chip size before shipping**; if it does not, move
  Whānau to a deeper gold rather than moving Calisthenics.

### 5.2 This palette replaces `DOMAIN_COLORS` app-wide

**DONE — shipped as build-order step 1.** The palette now lives in **`lib/domainColours.ts`**,
not in `components/EventIcon.tsx`, because `app/events/page.tsx` is a SERVER component and
importing from a `'use client'` module there would have pulled a client component into the
server graph — the exact thing that file's header comment says it was refactored to avoid.
`EventIcon` re-exports both names so the existing client call sites did not have to change,
and `/events` still prerenders as static in the production build.

There were **three** copies of the array, not two: `EventIcon.tsx`, `app/scoring/page.tsx`
and `app/events/page.tsx` (spelled `DOMAIN_COLOURS` there, which is why the earlier grep
missed it). All three carried the same bug and all three are now gone.

`components/EventIcon.tsx` previously exported **six distinct colours across ten domains**:
domains 1 and 7 are both red, 2 and 8 both amber, 4 and 9 both purple, 5 and 10 both blue.
Fine for tinting an icon; fatal once the colour *is* a taniwha's identity, since four pairs
would be indistinguishable.

Replacing it fixes an existing bug and improves every surface that tints by domain: event
icons, `components/DomainIcon.tsx`, `/prs`, the live session progress segments, and the
dashboard domain coverage bar. **`app/scoring/page.tsx` holds a seventh, separate copy of
`DOMAIN_COLORS`** (line 13) that must be deleted and imported instead.

---

## 6. Choosing, switching and parking

1. **Prompted on the next dashboard visit** after the session in which the crown slot's
   points landed. If the crown is not unlocked, the prompt states the unlock condition
   plainly and shows progress toward it.
2. **At the crown slot the player has three moves:** crown it, switch it to a domain they
   have already qualified in, or park it and choose the next taniwha.
3. **Switching is free up to the crown slot.** Parts do not transfer; they stay on the
   taniwha they were placed on and are resumed if that taniwha is chosen again. All ten
   domains are compulsory eventually, so switching changes order, not value.
4. **Passing the crown slot locks the domain.** The taniwha parks headless as that domain
   forever and waits for its own crown.
5. **Selection is locked while the player has a live session in progress.**
6. **Crowned domains are removed from the picker.**
7. **If the player never chooses**, parts bank and all land at once the moment they do.
8. **Family profiles**: whoever holds the active profile chooses, via the existing
   `allsport_active_player_id` switcher. No new permission model.

A consequence, and it is fine: since you can switch right up to the crown slot, the optimal
play is to arrive at a crown slot and claim whichever domain you have already won 9 of 12 in.
That rewards a player for knowing their own record, and the only thing being optimised is
order.

---

## 7. Event wins

### 7.1 Storage — stored, not computed

Wins do not exist anywhere today. `results.placement` is the player's **overall** session
rank in their division, not their rank in an event; per-event placement is computed live from
`raw_score` on `/games/[sessionId]`.

Add to `results`, written by the trigger at session close:

- `event_placement int` — rank within the division pool for that event
- `event_field_size int` — how many pool players scored that event in that session

This is roadmap item 9 ("per-event placement storage"), which this feature now pays for.
Computing on the fly would mean loading every result of every session on the dashboard, the
leaderboard **and** the live kaiwhakawā alert, and the app has already been through one
performance pass (`PERF_AGGREGATION_PLAN.md`) specifically to stop doing that.

"Distinct events won in domain D" then becomes one indexed query:

```sql
SELECT count(DISTINCT se.event_name)
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE r.player_id = $1
  AND se.domain_number = $2
  AND r.event_placement = 1
  AND r.event_field_size >= 3;
```

### 7.2 Backfill

All history must be reprocessed with the same logic `/games/[sessionId]` uses, or the top
players lose years of legitimate wins.

**This cuts both ways and needs to be simulated before it runs.** After backfill the
strongest players may already sit at seven or eight of twelve in a domain, so the system
launches with real progress rather than everyone at zero, and **the first crowns could land
within days**. That is desirable, but confirm the numbers before deploying so nobody is
surprised by a crown they did not see coming.

### 7.3 Edge cases, decided

- **Guests are excluded** from both the win and the field size. A guest row has no
  `player_id` and therefore no division to pool them into.
- **Ties count as shared first**, matching AllSport's "ties: shared placement awarded" rule.
- **Field size < 3 produces no win**, so an event only one person attempted is not a free win.
- **Division pools are the unified ones** (`divisionPool()` in `lib/rating.ts`: men / women /
  juniors), the same pools the live leaderboard and `lib/percentile.ts` already use. Masters
  and Grandmasters rank inside their gender pool.
- **Wins survive a division change.** They are historical facts attached to a result row, not
  to a current division. This matters: `rankings` already has a latent bug where changing
  division mid-season splits a player across two rows, and wins must not repeat it.
- **A rename of an event does not orphan wins**, because the query groups on
  `session_events.event_name` — which is exactly the trap documented in CLAUDE.md. **Any
  future event rename must sweep this query too.**

### 7.4 Where wins are displayed

- **`/prs` is the win sheet.** It already lists every event grouped by domain with per-event
  history. Add a win marker to each event row and `9 of 12 won` to each domain header.
- **The dashboard Taniwha card** shows the taniwha under construction, its parts, and the
  crown condition with progress.
- **The live session event list** is the strongest surface: when the player is about to play
  an event they have never won, in the domain they are building, say so — *"a win here takes
  you to 7 of 12"*. That puts the crown condition in front of them at the exact moment they
  can act on it.
- **`/events/[slug]`** shows whether the player holds that event.

---

## 8. Data model

Nothing in this section is expensive, because **prod has almost no state above the point where
the systems diverge**: the highest lifetime total is Rodrigo on 5,150 and Tāne on 4,470, and
**the highest rung anyone has reached is 7**. Everything above that is unoccupied.

### 8.1 Existing tables

- **`player_totals`** — unchanged. Still keyed on `player_id` alone, still recomputed rather
  than incremented. Both of those decisions still matter for the same reasons
  (`COLOURS_REWORK_PLAN.md` §4.1, §5.1): a division change must not reset a lifetime total,
  and a lifetime total that is incremented makes the ×2 double-award class of bug permanent.
- **`colour_ladder`** — replaced. It mirrors `lib/colours.ts` so the trigger and backfill can
  join on thresholds; the new mirror is the taniwha/part definition.
- **`colour_awards`** — **NOT repurposed. Left exactly as it is** (this reverses the plan's
  first draft). It holds ~19 rows recording colours that were really awarded and really
  celebrated, on real dates. Rewriting them into taniwha parts would fabricate history, and
  the numbers do not even line up: Kahurangi was rung 7 at 5,000 points, and 5,000 points is
  5 parts. It stays as the record of the retired colours era and the new system gets its own
  table, so nothing is lost and nothing is invented.

### 8.2 New

- **`player_taniwha`** — one row per (player, taniwha): which domain it is, how many parts it
  holds, whether it is the one under construction, whether it is parked, and when it was
  crowned. This is the state that switching and parking need and that points alone cannot
  express.
- **`results.event_placement`**, **`results.event_field_size`** — see §7.1.

### 8.3 Functions

- **`award_session_points()`** — extended again: after `recompute_player_total`, write
  `event_placement` / `event_field_size` for the session, then award any newly filled slots.
- **`claim_colour_award` RPC** — must now handle two different kinds of award. **Parts are
  pure points** and use the existing conservative predicate. **Crowns additionally require the
  condition**, re-derived server side so a client can never mint one.
- **`recompute_player_total()`** — unchanged.

---

## 9. Surfaces

Every one of these currently imports from `lib/colours.ts`:

| Surface | Change |
|---|---|
| `lib/colours.ts` | Becomes `lib/taniwha.ts`. Single source of truth: the 12 taniwha, the 10 parts, the domain palette, the points map, styling helpers, and the live-alert predicates. |
| `lib/colourAlerts.ts` | Alert predicates extended for crowns. Parts stay predictable from points; a crown needs the live win calculation, which the leaderboard already does client-side. |
| `app/dashboard/page.tsx` | Colours card → **Taniwha card**: the shelf, the taniwha under construction, parts progress, crown condition. Timeline modal shows every part and crown with date and session. Adds the **choose-your-next-taniwha prompt**. |
| `app/leaderboard/page.tsx` | Colour column → parts held + crowned count + the taniwha being built. Sort key changes. The 19-rung key becomes a taniwha key. |
| `app/page.tsx` | Homepage colour list → the taniwha collection. |
| `app/profile/page.tsx` | Badge → crowned count. |
| `app/prs/page.tsx` | **Becomes the win sheet** (§7.4). |
| `app/scoring/[sessionId]/page.tsx` | Live banner, session-end takeover, and the new "a win here takes you to 7 of 12" prompt on the event list. |
| `components/ColourWatchlist.tsx` | `/judge` watchlist: now tracks both "parts away" and "wins away". |
| `components/ColourAlertBanner.tsx` | Live kaiwhakawā alert, extended for crowns. |
| `components/EventIcon.tsx` | `DOMAIN_COLORS` → 10 distinct colours. |
| `app/scoring/page.tsx` | Delete its duplicate `DOMAIN_COLORS` copy, import instead. |
| `__tests__/colours.test.ts`, `colourAlerts.test.ts`, `colourComponents.test.tsx` | Rewritten. |

---

## 10. Art

**Twelve taniwha, each drawn once and sliced into ten layers.** Not 120 drawings. That is
less work than the 120 event icons already shipped.

Spec, matching `public/event-icons/`:

- Transparent PNG, solid silhouette, ~1000×1000 RGBA.
- **All ten parts of a taniwha must be exported on the same canvas with the same
  registration**, so layering aligns without per-part offsets. This is the one constraint that
  cannot be fixed later.
- Rendered as a CSS mask tinted the taniwha's colour, so black Canva exports work on the dark
  theme automatically.
- Suggested path: `public/taniwha/{taniwha-slug}/{part-slug}.png`.
- **A filename must be the exact slug.** A mismatch silently falls back, exactly as it does
  for event icons.

**`public/colour-emblems/` does not exist**, so the current Taniwha and Ngā Taniwha rungs have
been rendering a 404 emblem since session 28. Those two assets are superseded by this work.

---

## 11. Deploy order

**Migration first, then code.** Every schema change here is additive (new columns, new table,
new ladder rows), and the new client code requires `player_taniwha` and
`results.event_placement` to exist. Code-first would mean a dashboard that queries columns
that are not there.

The exception is anything that **renames** a value the deployed bundle reads. If any such
rename appears, it goes last and follows the rule already learned the hard way with event
renames: **ship the code first, then run the rename.**

### Before writing the migration

Per CLAUDE.md's security posture section, and because several Claude sessions work this repo
in parallel from `.claude/worktrees/`:

```bash
git fetch && git log --oneline --all
ls supabase/migrations | cut -c1-14 | sort | uniq -d
supabase migration list
```

Create the file with `supabase migration new`, never by hand. **A duplicate timestamp is
invisible to git and is applied silently as a skip** — it has happened three times in two
weeks in this repo. And **verify the migration by querying the objects it created**, never by
trusting `supabase migration list`.

---

## 12. Risks accepted, knowingly

1. **A player who never wins tops out at one crowned taniwha.** They will hold a long shelf of
   headless ones. This is the direct and intended consequence of requiring both points and
   wins, and it is how a black belt works. Three things soften it: the display leads with
   **parts**, not crowns, so nobody reads as zero anything; the **Whānau crown is a referral**,
   so any player can earn one crowned taniwha; and in three-to-five-player divisions an evenly
   matched player wins about one event in four, so 9 of 12 lands in roughly sixty sessions.
   Only the consistently weakest player in a pool is genuinely locked out.
2. **The first award moves from 500 to 1,000 points**, giving up the deliberately quick first
   colour. See §3.3.
3. **The founding cohort has almost no qualified referrals**, so the opening months look like a
   club full of headless gold taniwha, with the first crowns most players earn being domain
   crowns. Parking handles this correctly. **`/join/[code]` does not exist**, which makes
   referring harder than it needs to be; building it would materially help.
4. **Te Kāhui is ~5 years away** for the most dedicated player, and there is nothing beyond it.
   Martial arts answers this with dan grades. Not decided; not urgent.
5. **Kaha and Kaha Tinana share a word**, as do Manawanui and Manawaroa. Both pairs are
   semantically correct and both were chosen deliberately, but they are the two most likely to
   be confused in speech. Flag them in the reo review.

---

## 13. Open, and blocked

**Blocked on a reo speaker / kaumātua:**

- **The macron on "ō".** Tāne writes *Te Taniwha ō te Whānau*; in this construction the
  possessive particle is usually the unmacronised *o*. This goes onto cards, art, the database
  and everything players say, so settle it before anything ships.
- **The ten domain words.** *Kaha*, *Tere* and *Manawaroa* are solid. *Ngāwari* and *Tika* are
  likely. **Hiko, Manawanui, Mataara and Ruruku are my guesses and should be treated as
  placeholders**, particularly *Ruruku* for Coordination, which I have low confidence in.
- **The ten part names**, including whether *Tikitiki* or *karauna* is right for the crown.
- **Proper taniwha names**, if they are ever gifted (decision 21).

**Blocked on Tāne:**

- **Twelve taniwha designs**, sliced to the spec in §10.
- **Confirming the brown and the black treatments read on a phone in daylight** (§5.1).

**Found while building step 2, and fixed in the same migration (part 8, separable):**

`close_expired_sessions()` has been **failing for every logged-in non-judge caller** since
`20260820000000`. It is granted to anon and authenticated on purpose and is called from
`/leaderboard`, `/dashboard` and the live session timer. It closes the session, which fires
`award_session_points()`, which does `UPDATE results SET placement = …`, which fires
`guard_results_write()` — and SECURITY DEFINER changes the role but not the JWT, so
`auth.uid()` is still the player. The session is by then closed with `points_awarded_at`
stamped, so the guard raises 42501 and **the whole transaction aborts**.

It went unnoticed because the two paths that do work hide it: `/leaderboard` is public, so an
**anon** visitor closes sessions fine (`auth.uid() IS NULL` is the guard's first exemption),
and pg_cron runs the same RPC every five minutes as a superuser with no JWT. The observable
symptom is a console error the live session already logs, plus up to five minutes of delay.
**Remove pg_cron and this becomes the "games never close, nobody is awarded anything"
incident all over again.**

Fixed with a transaction-local `allsport.server_write` flag that the guard honours. A client
cannot set it: PostgREST only populates GUCs under the `request.` prefix and exposes no route
to `set_config`.

**On applying step 2, update CLAUDE.md's `results` schema block** with the two new columns.
That section is explicitly documented as the thing plpgsql triggers are written from, and a
trigger that assigns a field the table does not have raises at runtime.

**Deploy order for steps 2 and 3, verified against production rather than assumed:**

The win layer on `/prs` is loaded by a **separate query** on `player_event_wins`, never by
adding `event_placement` to the existing results select. Probed against prod with the anon key
on 2026-08-25, before the migration:

| Query | Result |
|---|---|
| `player_event_wins` | `PGRST205` returned as an **error object** |
| `results.event_placement` | `42703 column does not exist` |
| `results` existing columns | fine |

So the client is safe to deploy in either order: the missing view surfaces as an `error` that
the page handles by hiding the win layer, whereas folding the column into the main select
would have returned 42703 and **taken the whole page down** — the same silent-drift failure
CLAUDE.md records for `players_public`.

**Three bugs caught by previewing the card with stub data (step 6):**

The card is auth-gated and its tables do not exist yet, so neither Tāne nor I could see it. A
throwaway preview route rendering five hand-built states found all three, and was deleted
after:

1. **Nothing under construction fell back to Whānau**, so a player who had already crowned it
   would see their finished taniwha presented as work in progress. It now shows a neutral
   "Choose your next taniwha" face.
2. **"N parts waiting — choose your next taniwha" could appear while one was half-built.**
   `sync_player_taniwha` tops the builder up before banking, so it cannot happen in practice,
   but the line is now guarded on the builder actually being full.
3. **"The crown is yours" was a lie without crown room.** A crown needs its act AND its points,
   so with the act done and the points slot still ahead it now reads
   "Crown ready — N pts to claim it".

**A conflict between two locked decisions, now resolved**

Decision 17 says the leaderboard sorts on **parts held, lifetime points as tiebreak**.
Decision 27 says `rankings` still drives `/leaderboard`, still **seasonal**, still resetting
each January. Those cannot both be true of the same column: sorting the board on parts held
makes it a lifetime board and removes the annual race a newcomer can win.

The interview question that produced decision 17 asked about rank and the leaderboard in one
breath, and the answer was "rank is parts held, badge is crowned taniwha" — which reads much
more like a statement about what a player's GRADE is than an instruction to re-sort the board.

**RESOLVED by Tāne, 25 August 2026: the sort stays SEASONAL.** Decision 27 wins; decision 17
describes what a player's grade IS, not how the board is ordered. `/leaderboard` remains a
current-season race with taniwha shown as a column, so the annual contest and the lifetime
grade stay two separate numbers, on purpose. Step 7 shipped it that way.

**A bug caught in step 8 by reading my own comment back**

The live wiring passed `alreadyWon: () => false` under a comment explaining that already-banked
events must be excluded. The comment described the intent; the code excluded nothing. A player
on 8 banked wins who won the same event again would have read as 9 and been announced a crown
the server would then refuse. The crown counts DISTINCT events, so the progression now carries
`bankedEventNames` and the check is real.

**Not yet decided, and not blocking:**

- What comes after Te Kāhui.
- Whether `/join/[code]` is built as part of this or separately.

---

## 14. Build order

1. ~~**Palette first.**~~ **DONE.** Ten distinct colours extracted to `lib/domainColours.ts`;
   the two duplicate copies in `app/scoring/page.tsx` and `app/events/page.tsx` deleted.
   Typecheck clean, 291 tests pass, production build clean, `/events` still static, and the
   ten colours verified on screen at tile, chip, bar and text sizes.
2. **`results.event_placement` + `event_field_size`**, trigger, and the history backfill.
   **WRITTEN, NOT APPLIED** — `supabase/migrations/20260824220633_event_placements.sql`.
   Adds the two columns, `division_pool()`, `compute_event_placements()`, a session-close
   trigger, the `player_domain_wins` view (the single definition of the win rule), a partial
   index, and the backfill. Also extends `guard_results_write()` so the two new columns are
   server-authoritative — without that a player could `PATCH` `event_placement = 1` onto
   their own row and buy a permanent crown. **Must be applied from `main`, and its objects
   verified by query**, per the rules in §11.
3. **`/prs` as the win sheet.** **DONE (client side).** A gold `WON` chip on every event the
   player has taken outright, `n/12 WON` on each domain header, and a lifetime total in the
   page header. Reads `player_event_wins`, so the `>= 3` field rule is never reimplemented in
   TypeScript. Domain rollup is derived from `lib/eventData.ts`, NOT from
   `session_events.domain_number`. **Renders nothing until the migration lands**, by design —
   see the deploy-order note below.
4. **`lib/taniwha.ts`** — **DONE.** The pure module: 12 taniwha, 10 parts, the uniform points
   map, crown predicates, live-session predicates, rank label and styling. 32 unit tests in
   `__tests__/taniwha.test.ts`, including the §3.2 invariants and a guard that the module's
   assumption of 12 events per domain still holds against `lib/eventData.ts`. Colours come from
   `lib/domainColours.ts` and the points-economy constants are re-exported from `lib/colours.ts`
   rather than copied, so no drift is possible while both modules exist; a test pins that too.
5. **`player_taniwha`, trigger and RPC extensions.** **WRITTEN, NOT APPLIED** —
   `supabase/migrations/20260824222612_player_taniwha.sql`. `player_taniwha` (no player write
   path at all), `event_domains` (the roster mirrored into SQL), the ladder arithmetic,
   `sync_player_taniwha()`, the `choose_taniwha(domain)` RPC, a third session-close trigger,
   and the backfill. **`colour_awards` is NOT repurposed** — see below.
6. **Dashboard card, choose-and-switch flow, timeline.** **DONE (client side).**
   `components/TaniwhaCard.tsx`: the card (taniwha under construction, nine part segments,
   next part by name, crown condition with progress, crowned count, banked parts), the
   choose/switch picker calling `choose_taniwha`, and `TaniwhaTimeline` for the history modal.
   The dashboard owns the fetch and renders **the Colours card unchanged whenever
   `player_taniwha` does not answer**, so it is safe to deploy before the migrations.
   `player_taniwha.crowned_session_id` was added to 20260824222612 so the timeline can say
   where a crown was earned.

   **Timeline is crowns only, not parts.** `player_taniwha` stores a part COUNT, not a row per
   part, so there is no per-part award log — and 110 entries would be noise next to 11 crowns.
   The colours-era timeline still renders above it from `colour_awards`, which is exactly why
   that table was left untouched.
7. **Leaderboard, homepage, profile.** **DONE (client side).**
   - `/leaderboard`: the Colour column becomes **Taniwha** — crowned count out of 11, plus an
     accent dot and short name for the taniwha being built. Podium tiles and the "how to read
     this board" copy follow. The 19-rung Colour Key becomes a **Taniwha Key** listing all
     twelve. **Every one of these falls back to the colour version** when `player_taniwha` does
     not answer, verified live against production data.
   - `/` homepage: the colour ladder section becomes **COLLECT THE TANIWHA** — all twelve with
     their colours and what crowns each, plus the ten part names in order. Static, so it needs
     no fallback.
   - `/profile`: the badge line reads `4/11 taniwha` instead of a colour name, tinted by the
     taniwha being built, and falls back to the colour name. The privacy data export gained
     `taniwha_progression`.

   **One extra round trip on `/leaderboard`**, querying `player_taniwha` outside
   `leaderboard_page()`. That RPC is already applied to production and this has to work before
   the progression migrations do. **Fold it into the RPC once they are live** — otherwise the
   7-into-1 collapse from the performance pass has quietly become 2.
8. **Kaiwhakawā alert and `/judge` watchlist.** **DONE (client side).**
   `lib/taniwhaAlerts.ts` (pure, 23 tests): `taniwhaAlerts` for the live banner, `provisionalWins`
   for what a player looks like winning today, and `taniwhaWatchlist` for `/judge`.
   `components/TaniwhaAlertBanner.tsx` + `components/TaniwhaWatchlist.tsx`, wired into the
   Kaiwhakawā tab and the Players tab, both falling back to the colour versions when
   `player_taniwha` does not answer. **`claim_taniwha_crown(player, session)` was added to
   20260824222612** — step 5 had no mid-session claim, so the coach had nothing to release.

   **The watchlist leads with the BLOCKER, not with "sessions away."** The colour ladder had one
   axis, so "2 sessions away" said everything. A crown has two, and telling a coach someone is
   two sessions off when they are really four wins short sends them to coach the wrong thing.
   Entries are labelled READY / POINTS / WINS / PARTS and sorted in that order; only the POINTS
   blocker is filtered by distance, because "4 wins away" is actionable however long it takes.

   **A win landing today can never make "earned".** `player_event_wins` is written by the close
   trigger, so a score set right now can still be beaten before the session ends. Banked wins
   only for the strict state; today's provisional wins can reach "on track" and no further.
   `claim_taniwha_crown` re-derives both halves server-side and returns FALSE rather than
   crowning anything the client got ahead of.
9. **Live session: the crown-progress prompt and the session-end takeover.** **DONE (client side).**
   - **Crown hint on the event list.** An event in the domain you are building, that you have
     not already won, carries a gold line: *"A win here takes you to 7 of 9."* Shown on both the
     player's list and the kaiwhakawā's, for whoever is selected. Extracted to `crownHint()` in
     `lib/taniwhaAlerts.ts` with 6 tests — it has four guards and is the headline moment of the
     whole system, so it is not left inline in a 3,000-line component.
   - **Session-end takeover.** A crown card above placement and points, on the day it happens,
     plus a quieter "+2 taniwha parts today" line derived from the session's own points. Both
     fall back to the colour card when `player_taniwha` does not answer, and the two systems
     never both shout: the colour card renders ONLY while the progression tables are absent.
   - The progression load is no longer judge-gated, because the player's own list needs it.
     Both tables are public reads.
10. **Art, as it arrives.** Everything renders with a placeholder until then, the same way the
    event icons did.
