// ── Who plays: sign-up and survey (multi-location step 9) ───────────────────
// What this pins:
//   1. Ethnicity: "Prefer not to say" stands alone and counts as an answer.
//   2. A junior's check-in waits for a parent's yes; consent comes first.
//   3. Suburb, school and disability once a year; "active before" once ever.
//   4. The migration: private, written only through two functions, a junior's
//      check-in refused without consent, erasure takes the profile, programme
//      stamped by the server.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  aboutYouComplete, aboutYouPayload, cardNeeds, EMPTY_PROFILE, isJunior, needsConfirm, needsConsent,
  searchList, surveyAllowed, toggleEthnicity, type PrivateProfile,
} from '@/lib/privateProfile'

const at = new Date('2026-11-24T12:00:00+13:00')
const p = (over: Partial<PrivateProfile> = {}): PrivateProfile => ({ ...EMPTY_PROFILE, ...over })

describe('ethnicity', () => {
  it('lets "Prefer not to say" stand alone', () => {
    expect(toggleEthnicity(['maori', 'samoan'], 'prefer_not')).toEqual(['prefer_not'])
    expect(toggleEthnicity(['prefer_not'], 'maori')).toEqual(['maori'])
    expect(toggleEthnicity(['maori'], 'tongan')).toEqual(['maori', 'tongan'])
    expect(toggleEthnicity(['maori', 'tongan'], 'maori')).toEqual(['tongan'])
  })
})

describe('juniors', () => {
  it('is a junior by the year they turn, else by division', () => {
    expect(isJunior({ date_of_birth: '2010-12-31' }, at)).toBe(true)   // turns 16 this year
    expect(isJunior({ date_of_birth: '2009-01-01' }, at)).toBe(false)  // turns 17
    expect(isJunior({ date_of_birth: null, division: 'Juniors' }, at)).toBe(true)
    expect(isJunior({ date_of_birth: null, division: "Women's" }, at)).toBe(false)
  })

  it('holds the check-in back until a parent says yes', () => {
    expect(surveyAllowed(true, null)).toBe(false)
    expect(surveyAllowed(true, p({ survey_consent: false }))).toBe(false)
    expect(surveyAllowed(true, p({ survey_consent: true }))).toBe(true)
    expect(surveyAllowed(false, null)).toBe(true)
    expect(needsConsent(true, p({ survey_consent: true }))).toBe(true)  // school question unanswered
    expect(needsConsent(true, p({ survey_consent: false, share_with_school: false }))).toBe(false)
    expect(needsConsent(false, null)).toBe(false)
  })
})

describe('what HOME asks', () => {
  it('asks consent first and no check-in for a junior without it', () => {
    expect(cardNeeds({ junior: true, profile: null, surveyDue: true, at })).toEqual(['consent', 'ethnicity'])
    expect(cardNeeds({
      junior: true, profile: p({ ethnicity: ['maori'], share_with_school: true, survey_consent: false }), surveyDue: true, at,
    })).toEqual([])
  })

  it('asks an existing adult ethnicity, the year\'s questions and the check-in', () => {
    expect(cardNeeds({ junior: false, profile: null, surveyDue: true, at })).toEqual(['ethnicity', 'about', 'survey'])
    expect(cardNeeds({
      junior: false, profile: p({ ethnicity: ['other'], confirmed_year: 2026 }), surveyDue: false, at,
    })).toEqual([])
  })

  it('re-confirms each January', () => {
    expect(needsConfirm(p({ confirmed_year: 2026 }), at)).toBe(false)
    expect(needsConfirm(p({ confirmed_year: 2026 }), new Date('2027-01-01T08:00:00+13:00'))).toBe(true)
    // 1 January NZ is still 31 December in UTC: it is the NZ year that counts.
    expect(needsConfirm(p({ confirmed_year: 2026 }), new Date('2026-12-31T12:00:00Z'))).toBe(true)
  })
})

