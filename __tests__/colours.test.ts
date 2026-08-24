import { describe, it, expect } from 'vitest'
import {
  COLOURS,
  RAINBOW,
  colourByRung,
  colourOnDark,
  colourChipStyle,
} from '@/lib/colours'

// The colour ladder is RETIRED (v0.6.0.0). lib/colours.ts is now a lookup table
// so the dashboard's points-history modal can still render the colours players
// genuinely earned, from colour_awards. These tests pin the historical record
// and the two rendering traps — nothing here computes a current standing any
// more, because nothing should.

describe('the historical record', () => {
  it('still holds all 19 rungs, at their original thresholds', () => {
    expect(COLOURS).toHaveLength(19)
    expect(COLOURS.map(c => c.rung)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1))
    expect(colourByRung(1)?.name).toBe('Mā')
    expect(colourByRung(3)?.threshold).toBe(1_000)
    expect(colourByRung(10)?.name).toBe('Taniwha')
    expect(colourByRung(19)?.name).toBe('Ngā Taniwha')
    expect(colourByRung(19)?.threshold).toBe(100_000)
  })

  it('keeps Kōwhai at the canonical hex', () => {
    // Six inline copies of the ladder once disagreed on this: three had
    // #FFE566. Kept pinned so an archived award still renders the colour the
    // player was actually given.
    expect(colourByRung(5)?.accent).toBe('#F9E051')
  })

  it('has no rung 0 or 20', () => {
    expect(colourByRung(0)).toBeNull()
    expect(colourByRung(20)).toBeNull()
  })

  it('gives every rung a unique name', () => {
    expect(new Set(COLOURS.map(c => c.name)).size).toBe(19)
  })
})

describe('rendering an archived award', () => {
  it('never returns a gradient as a text colour', () => {
    for (const c of COLOURS) expect(colourOnDark(c).startsWith('#')).toBe(true)
    expect(colourByRung(9)?.accent).toBe(RAINBOW)
    expect(colourOnDark(colourByRung(9)!)).toBe('#F9B051')
  })

  it('lifts Mā off pure white, which is too loud on the dark theme', () => {
    expect(colourOnDark(colourByRung(1)!)).toBe('#e8e8e8')
  })

  it('gives the black-card family an accent EDGE so they stay distinguishable', () => {
    const taniwha = colourChipStyle(colourByRung(10)!)
    expect(taniwha.background).toBe('#111111')
    expect(taniwha.border).toBe('2px solid #F9B051')
  })

  it('uses the two-layer clip for a gradient edge, not a plain border', () => {
    // CSS `border` cannot take a gradient and falls back SILENTLY to the first
    // colour. This shipped as a real bug twice.
    const uenuku = colourChipStyle(colourByRung(18)!) // Taniwha Uenuku
    expect(uenuku.border).toBe('2px solid transparent')
    expect(uenuku.backgroundClip).toBe('padding-box, border-box')
  })
})
