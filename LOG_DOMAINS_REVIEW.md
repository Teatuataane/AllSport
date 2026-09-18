# Log-only domains: review sheet (DRAFT, awaiting Tāne)

Six domains for activities that can't run in a 100-minute session. They exist so
that **anything a player does can be logged and fitted**, not for the draw.

## What stays the same

- The competition is still **ten domains, 120 events, one drawn per domain**.
  None of these events can be drawn, voted on, or appear on a public leaderboard.
- Your **overall colour stays the lowest of the ten**. A log-only domain earns its
  own colour, shown in a separate "Beyond the ten" row on /grades, and never
  lowers the headline colour.
- A log-only event **graduates** into the draw only by a roster change you make,
  for example once a partner club can host it.

## Decisions for you

Tick or change each one.

1. **The six domains and their names.** Water · Combat · Glide & Roll · Vertical ·
   Rhythm & Expression · Restoration. Te reo names too, or English only like the
   first ten?
2. **Colours at launch: training only.** Units count toward a log-only domain from
   day one. Its colour also needs standards, which would be a later sheet (like
   GRADING_STANDARDS_REVIEW.md). Until then a log-only domain shows units but no
   colour. OK?
3. **A new unit rule: minutes.** Dance, yoga and similar have no sets, holds or
   distance. Proposed: **one unit = 30 minutes**.
4. **Mountain biking moves off Cycling.** It is aliased to Cycling today. Under
   this sheet it becomes its own event in Glide & Roll. Rides already logged as
   Cycling stay as Cycling (no history is rewritten).
5. **Surfing sits in Water, not Glide & Roll.** Either works; Water is where most
   people would look for it.

## The events (draft, 31)

Mode names match lib/eventData.ts. "Ladder" is D1 → top. "Unit" is what one unit is.

### 11 · Water

| Event | Mode | Ladder | Best effort | Unit |
|---|---|---|---|---|
| Swimming | difficulty+time, timed | 50m / 100m / 200m / 400m / 800m / 1500m | Fastest time at a distance | 100m |
| Open Water Swim | difficulty+time, timed | 250m / 500m / 1km / 2km / 3.8km | Fastest time | 250m |
| Surfing | reps | none | Waves ridden in a session | 30 min |
| Paddling | difficulty+time, timed | 250m / 500m / 1km / 2km / 5km | Fastest time (kayak, waka ama, SUP) | 500m |
| Water Polo | sport | none | Game | 1 game |

### 12 · Combat

| Event | Mode | Ladder | Best effort | Unit |
|---|---|---|---|---|
| Boxing | difficulty+reps | Pads / Bag / Sparring / Game | Rounds completed | 1 round |
| Kickboxing | difficulty+reps | Pads / Bag / Sparring / Game | Rounds completed | 1 round |
| Brazilian Jiu-Jitsu | difficulty+reps | Drilling / Positional / Rolling / Game | Rounds completed | 1 round |
| Judo | difficulty+reps | Drilling / Randori / Game | Rounds completed | 1 round |
| Karate | difficulty+reps | Kata / Kumite / Game | Rounds or kata completed | 1 round |

"Game" is a real bout, recorded as a win, draw or loss like other Game rungs.

### 13 · Glide & Roll

| Event | Mode | Ladder | Best effort | Unit |
|---|---|---|---|---|
| Mountain Biking | difficulty+time, timed | Green / Blue / Black trail | Fastest run | 1km |
| Skiing | reps | Green / Blue / Black / Double Black | Runs completed | 1 run |
| Snowboarding | reps | Green / Blue / Black / Double Black | Runs completed | 1 run |
| Inline Skating | difficulty+time, timed | 1km / 5km / 10km | Fastest time | 1km |
| Ice Skating | minutes | none | none | 30 min |

### 14 · Vertical

| Event | Mode | Ladder | Best effort | Unit |
|---|---|---|---|---|
| Bouldering | difficulty+reps | V0 through V10 | Hardest grade sent, sends at it | 1 problem |
| Sport Climbing | difficulty+reps | NZ grades 12 through 30 | Hardest grade sent | 1 route |
| Top Rope | difficulty+reps | NZ grades 12 through 26 | Hardest grade sent | 1 route |
| Parkour | minutes | none | none | 30 min |
| Stair Climb | difficulty+time, timed | 10 / 20 / 50 / 100 floors | Fastest time | 10 floors |

Climbing grades are the ladder, so the hardest grade you send IS the score, the
same way difficulty works on Calisthenics.

### 15 · Rhythm & Expression

| Event | Mode | Ladder | Best effort | Unit |
|---|---|---|---|---|
| Dance | minutes | none | none | 30 min |
| Kapa Haka | minutes | none | none | 30 min |
| Cheer | minutes | none | none | 30 min |
| Aerobics Class | minutes | none | none | 30 min (Zumba, step, etc.) |
| Aerial & Pole | minutes | none | none | 30 min |

These are judged arts, not measured ones, so they log training only.

### 16 · Restoration

| Event | Mode | Ladder | Best effort | Unit |
|---|---|---|---|---|
| Walking | distance | none | none | 2km |
| Tramping | distance | none | none | 5km |
| Yoga | minutes | none | none | 30 min |
| Pilates | minutes | none | none | 30 min |
| Mobility | minutes | none | none | 30 min |
| Breathwork | minutes | none | none | 15 min |

Proposed: Restoration never earns a colour, whatever decision 2 says: a colour for resting
would reward the wrong thing. Its units still count toward weekly minutes.

## Aliases that come with it

swim, swimming, laps, pool → Swimming · ocean swim → Open Water Swim · surf → Surfing ·
kayak, kayaking, waka ama, sup, paddleboarding → Paddling · boxing class, sparring → Boxing ·
muay thai → Kickboxing · bjj, jiu jitsu, grappling → Brazilian Jiu-Jitsu · mtb, mountain bike →
Mountain Biking (moved from Cycling) · ski → Skiing · snowboard → Snowboarding · rollerblading →
Inline Skating · climbing gym, bouldering, boulder → Bouldering · lead climbing → Sport Climbing ·
stairs → Stair Climb · dancing, zumba → Dance / Aerobics Class · walk, hike → Walking ·
tramp → Tramping · stretching → Mobility.

## How it gets built, once approved

This sheet compiles into a separate `LOG_EVENTS` list beside the 120, the way the
difficulty and standards sheets compile. Keeping them apart is deliberate: the
session draw, voting, the radar and the leaderboard all assume exactly ten domains,
and none of them should ever see these.