describe('about you', () => {
  const a = { suburb_id: 'x', school_status: null, school_id: null, disability: null, active_before: 'no' as const }

  it('needs a suburb, a junior\'s school, and active-before once', () => {
    expect(aboutYouComplete(a, false, null)).toBe(true)
    expect(aboutYouComplete({ ...a, suburb_id: null }, false, null)).toBe(false)
    expect(aboutYouComplete(a, true, null)).toBe(false)
    expect(aboutYouComplete({ ...a, school_status: 'none' }, true, null)).toBe(true)
    expect(aboutYouComplete({ ...a, school_status: 'listed' }, true, null)).toBe(false)
    expect(aboutYouComplete({ ...a, active_before: null }, false, null)).toBe(false)
    expect(aboutYouComplete({ ...a, active_before: null }, false, p({ active_before: 'yes' }))).toBe(true)
  })

  it('sends no school for an adult, and confirms the year', () => {
    expect(aboutYouPayload({ ...a, school_status: 'listed', school_id: 5 }, false)).toEqual({ suburb_id: 'x', confirm: true, active_before: 'no' })
    expect(aboutYouPayload({ ...a, school_status: 'listed', school_id: 5 }, true))
      .toEqual({ suburb_id: 'x', confirm: true, school_status: 'listed', school_id: 5, active_before: 'no' })
  })

  it('searches accent-blind, names that start with it first', () => {
    const list = [{ name: 'Woolston' }, { name: 'Ōtautahi Central' }, { name: 'Lower Woolston' }]
    expect(searchList(list, 'wool').map(x => x.name)).toEqual(['Woolston', 'Lower Woolston'])
    expect(searchList(list, 'otau').map(x => x.name)).toEqual(['Ōtautahi Central'])
    expect(searchList(list, '')).toEqual([])
  })
})

describe('signup survey migration', () => {
  const sql = readFileSync('supabase/migrations/20261123230958_signup_survey.sql', 'utf8')

  it('keeps the profile private and writable only through its functions', () => {
    expect(sql).toMatch(/GRANT SELECT ON public\.player_profile_private TO authenticated;/)
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*player_profile_private/)
    expect(sql).not.toMatch(/CREATE POLICY[^;]*player_profile_private FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(sql).toMatch(/USING \(public\.can_log_for\(player_id\)\)/)
    expect(sql).toMatch(/FROM PUBLIC, anon;\nGRANT EXECUTE ON FUNCTION public\.save_private_profile/)
  })

  it('never overwrites "active before" and keeps "prefer not" alone', () => {
    expect(sql).toMatch(/active_before = COALESCE\(active_before, p->>'active_before'\)/)
    expect(sql).toMatch(/IF 'prefer_not' = ANY \(v_eth\) THEN v_eth := ARRAY\['prefer_not'\]/)
  })

  it('refuses a junior\'s check-in without a parent\'s yes', () => {
    expect(sql).toMatch(/CREATE POLICY wellbeing_insert_own[\s\S]*AND public\.survey_allowed\(player_id\)/)
    expect(sql).toMatch(/<= 16/)
  })

  it('stamps the programme on the server and takes the profile on erasure', () => {
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF programme_id ON public\.wellbeing_surveys/)
    expect(sql).toMatch(/DELETE FROM player_profile_private WHERE player_id = v_target;/)
    // Everything the live erasure did is still there.
    for (const t of ['wellbeing_surveys', 'grade_exemptions', 'workouts', 'player_bodyweights']) {
      expect(sql).toContain(`DELETE FROM ${t} WHERE player_id = v_target;`)
    }
    expect(sql).toContain('bodyweight_band_first = NULL')
  })

  it('lets erasure past the finished-game guard, and only for the results updates', () => {
    // Before this, erasure failed with "session has ended" for anyone who had
    // played a finished game (found in the rehearsal, 24 Nov 2026).
    expect(sql).toMatch(/set_config\('allsport\.server_write', 'on', true\);\n\n  -- The name a kaiwhakawā typed/)
    expect(sql).toMatch(/END IF;\n\n  PERFORM set_config\('allsport\.server_write', 'off', true\);\nEND;/)
  })
})

describe('suburb and school lists', () => {
  const sql = readFileSync('supabase/migrations/20261123232725_reference_lists.sql', 'utf8')

  it('holds Canterbury suburbs with a decile and the open Canterbury schools', () => {
    const suburbs = sql.match(/^  \('\d{6}', '.*', '.* (City|District)', (\d+)\)/gm) ?? []
    expect(suburbs.length).toBe(318)
    expect(sql).toMatch(/\('321000', 'Sockburn North', 'Christchurch City', 7\)/)
    expect(sql).toMatch(/\(319, 'Burnside High School', 'Burnside', /)
    expect((sql.match(/^  \(\d+, '/gm) ?? []).length).toBe(293)
  })

  it('never deletes a row a profile may point at, and is generated', () => {
    expect(sql).not.toMatch(/DELETE|TRUNCATE/)
    expect(sql).toMatch(/GENERATED by scripts\/build-reference-lists\.mjs/)
    expect(sql).toMatch(/ON CONFLICT \(id\) DO UPDATE/)
  })
})
