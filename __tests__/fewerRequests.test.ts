// @vitest-environment jsdom
// v0.58.0.0: HOME and the leaderboard stop downloading every result in the
// database, and the match read is shared for a minute in the browser.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { bestEventByColour } from '@/lib/colourDisplay'
import { loadMatchesChecked } from '@/lib/loadGrades'
import { forgetLoadedMatches } from '@/lib/matchesShared'
import { getEventByName } from '@/lib/eventData'

const src = (p: string) => readFileSync(p, 'utf8')
const code = (p: string) => src(p).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('no page downloads every result for a tie-break', () => {
  it('HOME does not read stats_bundle', () => {
    expect(code('app/dashboard/page.tsx')).not.toMatch(/stats_bundle/)
  })
  it('the leaderboard does not call leaderboard_page (it carried stats_bundle)', () => {
    expect(code('app/leaderboard/page.tsx')).not.toMatch(/leaderboard_page/)
    expect(code('app/leaderboard/page.tsx')).toMatch(/from\('grade_awards'\)\.select\('player_id, domain_number, rung, season_year'\)/)
    expect(code('app/leaderboard/page.tsx')).toMatch(/isLiveSession\(live\.data\)/)
  })
})

describe('best event breaks a colour tie on the exact score', () => {
  const slug = (n: string) => getEventByName(n)!.slug
  it('the higher exact score wins a tie on the colour', () => {
    const events = new Map([
      ['a', { slug: slug('Deadlift'), rung: 5, exact: 5.2 }],
      ['b', { slug: slug('Pushups'), rung: 5, exact: 5.8 }],
      ['c', { slug: slug('Javelin'), rung: 4, exact: 4.99 }],
    ])
    expect(bestEventByColour(events)).toEqual({ slug: slug('Pushups'), rung: 5 })
  })
  it('a higher colour still beats any exact score below it', () => {
    const events = new Map([
      ['a', { slug: slug('Deadlift'), rung: 6 }],
      ['b', { slug: slug('Pushups'), rung: 5, exact: 5.99 }],
    ])
    expect(bestEventByColour(events)?.slug).toBe(slug('Deadlift'))
  })
})

describe('the match read is shared in the browser', () => {
  // A fake client that counts reads of `matches` and answers with no rows.
  function fakeDb() {
    const counts = { matches: 0 }
    const query = (table: string) => {
      if (table === 'matches') counts.matches++
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'not', 'range', 'in', 'eq']) q[m] = () => q
      q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res)
      return q
    }
    return { db: { from: query } as never, counts }
  }

  beforeEach(() => forgetLoadedMatches())

  it('two pages in the same minute read it once', async () => {
    const { db, counts } = fakeDb()
    await loadMatchesChecked(db)
    await loadMatchesChecked(db)
    expect(counts.matches).toBe(1)
  })

  it('writing a match makes the next read fresh', async () => {
    const { db, counts } = fakeDb()
    await loadMatchesChecked(db)
    forgetLoadedMatches()
    await loadMatchesChecked(db)
    expect(counts.matches).toBe(2)
  })

  it('every screen that writes a match drops the shared read', () => {
    expect(src('lib/useSessionResults.ts')).toMatch(/rpc\('record_match'[\s\S]{0,300}forgetLoadedMatches\(\)/)
    expect(src('lib/useGameSwaps.ts')).toMatch(/rpc\('record_entry_match'[\s\S]{0,300}forgetLoadedMatches\(\)/)
    expect(src('app/workout/[id]/page.tsx')).toMatch(/rpc\('record_entry_match'[\s\S]{0,300}forgetLoadedMatches\(\)/)
    expect(src('components/GradeReleasePanel.tsx')).toMatch(/rpc\('settle_dispute'[\s\S]{0,400}forgetLoadedMatches\(\)/)
  })
})
