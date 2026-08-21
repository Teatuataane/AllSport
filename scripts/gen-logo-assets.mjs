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
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
await sharp(SRC).resize({ width: 32, height: 32, fit: 'contain', background: transparent })
  .png({ compressionLevel: 9, palette: true }).toFile('public/favicon-32.png')
await sharp(SRC).resize({ width: 180, height: 180, fit: 'contain', background: transparent })
  .png({ compressionLevel: 9, palette: true, quality: 90 }).toFile('public/apple-touch-icon.png')

console.log('done')
