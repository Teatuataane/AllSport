// Downscales the event/domain icon PNGs to the size they are actually drawn.
// Run with: node scripts/optimize-icons.mjs   (add --dry to preview)
//
// Canva exports land here at 1000x1000 (~36 KB each, 4.6 MB across 129 events),
// but EventIcon draws them into a 26-46px tile at 68% of tile size, so the mask
// is never wider than ~31 CSS px — under 100px even on a 3x phone. They are also
// used as CSS masks, which read ONLY the alpha channel, so the colour data in an
// RGBA export is pure waste.
//
// IDEMPOTENCY GUARD: files already at or below MAX_EDGE are skipped. Without it,
// a second run would re-encode already-lossy output and degrade the icons a
// little more each time. This is why the script can live alongside the
// drop-in-a-PNG workflow in public/event-icons/README.md: re-running it only
// touches newly added full-size exports.
//
// The 1000x1000 originals are recoverable from git history if a larger size is
// ever needed; the real master is the Canva document.
import sharp from 'sharp'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const DIRS = ['public/event-icons', 'public/domain-icons']
const MAX_EDGE = 160        // covers a 46px tile at 3x DPR with room to spare
const SKIP_AT_OR_UNDER = 200 // treat anything this small as already processed
const DRY = process.argv.includes('--dry')

let before = 0, after = 0, done = 0, skipped = 0

for (const dir of DIRS) {
  let files
  try {
    files = (await readdir(dir)).filter(f => f.toLowerCase().endsWith('.png'))
  } catch {
    console.log(`(skipping ${dir} — not found)`)
    continue
  }

  for (const file of files.sort()) {
    const p = path.join(dir, file)
    const meta = await sharp(p).metadata()

    if ((meta.width ?? 0) <= SKIP_AT_OR_UNDER) {
      skipped++
      continue
    }

    const size = (await stat(p)).size
    const out = await sharp(p)
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      // Only alpha survives into the CSS mask, so drop the colour channels.
      .greyscale()
      .png({ compressionLevel: 9, palette: true, quality: 60 })
      .toBuffer()

    before += size
    after += out.length
    done++

    if (!DRY) await sharp(out).toFile(p)
  }
}

const kb = n => (n / 1024).toFixed(1) + ' KB'
console.log(`${DRY ? '[dry run] ' : ''}optimised ${done} icons, skipped ${skipped} already-small`)
if (done) {
  console.log(`  ${kb(before)} -> ${kb(after)}  (${(100 - (100 * after) / before).toFixed(1)}% smaller)`)
  console.log(`  average ${kb(before / done)} -> ${kb(after / done)}`)
}
