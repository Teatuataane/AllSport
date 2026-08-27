import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ── The invariants every CSS-mask asset must hold ────────────────────────────
// REGRESSION TEST. scripts/optimize-icons.mjs built an optimised buffer and then
// wrote it with `sharp(out).toFile(p)`, which decodes the PNG and re-encodes it
// with DEFAULT options — silently discarding the greyscale + palette settings.
// It reported 19.5 KB while writing 88.5 KB, and all 139 event and domain icons
// sat on disk as full RGBA while the script said they were done. Its idempotency
// guard tested SIZE ALONE, so a re-run skipped them and the damage stayed.
//
// Nothing caught it. The app rendered correctly the whole time, because a CSS
// mask reads only the alpha channel and RGBA carries a valid one — the cost was
// invisible bytes, which is exactly the kind of defect a test has to hold, since
// no page will ever look wrong.
//
// These assertions encode the invariant rather than the implementation: whatever
// tool produces these files, the shipped result must be small, alpha-bearing and
// correctly registered.

type PngInfo = { width: number; height: number; colourType: number; hasTrns: boolean }

function pngInfo(file: string): PngInfo {
  const b = readFileSync(file)
  if (b.length < 26 || b.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`not a PNG: ${file}`)
  }
  // Walk the chunk table looking for tRNS — a palette PNG carries its
  // transparency there rather than in a per-pixel alpha channel.
  let hasTrns = false
  let i = 8
  while (i + 8 <= b.length) {
    const len = b.readUInt32BE(i)
    if (b.toString('ascii', i + 4, i + 8) === 'tRNS') { hasTrns = true; break }
    i += 12 + len
  }
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    colourType: b[25],
    hasTrns,
  }
}

/** Colour types 4 (grey+alpha) and 6 (RGBA) carry alpha; 3 (palette) needs tRNS. */
function isTransparent(i: PngInfo): boolean {
  return i.colourType === 4 || i.colourType === 6 || (i.colourType === 3 && i.hasTrns)
}

function pngsIn(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.toLowerCase().endsWith('.png')).sort()
}

const ICON_DIRS = ['public/event-icons', 'public/domain-icons']
const ICON_MAX_EDGE = 160    // EventIcon never draws wider than ~31 CSS px
const TANIWHA_ROOT = 'public/taniwha'
const TANIWHA_MAX_EDGE = 512 // 150px card at 3.4x DPR; also clears the 500px floor

describe('event and domain icon masks', () => {
  const files = ICON_DIRS.flatMap(d => pngsIn(d).map(f => join(d, f)))

  it('finds the icon set on disk', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('is never full RGBA — the colour channels are never sampled by a mask', () => {
    // THIS is the assertion that would have caught the write-buffer bug.
    const rgba = files.filter(f => pngInfo(f).colourType === 6)
    expect(rgba, `${rgba.length} icons still RGBA, e.g. ${rgba.slice(0, 3).join(', ')}`).toEqual([])
  })

  it('always carries transparency, or the tile tints as a solid square', () => {
    const opaque = files.filter(f => !isTransparent(pngInfo(f)))
    expect(opaque, `opaque icons: ${opaque.slice(0, 3).join(', ')}`).toEqual([])
  })

  it(`is no wider than ${ICON_MAX_EDGE}px`, () => {
    const tooBig = files.filter(f => pngInfo(f).width > ICON_MAX_EDGE)
    expect(tooBig, `oversized: ${tooBig.slice(0, 3).join(', ')}`).toEqual([])
  })
})

describe('taniwha art masks', () => {
  const taniwhaDirs = existsSync(TANIWHA_ROOT)
    ? readdirSync(TANIWHA_ROOT)
        .map(d => join(TANIWHA_ROOT, d))
        .filter(d => statSync(d).isDirectory() && pngsIn(d).length > 0)
    : []

  it('finds at least one drawn taniwha', () => {
    expect(taniwhaDirs.length).toBeGreaterThan(0)
  })

  for (const dir of taniwhaDirs) {
    describe(dir, () => {
      const files = pngsIn(dir).map(f => join(dir, f))

      it('keeps every piece on ONE shared canvas — registration', () => {
        // The pieces are layered on top of each other at identical size. If they
        // are not all the same dimensions they were cropped individually and the
        // creature comes apart. This is the one thing that cannot be fixed later.
        const sizes = new Set(files.map(f => { const i = pngInfo(f); return `${i.width}x${i.height}` }))
        expect([...sizes], `mismatched canvases in ${dir}`).toHaveLength(1)
      })

      it('is square', () => {
        for (const f of files) {
          const i = pngInfo(f)
          expect(i.width, f).toBe(i.height)
        }
      })

      it(`is no wider than ${TANIWHA_MAX_EDGE}px`, () => {
        const tooBig = files.filter(f => pngInfo(f).width > TANIWHA_MAX_EDGE)
        expect(tooBig, `oversized: ${tooBig.join(', ')}`).toEqual([])
      })

      it('stays at or above the 500px mis-export floor check-taniwha-art enforces', () => {
        // Below 500 the art checker rejects the folder as a bad export, so the
        // optimiser must never downscale past it.
        const tooSmall = files.filter(f => pngInfo(f).width < 500)
        expect(tooSmall, `undersized: ${tooSmall.join(', ')}`).toEqual([])
      })

      it('carries transparency on every piece', () => {
        const opaque = files.filter(f => !isTransparent(pngInfo(f)))
        expect(opaque, `opaque pieces: ${opaque.join(', ')}`).toEqual([])
      })

      it('is never full RGBA', () => {
        const rgba = files.filter(f => pngInfo(f).colourType === 6)
        expect(rgba, `RGBA pieces: ${rgba.join(', ')}`).toEqual([])
      })
    })
  }
})
