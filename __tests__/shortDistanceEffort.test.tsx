// @vitest-environment jsdom
//
// ── A distance effort too short to estimate from, logged as training ────────
// Since 5 Oct 2026 an open distance event ranks the time an effort predicts
// over its reference distance. On 8 Oct 2026 (v0.30.0.1) anything under the
// reference was kept as training with no raw_score; since 9 Oct 2026 an effort
// from a quarter of the reference up ranks on its estimate, below every full
// effort (distanceEstimate.test.ts), and only what is shorter than that quarter
// is training. A workout entry keeps it; an official result refuses it.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import QuickEntrySheet from '@/components/play/QuickEntrySheet'
import { getEventBySlug, EVENTS } from '@/lib/eventData'
import { EMPTY_VALS, computeScoreVals, shortDistanceEffort, type EntryVals } from '@/lib/scoring'
import { entryPayload } from '@/lib/personalGame'
import { scoreRung } from '@/lib/scoreColour'
import type { GradePlayer } from '@/lib/playerGrades'
import type { PlayEvent } from '@/components/play/chrome'

afterEach(cleanup)

const ev = (slug: string) => getEventBySlug(slug)!
const vals = (p: Partial<EntryVals>): EntryVals => ({ ...EMPTY_VALS, ...p })
const row500 = vals({ distanceVal: '500', distanceUnit: 'm', timeMins: '1', timeSecs: '47' })
const row200 = vals({ distanceVal: '200', distanceUnit: 'm', timeMins: '0', timeSecs: '40' })

// Every open distance event: Running, Cycling, Ski Erg, Row Erg, Scooting, Animal Crawl.
const OPEN_DISTANCE = EVENTS.filter(e => e.inputMode === 'distance+time')

describe('shortDistanceEffort', () => {
  it('covers every open distance event, each with a reference distance', () => {
    expect(OPEN_DISTANCE.length).toBeGreaterThanOrEqual(6)
    for (const e of OPEN_DISTANCE) expect(e.referenceMetres).toBeGreaterThan(0)
  })

  it('is what a short effort becomes on every open distance event, which does not score', () => {
    for (const e of OPEN_DISTANCE) {
      const ref = e.referenceMetres!
      const v = vals({
        distanceVal: String(ref / 5), distanceUnit: 'm', timeMins: '0', timeSecs: '30',
        difficultyTier: e.difficultyTiers?.[0]?.name ?? '',
      })
      expect(computeScoreVals(e.inputMode, e, v), e.slug).toBeNull()
      const short = shortDistanceEffort(e.inputMode, e, v)
      expect(short, e.slug).not.toBeNull()
      expect(short!.distance_m).toBe(ref / 5)
      expect(short!.time_seconds).toBe(30)
    }
  })

  it('labels a 200m row as training, and leaves a 500m row to rank on its estimate', () => {
    expect(shortDistanceEffort('distance+time', ev('row-erg'), row200)?.score_label).toBe('200m · 0:40 · training')
    expect(shortDistanceEffort('distance+time', ev('row-erg'), row500)).toBeNull()
    expect(computeScoreVals('distance+time', ev('row-erg'), row500)?.score_label).toBe('500m · 1:47 · est. 1km 3:43')
  })

  it('is null once the effort is long enough to rank, or before it is complete', () => {
    const e = ev('row-erg')
    expect(shortDistanceEffort('distance+time', e, vals({ distanceVal: '1000', timeMins: '3', timeSecs: '40' }))).toBeNull()
    expect(shortDistanceEffort('distance+time', e, vals({ distanceVal: '200' }))).toBeNull()
    expect(shortDistanceEffort('distance+time', e, vals({ timeMins: '1' }))).toBeNull()
  })

  it('still needs a level on Animal Crawl', () => {
    const v = vals({ distanceVal: '10', timeMins: '0', timeSecs: '8' })
    expect(shortDistanceEffort('distance+time', ev('animal-crawl'), v)).toBeNull()
    expect(shortDistanceEffort('distance+time', ev('animal-crawl'), { ...v, difficultyTier: 'Bear Crawl' })?.difficulty_tier)
      .toBe('Bear Crawl')
  })
})

describe('entryPayload for a short distance effort', () => {
  it('writes what was done with raw_score null, so it never grades and an edit clears an old score', () => {
    expect(entryPayload(ev('row-erg'), row200)).toEqual({
      activity: 'Row Erg', event_slug: 'row-erg',
      raw_score: null, score_label: '200m · 0:40 · training',
      difficulty_tier: null, exercise_variation: null, weight_kg: null, reps: null,
      time_seconds: 40, distance_m: 200,
    })
  })

  it('earns no colour, even read back as raw 0 the way the play screens hold it', () => {
    const player: GradePlayer = { division: "Men's", ageYears: 30, gender: null }
    expect(scoreRung(ev('row-erg'), [{ raw_score: 0, weight_kg: null, difficulty_tier: null }], player, 80)).toBe(0)
  })
})

describe('the quick-entry sheet', () => {
  const asPlayEvent = (slug: string): PlayEvent => {
    const e = ev(slug)
    return { id: e.slug, domain_number: e.domainNumber, domain_name: e.domain, event_name: e.name, event_slug: e.slug, input_mode: e.inputMode }
  }
  const renderSheet = (natural: boolean, metres = '500', secs = '47') => {
    const onSubmit = vi.fn(async () => ({ error: null, isPR: false }))
    render(<QuickEntrySheet se={asPlayEvent('row-erg')} eventData={ev('row-erg')} myResults={[]} opponents={[]}
      seasonPR={null} locked={false} allowGames={false} natural={natural}
      onClose={vi.fn()} onSubmit={onSubmit} onDelete={vi.fn(async () => null)} onSubmitted={vi.fn()} onDeleted={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Distance'), { target: { value: metres } })
    fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: secs === '47' ? '1' : '0' } })
    fireEvent.change(screen.getByPlaceholderText('sec'), { target: { value: secs } })
    return onSubmit
  }

  it('scores a 500m row on its estimate, in a personal session and an official game alike', () => {
    for (const natural of [true, false]) {
      const onSubmit = renderSheet(natural)
      const submit = screen.getByRole('button', { name: /^Submit — 500m · 1:47 · est\. 1km 3:43$/ }) as HTMLButtonElement
      expect(submit.disabled).toBe(false)
      expect(screen.getByText(/ranks as 1km 3:43, below every full 1km\. Colours need the full 1km\./)).toBeTruthy()
      fireEvent.click(submit)
      expect(onSubmit).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it('keeps a 200m row as training in a personal session, and refuses it as an official result', () => {
    renderSheet(true, '200', '40')
    expect((screen.getByRole('button', { name: /^Submit — 200m · 0:40 · training$/ }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/Under 250m, too short to estimate a 1km time/)).toBeTruthy()
    cleanup()
    renderSheet(false, '200', '40')
    expect((screen.getByRole('button', { name: 'Enter your score' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/At least 250m to count/)).toBeTruthy()
  })
})
