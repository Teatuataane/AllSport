# Taniwha artwork

One folder per taniwha, named by its **slug** — lowercase, no spaces, no macrons.
These are URL paths: `Te Taniwha o te Whānau/` does not resolve and the card
draws nothing, silently.

```
whanau  kaha  kaha-tinana  hiko  tere  manawanui
manawaroa  ngawari  mataara  ruruku  tika  kahui
```

Eleven files inside each, in assembly order:

```
pane  tinana  hiku  ringa-maui  ringa-matau
waewae-maui  waewae-matau  parirau  arero  tikitiki
```

Plus part ten, the implement, named for the tool itself and different for every
taniwha — `hands`, `barbell`, `rings`, `javelin`, `flag`, `ab-wheel`, `oar`,
`block`, `jump-rope`, `racquet`, `bow`, `taniwha`. See `Taniwha.implement` in
`lib/taniwha.ts`.

## Rules

- **1000 × 1000, transparent, flat and fully opaque.** The app uses these as a
  CSS mask: it reads only the alpha channel and fills the shape with the domain
  colour, so the colour you draw in is irrelevant, but shading and soft edges
  come through as partly-tinted.
- **Every piece on the SAME canvas with the SAME registration.** This is the one
  thing that cannot be fixed later. Export by duplicating the finished page once
  per piece and DELETING everything else — never move, resize or re-centre.
- **Draw big.** A piece is scaled with the whole 1000px square, so its size on
  screen is its size on that canvas. Anything under about 150px across becomes a
  2px smudge at the 24px the leaderboard renders at.

## After importing: shrink them

```
node scripts/optimize-icons.mjs        # --dry to preview
```

**Export at 1000 × 1000 anyway** — that is the authoring size and the rules above
still stand. This script then downscales what ships to **512 × 512** greyscale,
because the app never draws a taniwha wider than 150 CSS px (the dashboard card;
/taniwha uses 96 and the history page 74), and a CSS mask reads only the alpha
channel, so the colour data is waste. Measured on Whānau: **201.5 KB → 19.5 KB,
90% smaller**, with the difference confined to anti-aliased edge pixels.

So the files you find in these folders are 512 px even though the spec says 1000.
That is expected. Re-running the script skips anything already small, so it will
not re-encode and degrade existing art — but the 1000 px originals live in git
history, and the real master is the Canva document.

512 is also the floor: `check-taniwha-art.mjs` rejects a canvas under 500 px as a
mis-export, and that guard is worth keeping.

## Check before drawing the next one

```
node scripts/check-taniwha-art.mjs whanau
open public/taniwha/_preview.html
```

The preview shows the taniwha assembling one piece at a time, masked and tinted
exactly as the app does it. A piece that jumps or changes scale between frames
means the export was cropped per-piece.

Full method, briefs and implement table: `TANIWHA_ART_PROMPT.md`.
