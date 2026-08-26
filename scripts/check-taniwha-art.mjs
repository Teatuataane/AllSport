#!/usr/bin/env node
//
// Check a folder of exported taniwha parts, and build a preview of how the app
// will actually stack them.
//
//   node scripts/check-taniwha-art.mjs kaha
//   node scripts/check-taniwha-art.mjs            (checks every folder present)
//
// Why this exists: the one thing that cannot be fixed after export is
// REGISTRATION. If the eleven pieces were cropped individually rather than
// exported on one shared canvas, every file still opens fine on its own and the
// creature only falls apart once the app layers them. This catches that before
// it reaches a player.
//
// No dependencies: PNG width/height/colour-type come straight out of the 25-byte
// IHDR header, and the preview is the same CSS mask the app uses.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'public/taniwha'
const OUT = 'public/taniwha/_preview.html'

// Must match PARTS in lib/taniwha.ts. Part ten is the implement and is named
// for the tool, so it is resolved per taniwha below.
const BODY = ['pane', 'tinana', 'hiku', 'ringa-maui', 'ringa-matau',
              'waewae-maui', 'waewae-matau', 'parirau', 'arero']
const IMPLEMENTS = {
  whanau: 'hands', kaha: 'barbell', 'kaha-tinana': 'rings', hiko: 'javelin',
  tere: 'flag', manawanui: 'ab-wheel', manawaroa: 'oar', ngawari: 'block',
  mataara: 'jump-rope', ruruku: 'racquet', tika: 'bow', kahui: 'taniwha',
}
const ACCENT = {
  whanau: '#F9B051', kaha: '#EA4742', 'kaha-tinana': '#F9B051', hiko: '#F9E051',
  tere: '#4DB26E', manawanui: '#2371BB', manawaroa: '#B87DB5', ngawari: '#F397C0',
  mataara: '#B87333', ruruku: '#F2F2F2', tika: '#8C9199', kahui: '#F9B051',
}

/** width, height and whether the PNG carries an alpha channel. */
function pngInfo(file) {
  const b = readFileSync(file)
  if (b.length < 26 || b.readUInt32BE(0) !== 0x89504e47) return { error: 'not a PNG' }
  const colourType = b[25]
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    // 4 = grey+alpha, 6 = RGBA. 0/2/3 carry no alpha at all.
    hasAlpha: colourType === 4 || colourType === 6,
    colourType,
  }
}

function checkOne(slug) {
  const dir = join(ROOT, slug)
  const parts = [...BODY, IMPLEMENTS[slug] ?? 'taputapu', 'tikitiki']
  const problems = []
  const found = []

  for (const p of parts) {
    const f = join(dir, `${p}.png`)
    if (!existsSync(f)) { problems.push(`missing  ${p}.png`); continue }
    const i = pngInfo(f)
    if (i.error) { problems.push(`${p}.png — ${i.error}`); continue }
    if (!i.hasAlpha) {
      problems.push(`${p}.png — no alpha channel (colour type ${i.colourType}). ` +
        `Canva must download as "PNG · transparent background", or the whole square tints solid.`)
    }
    found.push({ part: p, ...i })
  }

  // Registration: every piece must be the same canvas.
  const sizes = new Set(found.map(f => `${f.width}x${f.height}`))
  if (sizes.size > 1) {
    problems.push(
      `REGISTRATION BROKEN — the pieces are not all the same size: ${[...sizes].join(', ')}. ` +
      `They were cropped individually instead of exported from one shared canvas, so they ` +
      `will not layer. Re-export with every page the same dimensions and nothing moved.`)
    for (const f of found) problems.push(`    ${f.part}.png  ${f.width}x${f.height}`)
  }
  const [only] = [...sizes]
  if (sizes.size === 1 && only) {
    const [w, h] = only.split('x').map(Number)
    if (w !== h) problems.push(`canvas is ${w}x${h}, not square — the app draws these in a square tile`)
    if (w < 500) problems.push(`canvas is only ${w}px — export at 1000x1000 or larger`)
  }

  return { slug, parts, found, problems, size: only ?? null }
}

const slugs = process.argv[2]
  ? [process.argv[2]]
  : (existsSync(ROOT) ? readdirSync(ROOT).filter(d => !d.startsWith('_') && !d.includes('.')) : [])

if (slugs.length === 0) {
  console.log(`No taniwha folders found under ${ROOT}/.`)
  console.log(`Expected e.g. ${ROOT}/kaha/pane.png … tikitiki.png`)
  process.exit(1)
}

let bad = 0
const results = []
for (const slug of slugs) {
  const r = checkOne(slug)
  results.push(r)
  const ok = r.problems.length === 0
  if (!ok) bad++
  console.log(`\n${ok ? 'OK  ' : 'FAIL'}  ${slug}  ${r.found.length}/${r.parts.length} pieces` +
              (r.size ? `  ${r.size}` : ''))
  for (const p of r.problems) console.log(`      ${p}`)
}

// ── Preview: the cumulative stack, exactly as the app renders it ──
mkdirSync(ROOT, { recursive: true })
const cards = results.filter(r => r.found.length > 0).map(r => {
  const accent = ACCENT[r.slug] ?? '#F9B051'
  const steps = r.parts.map((_, i) => {
    const layers = r.parts.slice(0, i + 1)
      .filter(p => r.found.some(f => f.part === p))
      .map(p => `<i style="-webkit-mask-image:url(${r.slug}/${p}.png);mask-image:url(${r.slug}/${p}.png)"></i>`)
      .join('')
    return `<figure><div class="t" style="--a:${accent}">${layers}</div><figcaption>${i + 1}</figcaption></figure>`
  }).join('')
  return `<h2>${r.slug}</h2><div class="row">${steps}</div>`
}).join('')

writeFileSync(OUT, `<!doctype html><meta charset="utf-8"><title>Taniwha art check</title>
<style>
 body{background:#0a0a0a;color:#eee;font:14px/1.5 system-ui;padding:28px}
 h1{font-size:20px} h2{font-size:15px;color:#888;margin:28px 0 8px;font-weight:600}
 .row{display:flex;flex-wrap:wrap;gap:10px}
 figure{margin:0;text-align:center}
 .t{width:104px;height:104px;border:1px solid #1e1e1e;border-radius:12px;background:#111;position:relative}
 .t i{position:absolute;inset:8%;background:var(--a);
      -webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
      -webkit-mask-position:center;mask-position:center}
 figcaption{color:#555;font-size:11px;margin-top:4px}
</style>
<h1>Taniwha art check</h1>
<p style="color:#888;max-width:60ch">Each row is one taniwha assembling, one piece at a time,
tinted and masked exactly as the app does it. If a piece jumps, shifts or changes scale between
frames, the export was cropped per-piece instead of shared-canvas — re-export before drawing
anything else.</p>
${cards}`)

console.log(`\nPreview written to ${OUT}`)
console.log(`Open it: open ${OUT}`)
process.exit(bad > 0 ? 1 : 0)
