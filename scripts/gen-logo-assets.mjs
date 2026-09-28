// Regenerates the derived logo assets from the full-resolution master
// (public/logo.png, 3666x2204). Run with: node scripts/gen-logo-assets.mjs
//
// The master is kept as the design source of truth and is no longer served to
// browsers: at 763 KB it was 72% of the homepage payload and the LCP element.
import sharp from 'sharp'

const SRC = 'public/logo.png'

const meta = await sharp(SRC).metadata()
console.log(`source: ${meta.width}x${meta.height} ${meta.format} alpha=${meta.hasAlpha}`)

// Hero: displayed at max 440px CSS width, so 440w serves 1x and 880w serves 2x.
// Both are offered via srcset so phones never pull the retina copy.
await sharp(SRC).resize({ width: 440 }).webp({ quality: 78, effort: 6 }).toFile('public/logo-hero-440.webp')
await sharp(SRC).resize({ width: 880 }).webp({ quality: 78, effort: 6 }).toFile('public/logo-hero-880.webp')

// Wordmark used by the navbar (38px tall), footer (34px) and /play (80px).
// 160px tall covers all three at 2x DPR, and is shared/cached across every page.
await sharp(SRC).resize({ height: 160 }).webp({ quality: 82, effort: 6 }).toFile('public/logo-mark.webp')

// Favicons. Metadata icons are not run through any optimiser, so these need to
// be correctly sized at rest. Palette quantisation roughly halves the 180px one.
//
// Tab icons use the colour swirl from the centre of the logo, cropped square
// (Tāne, 28 Sept 2026). The whole wide logo squeezed into 16-32px was a grey
// smudge; the swirl stays bright and legible at that size.
const SWIRL = { left: 1330, top: 300, width: 1000, height: 1000 }
const swirl = () => sharp(SRC).extract(SWIRL)
await swirl().resize(32, 32)
  .png({ compressionLevel: 9, palette: true }).toFile('public/favicon-32.png')
// iOS paints a transparent home-screen icon black anyway, so flatten it on black.
await swirl().resize(180, 180).flatten({ background: '#000000' })
  .png({ compressionLevel: 9, palette: true, quality: 90 }).toFile('public/apple-touch-icon.png')

// app/favicon.ico. Browsers (Safari especially) request /favicon.ico whatever
// the metadata says, and Next serves app/favicon.ico there. It was still the
// create-next-app default, which is the Vercel triangle. PNG-in-ICO, 16/32/48.
const sizes = [16, 32, 48]
const pngs = await Promise.all(sizes.map(s =>
  swirl().resize(s, s).png().toBuffer()))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((s, i) => {
  const e = 6 + 16 * i
  header.writeUInt8(s, e); header.writeUInt8(s, e + 1)
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6)
  header.writeUInt32LE(pngs[i].length, e + 8); header.writeUInt32LE(offset, e + 12)
  offset += pngs[i].length
})
const { writeFile } = await import('node:fs/promises')
await writeFile('app/favicon.ico', Buffer.concat([header, ...pngs]))

console.log('done')
