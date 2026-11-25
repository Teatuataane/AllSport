// ── Former players (multi-location step 15) ─────────────────────────────────
// What this pins:
//   1. The SQL bands kept at erasure mirror lib/successMeasures.ts exactly
//      (ageBand, ethnicGroups, quintile), so an erased player counts the same.
//   2. Erasure keeps every earlier step, and now erases your children, deletes
//      your sign-in, and never rewrites parent_id (a guard refuses it).
//   3. Reach counts an erased player by those bands, by the game day.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ETHNICITIES } from '@/lib/privateProfile'
import { AGE_BANDS, ETHNIC_GROUPS, ageBand, ethnicGroups, personAgeBand, reachOf, type Person } from '@/lib/successMeasures'

const dir = 'supabase/migrations'
const sql = readFileSync(`${dir}/20261125231115_former_players.sql`, 'utf8')
const fnOf = (src: string) => src.match(/CREATE OR REPLACE FUNCTION public\.delete_my_account[\s\S]*?\n\$function\$;/)![0]

describe('the bands mirror the reports', () => {
  it('ages', () => {
    const fn = sql.slice(sql.indexOf('FUNCTION public.former_age_band'), sql.indexOf('FUNCTION public.former_ethnic_groups'))
    const steps = [...fn.matchAll(/WHEN p_age <= (\d+) THEN '([^']+)'/g)].map(m => [Number(m[1]), m[2]] as const)
    expect(steps.map(s => s[1])).toEqual(AGE_BANDS.slice(0, -1))
    for (const [n, band] of steps) {
      expect(ageBand(n)).toBe(band)
      expect(ageBand(n + 1)).not.toBe(band)
    }
    expect(fn).toMatch(/WHEN p_age IS NULL OR p_age < 5 THEN 'Unknown'/)
    expect(ageBand(4)).toBe('Unknown')
  })

  it('ethnic groups, every sign-up tick', () => {
    for (const { value } of ETHNICITIES) {
      const [group] = ethnicGroups([value])
      expect(sql, value).toContain(`WHEN '${value}' THEN '${group}'`)
    }
    expect(sql).toContain(`unnest(ARRAY[${ETHNIC_GROUPS.map(g => `'${g}'`).join(', ')}])`)
    expect(ethnicGroups([])).toEqual(['Not stated'])
    expect(sql).toMatch(/ELSE 'Other'/)
  })

  it('deprivation as the quintile, never the suburb', () => {
    expect(sql).toMatch(/CASE WHEN s\.nzdep BETWEEN 1 AND 10 THEN ceil\(s\.nzdep \/ 2\.0\)::smallint END/)
    const tables = sql.slice(sql.indexOf('CREATE TABLE public.former_players'), sql.indexOf('ALTER TABLE public.former_players'))
    expect(tables).not.toMatch(/suburb|date_of_birth|dob|who5|ethnicity\b/)
  })
})

describe('erasure', () => {
  const before = fnOf(readFileSync(`${dir}/20261123230958_signup_survey.sql`, 'utf8'))
  const now = fnOf(sql)

  it('keeps every step the live definition had', () => {
    const steps = (fn: string) => fn.split('\n').map(l => l.trim()).filter(l => /^(DELETE FROM|UPDATE|PERFORM|[a-z_]+\s+= )/.test(l))
    for (const step of steps(before)) expect(now, step).toContain(step)
  })

  it('erases your children first, then you, then your sign-in', () => {
    expect(now).toMatch(/ARRAY\(SELECT id FROM players WHERE parent_id = auth\.uid\(\) ORDER BY id\) \|\| v_target/)
    expect(now).toMatch(/FOREACH v_target IN ARRAY v_targets LOOP/)
    expect(now).toMatch(/IF v_self THEN\s+DELETE FROM auth\.users WHERE id = auth\.uid\(\);\s+END IF;/)
    // guard_players_privileged_columns refuses parent_id changes from a player.
    expect(now).not.toMatch(/SET parent_id/)
    expect(sql).toMatch(/players_parent_id_fkey FOREIGN KEY \(parent_id\) REFERENCES public\.players\(id\)/)
  })

  it('keeps the bands before anything is wiped', () => {
    expect(now.indexOf('INSERT INTO former_player_games')).toBeLessThan(now.indexOf('DELETE FROM player_profile_private'))
    expect(now.indexOf('INSERT INTO former_players')).toBeLessThan(now.indexOf('UPDATE players SET'))
  })

  it('keeps votes and koha with no person', () => {
    for (const fk of ['event_vote_responses_player_id_fkey', 'event_votes_created_by_fkey', 'koha_donations_player_id_fkey', 'koha_donations_recorded_by_fkey']) {
      expect(sql, fk).toMatch(new RegExp(`${fk} FOREIGN KEY \\(\\w+\\) REFERENCES auth\\.users\\(id\\) ON DELETE SET NULL`))
    }
  })

  it('is head-read only and keeps its grants', () => {
    expect(sql).toMatch(/former_players_head ON public\.former_players FOR SELECT TO authenticated USING \(public\.is_judge\(\)\)/)
    expect(sql).toMatch(/former_player_games_head ON public\.former_player_games FOR SELECT TO authenticated USING \(public\.is_judge\(\)\)/)
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.former_players, public\.former_player_games FROM authenticated;/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.delete_my_account\(uuid\) FROM PUBLIC, anon;/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.delete_my_account\(uuid\) TO authenticated;/)
  })
})

describe('reach counts an erased player by the bands', () => {
  const former: Person = {
    id: 'X', dob: null, gender: 'Female', ethnicity: null, decile: null,
    former: { bands: [{ date: '2026-03-01', band: '12-17' }, { date: '2026-10-01', band: '18-24' }], groups: ['Māori', 'Pacific'], quintile: 'Q5' },
  }

  it('takes the band of the latest game on or before the day', () => {
    expect(personAgeBand(former, '2026-02-01')).toBe('12-17') // before any game: the first
    expect(personAgeBand(former, '2026-06-01')).toBe('12-17')
    expect(personAgeBand(former, '2026-11-26')).toBe('18-24')
    expect(personAgeBand({ ...former, former: { ...former.former!, bands: [] } }, '2026-11-26')).toBe('Unknown')
  })

  it('counts sex, groups and quintile as kept', () => {
    const r = reachOf(['X'], new Map([['X', former]]), () => '2026-11-26')
    expect(r.age.get('18-24')).toBe(1)
    expect(r.sex.get('Female')).toBe(1)
    expect(r.ethnicity.get('Māori')).toBe(1)
    expect(r.ethnicity.get('Pacific')).toBe(1)
    expect(r.deprivation.get('Q5')).toBe(1)
  })
})
