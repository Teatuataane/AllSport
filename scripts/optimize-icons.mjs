// Downscales the PNG mask assets to the size they are actually drawn.
// Run with: node scripts/optimize-icons.mjs   (add --dry to preview)
//
// Every asset here is used as a CSS mask, which reads ONLY the alpha channel —
// so the colour data in an RGBA export is pure waste, and the pixel dimensions
// only need to cover the largest size the asset is ever DRAWN at, not the size
// it was authored at.
//
// Two groups, because they are drawn at very different sizes:
//
//   event-icons / domain-icons — EventIcon draws them into a 26-46px tile at 68%
//     of tile size, so the mask is never wider than ~31 CSS px. Canva exports
//     land at 1000x1000 (~36 KB each, 4.6 MB across 129 events).
//
//   taniwha/<slug>/*.png — TaniwhaFigure draws these at width 150 (dashboard
//     card), 96 (/taniwha) and 74 (history). Authored at 1000x1000 per
//     public/taniwha/README.md, which is right for the artist and ~6.7x more
//     than the screen can use. All eleven pieces of a taniwha load on the
//     dashboard regardless of how many are earned — unearned ones render as a
//     faint ghost, which is the intended design — so the whole set is on the
//     critical path of the page every logged-in player lands on.
//
// TANIWHA SIZING IS NOT ARBITRARY: scripts/check-taniwha-art.mjs rejects a
// canvas under 500px as a mis-export, so 512 is the smallest size that still
// leaves that guard meaningful. It also happens to be the right number — 512
// covers the 150px card at 3.4x DPR.
//
// REGISTRATION: every piece of one taniwha must stay the same canvas or the
// layers stop lining up. Uniform square resize preserves that; do not switch to
// a per-file 'trim' or 'fit: inside'.
//
// IDEMPOTENCY GUARD: a file is "already done" when it is BOTH small enough AND
// already encoded as greyscale/palette. Without a guard, a second run would
// resample already-downscaled art and degrade it a little more each time; this
// is what lets the script live alongside the drop-in-a-PNG workflow in the
// READMEs, since re-running only touches genuinely unprocessed files.
//
// Size ALONE was the guard until the write bug below was found, and it was
// hiding the damage: all 139 event and domain icons were the right dimensions
// but still full RGBA, so they read as "done" while carrying colour channels the
// mask never samples. Checking the encoding too is what lets one re-run repair
// them. Re-encoding an already-correctly-sized file is safe for a mask: there is
// no resampling, and palette quantisation only touches the colour channels,
// which are discarded.
//
// The 1000x1000 originals are recoverable from git history if a larger size is
// ever needed; the real master is the Canva document.
import sharp from 'sharp'
import { readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const GROUPS = [
  {
    label: 'icons',
    dirs: ['public/event-icons', 'public/domain-icons'],
    maxEdge: 160,        // covers a 46px tile at 3x DPR with room to spare
    skipAtOrUnder: 200,  // treat anything this small as already processed
  },
  {
    label: 'taniwha art',
    dirs: ['public/taniwha'],
    recursive: true,     // one folder per taniwha
    maxEdge: 512,        // 150px card at 3.4x DPR; also clears the 500px floor
    skipAtOrUnder: 600,  // must sit above maxEdge or every run re-encodes
  },
]

const DRY = process.argv.includes('--dry')

/** PNGs directly in `dir`, or anywhere beneath it when `recursive`. */
async function pngsIn(dir, recursive) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  const out = []
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (recursive) out.push(...((await pngsIn(p, true)) ?? []))
    } else if (e.name.toLowerCase().endsWith('.png')) {
      out.push(p)
    }
  }
  return out
}

const kb = n => (n / 1024).toFixed(1) + ' KB'
let grandBefore = 0, grandAfter = 0

for (const group of GROUPS) {
  let before = 0, after = 0, done = 0, skipped = 0

  for (const dir of group.dirs) {
    const files = await pngsIn(dir, group.recursive)
    if (files === null) {
      console.log(`(skipping ${dir} — not found)`)
      continue
    }

    for (const p of files) {
      const meta = await sharp(p).metadata()

      // 'b-w' is what sharp reports for greyscale; 'palette' for indexed PNG.
      const alreadyEncoded = meta.space === 'b-w' || meta.paletteBitDepth != null
      if ((meta.width ?? 0) <= group.skipAtOrUnder && alreadyEncoded) {
        skipped++
        continue
      }

      const size = (await stat(p)).size
      const out = await sharp(p)
        .resize(group.maxEdge, group.maxEdge, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        // Only alpha survives into the CSS mask, so drop the colour channels.
        .greyscale()
        .png({ compressionLevel: 9, palette: true, quality: 60 })
        .toBuffer()

      before += size
      after += out.length
      done++

      // Write the ENCODED BUFFER, not sharp(out).toFile(p). Round-tripping it
      // back through sharp decodes the PNG and re-encodes it with DEFAULT
      // options, silently discarding the greyscale + palette settings above —
      // so the files landed as full RGBA while this script reported the size of
      // the buffer it threw away. Measured on the taniwha art: 19.5 KB reported,
      // 88.5 KB actually written.
      if (!DRY) await writeFile(p, out)
    }
  }

  grandBefore += before
  grandAfter += after
  console.log(`${DRY ? '[dry run] ' : ''}${group.label}: optimised ${done}, skipped ${skipped} already-small`)
  if (done) {
    console.log(`  ${kb(before)} -> ${kb(after)}  (${(100 - (100 * after) / before).toFixed(1)}% smaller)`)
    console.log(`  average ${kb(before / done)} -> ${kb(after / done)}`)
  }
}

if (grandBefore) {
  console.log(`\ntotal  ${kb(grandBefore)} -> ${kb(grandAfter)}  (${(100 - (100 * grandAfter) / grandBefore).toFixed(1)}% smaller)`)
}
