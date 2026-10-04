// Value: protects=stored scores staying gradeable when a level is renamed;
// fails_when=a level name in lib/eventData.ts changes, which since Oct 2026
// stops every stored row on that level from grading (lib/playerGrades.ts
// onCurrentLadder) until a migration repoints results.difficulty_tier and
// workout_entries.difficulty_tier; why_new=nothing tied a rename to a repoint;
// seam=none
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EVENTS } from '@/lib/eventData'

const frozen: Record<string, string[]> = JSON.parse(readFileSync('__tests__/fixtures/levelNames.json', 'utf8'))

describe('level names are a stored contract', () => {
  it('no level was renamed, moved or removed without a repoint', () => {
    const now: Record<string, string[]> = {}
    for (const e of EVENTS) if (e.difficultyTiers?.length) now[e.slug] = e.difficultyTiers.map(t => t.name)
    for (const [slug, names] of Object.entries(frozen)) {
      // Renaming, reordering or removing a level un-grades its stored rows. Write a
      // migration repointing results.difficulty_tier AND workout_entries.difficulty_tier
      // (and shifting raw_score if the index moved), then regenerate
      // __tests__/fixtures/levelNames.json.
      expect(now[slug]?.slice(0, names.length), slug).toEqual(names)
    }
  })
})
