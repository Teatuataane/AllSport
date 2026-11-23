// ─── The private profile: who plays, for funders ─────────────────────────────
// MULTI_LOCATION_PLAN.md §2 "Registration and survey", step 9; database:
// 20261123230958_signup_survey.sql. Agreed with Tāne 24 Nov 2026:
//
//   · Ethnicity is asked at sign-up and is REQUIRED; "Prefer not to say" is an
//     answer and stands alone. Existing players are asked on HOME.
//   · A junior's parent answers two questions: share attendance with the
//     school, and may the child do the wellbeing check-in. Until the second is
//     yes the check-in is held back (the database refuses it too).
//   · Suburb, school (juniors) and disability are asked in the check-in and
//     re-confirmed in the first check-in of each NZ year. "Active before
//     AllSport?" is asked once, ever.
//
// PURE: no Supabase, no React (__tests__/privateProfile.test.ts).

import { nzYear } from '@/lib/seasonYear'

export const ETHNICITIES = [
  { value: 'nz_european', label: 'NZ European' },
  { value: 'maori', label: 'Māori' },
  { value: 'samoan', label: 'Samoan' },
  { value: 'cook_islands_maori', label: 'Cook Islands Māori' },
  { value: 'tongan', label: 'Tongan' },
  { value: 'niuean', label: 'Niuean' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'indian', label: 'Indian' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not', label: 'Prefer not to say' },
] as const

export type Ethnicity = (typeof ETHNICITIES)[number]['value']

export type SchoolStatus = 'listed' | 'other' | 'none'
export type YesNo = 'yes' | 'no'
export type Disability = YesNo | 'prefer_not'

export type PrivateProfile = {
  ethnicity: Ethnicity[] | null
  suburb_id: string | null
  school_id: number | null
  school_status: SchoolStatus | null
  disability: Disability | null
  active_before: YesNo | null
  confirmed_year: number | null
  share_with_school: boolean | null
  survey_consent: boolean | null
}

export const EMPTY_PROFILE: PrivateProfile = {
  ethnicity: null, suburb_id: null, school_id: null, school_status: null, disability: null,
  active_before: null, confirmed_year: null, share_with_school: null, survey_consent: null,
}

/** The "Somewhere else" suburb row. */
export const ELSEWHERE = 'elsewhere'

/**
 * Tick or untick one box. "Prefer not to say" clears the others, and any
 * other box clears "Prefer not to say": the database keeps it alone too.
 */
export function toggleEthnicity(current: readonly Ethnicity[], tapped: Ethnicity): Ethnicity[] {
  if (current.includes(tapped)) return current.filter(e => e !== tapped)
  if (tapped === 'prefer_not') return ['prefer_not']
  return [...current.filter(e => e !== 'prefer_not'), tapped]
}

/** Ethnicity is answered once at least one box is ticked. */
export const ethnicityAnswered = (e: readonly string[] | null | undefined) => !!e && e.length > 0

/**
 * A junior for consent: turning 16 or under this NZ year (the Juniors rule),
 * or in the Juniors division when the date of birth is not known. Mirrors
 * survey_allowed() in the migration.
 */
export function isJunior(p: { date_of_birth?: string | null; division?: string | null }, at: Date = new Date()): boolean {
  if (p.date_of_birth && /^\d{4}-/.test(p.date_of_birth)) {
    return nzYear(at) - Number(p.date_of_birth.slice(0, 4)) <= 16
  }
  return p.division === 'Juniors'
}

/** A junior whose parent has not answered the two consent questions yet. */
export function needsConsent(junior: boolean, profile: PrivateProfile | null): boolean {
  return junior && (profile?.share_with_school == null || profile?.survey_consent == null)
}

/** May this player do the wellbeing check-in? Adults yes; a junior only with a parent's yes. */
export function surveyAllowed(junior: boolean, profile: PrivateProfile | null): boolean {
  return !junior || profile?.survey_consent === true
}

/** Suburb, school and disability need asking (never asked, or not yet this NZ year). */
export function needsConfirm(profile: PrivateProfile | null, at: Date = new Date()): boolean {
  return !profile || profile.confirmed_year == null || profile.confirmed_year < nzYear(at)
}

/** First time, ask; later years, show the answers with "Still right?". */
export const firstAsk = (profile: PrivateProfile | null) => !profile || profile.confirmed_year == null

export type AboutYou = {
  suburb_id: string | null
  school_status: SchoolStatus | null
  school_id: number | null
  disability: Disability | null
  active_before: YesNo | null
}

/** The answers to start the "About you" part from: last year's, kept. */
export function aboutYouFrom(profile: PrivateProfile | null): AboutYou {
  return {
    suburb_id: profile?.suburb_id ?? null,
    school_status: profile?.school_status ?? null,
    school_id: profile?.school_id ?? null,
    disability: profile?.disability ?? null,
    active_before: profile?.active_before ?? null,
  }
}

/**
 * Is "About you" complete? Suburb always; school for a junior; "active
 * before" until it has been answered once. Disability is optional.
 */
export function aboutYouComplete(a: AboutYou, junior: boolean, profile: PrivateProfile | null): boolean {
  if (!a.suburb_id) return false
  if (junior && (!a.school_status || (a.school_status === 'listed' && a.school_id == null))) return false
  if (!profile?.active_before && !a.active_before) return false
  return true
}

/** What save_private_profile is sent for "About you". Adults send no school. */
export function aboutYouPayload(a: AboutYou, junior: boolean): Record<string, unknown> {
  const p: Record<string, unknown> = { suburb_id: a.suburb_id, confirm: true }
  if (junior) {
    p.school_status = a.school_status
    if (a.school_status === 'listed') p.school_id = a.school_id
  }
  if (a.disability) p.disability = a.disability
  if (a.active_before) p.active_before = a.active_before
  return p
}

/**
 * What HOME's card has to ask, in order. 'consent' first (a parent's yes
 * comes before any check-in); 'ethnicity' for anyone not yet asked; 'about'
 * when the check-in is due or the year's confirm is missing (and the
 * check-in is allowed).
 */
export type CardNeed = 'consent' | 'ethnicity' | 'about' | 'survey'

export function cardNeeds(args: {
  junior: boolean
  profile: PrivateProfile | null
  surveyDue: boolean
  at?: Date
}): CardNeed[] {
  const { junior, profile, surveyDue, at = new Date() } = args
  const out: CardNeed[] = []
  if (needsConsent(junior, profile)) out.push('consent')
  if (!ethnicityAnswered(profile?.ethnicity)) out.push('ethnicity')
  const allowed = surveyAllowed(junior, profile)
  if (allowed && needsConfirm(profile, at)) out.push('about')
  if (allowed && surveyDue) out.push('survey')
  return out
}

/** Search a list by name, accent-blind, for the suburb and school pickers. */
export function searchList<T extends { name: string; place?: string | null; area?: string | null }>(
  list: readonly T[], q: string, limit = 30,
): T[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const words = fold(q).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const hits = list.filter(x => {
    const hay = fold(`${x.name} ${x.place ?? ''} ${x.area ?? ''}`)
    return words.every(w => hay.includes(w))
  })
  // Names that start with the search first.
  const first = fold(words[0])
  hits.sort((a, b) => Number(!fold(a.name).startsWith(first)) - Number(!fold(b.name).startsWith(first)) || a.name.localeCompare(b.name))
  return hits.slice(0, limit)
}
