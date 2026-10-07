// @vitest-environment jsdom
//
// ── A distance effort shorter than the reference, logged as training ────────
// Since 5 Oct 2026 an open distance event ranks the time an effort predicts
// over its reference distance, and Riegel only shortens, so a 500m row on the
// 1000m Row Erg predicts nothing. The sheet refused it outright, which left a
// personal training session with no way to record an interval at all: Submit
// never lit up (reported 8 Oct 2026). A workout entry now keeps it as training,
// with no raw_score; an official result still needs the full distance.

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
        distanceVal: String(ref / 2), distanceUnit: 'm', timeMins: '0', timeSecs: '30',
        difficultyTier: e.difficultyTiers?.[0]?.name ?? '',
      })
      expect(computeScoreVals(e.inputMode, e, v), e.slug).toBeNull()
      const short = shortDistanceEffort(e.inputMode, e, v)
      expect(short, e.slug).not.toBeNull()
      expect(short!.distance_m).toBe(ref / 2)
      expect(short!.time_seconds).toBe(30)
    }
  })

  it('labels a 500m row as training', () => {
    expect(shortDistanceEffort('distance+time', ev('row-erg'), row500)?.score_label).toBe('500m · 1:47 · training')
  })

  it('is null once the effort is long enough to rank, or before it is complete', () => {
    const e = ev('row-erg')
    expect(shortDistanceEffort('distance+time', e, vals({ distanceVal: '1000', timeMins: '3', timeSecs: '40' }))).toBeNull()
    expect(shortDistanceEffort('distance+time', e, vals({ distanceVal: '500' }))).toBeNull()
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
    expect(entryPayload(ev('row-erg'), row500)).toEqual({
      activity: 'Row Erg', event_slug: 'row-erg',
      raw_score: null, score_label: '500m · 1:47 · training',
      difficulty_tier: null, exercise_variation: null, weight_kg: null, reps: null,
      time_seconds: 107, distance_m: 500,
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
  const renderSheet = (natural: boolean) => {
    const onSubmit = vi.fn(async () => ({ error: null, isPR: false }))
    render(<QuickEntrySheet se={asPlayEvent('row-erg')} eventData={ev('row-erg')} myResults={[]} opponents={[]}
      seasonPR={null} locked={false} allowGames={false} natural={natural}
      onClose={vi.fn()} onSubmit={onSubmit} onDelete={vi.fn(async () => null)} onSubmitted={vi.fn()} onDeleted={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '500' } })
    fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '1' } })
    fireEvent.change(screen.getByPlaceholderText('sec'), { target: { value: '47' } })
    return onSubmit
  }

  it('lets a 500m row be submitted in a personal session, and says it does not rank', () => {
    const onSubmit = renderSheet(true)
    const submit = screen.getByRole('button', { name: /^Submit — 500m · 1:47 · training$/ }) as HTMLButtonElement
    expect(submit.disabled).toBe(false)
    expect(screen.getByText(/saved as training and does not rank/)).toBeTruthy()
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('still refuses it as an official game result', () => {
    renderSheet(false)
    expect((screen.getByRole('button', { name: 'Enter your score' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/At least 1km to count/)).toBeTruthy()
  })
})
