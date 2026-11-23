// ─── The private profile: reads and writes ───────────────────────────────────
// The Supabase half of lib/privateProfile.ts. Takes its client as an argument.
//
// Code ships before 20261123230958 is applied (CLAUDE.md §12): while the table
// or the functions are missing, `live` is false, HOME asks nothing new and
// sign-up does not fail over them.

import type { SupabaseClient } from '@supabase/supabase-js'
import { EMPTY_PROFILE, type Ethnicity, type PrivateProfile } from '@/lib/privateProfile'

type PgError = { code?: string; message?: string } | null | undefined

/** Table, column or function not there yet. */
const missing = (e: PgError) => !!e && ['PGRST205', '42P01', '42703', 'PGRST204', 'PGRST202', '42883'].includes(e.code ?? '')

export type LoadedProfile = { live: boolean; profile: PrivateProfile | null }

const COLUMNS = 'ethnicity, suburb_id, school_id, school_status, disability, active_before, confirmed_year, share_with_school, survey_consent'

/** One player's private profile (yourself or your child; RLS). Null profile = never answered. */
export async function loadPrivateProfile(supabase: SupabaseClient, playerId: string): Promise<LoadedProfile> {
  const { data, error } = await supabase.from('player_profile_private')
    .select(COLUMNS).eq('player_id', playerId).maybeSingle()
  if (error) {
    if (!missing(error)) console.warn('private profile unavailable', error.message)
    return { live: false, profile: null }
  }
  return { live: true, profile: data ? { ...EMPTY_PROFILE, ...(data as Partial<PrivateProfile>) } : null }
}

/** Save some answers; only the keys sent change. Returns an error message or null. */
export async function savePrivateProfile(
  supabase: SupabaseClient, playerId: string, answers: Record<string, unknown>,
): Promise<string | null> {
  const { error } = await supabase.rpc('save_private_profile', { p_player_id: playerId, p: answers })
  if (!error) return null
  if (missing(error)) return 'not live'
  return error.message || 'Could not save'
}

export const saveEthnicity = (supabase: SupabaseClient, playerId: string, ethnicity: Ethnicity[]) =>
  savePrivateProfile(supabase, playerId, { ethnicity })

/** A parent's two answers for a junior. Returns an error message or null. */
export async function saveJuniorConsent(
  supabase: SupabaseClient, playerId: string, shareWithSchool: boolean, survey: boolean,
): Promise<string | null> {
  const { error } = await supabase.rpc('set_junior_consent', {
    p_player_id: playerId, p_share_with_school: shareWithSchool, p_survey: survey,
  })
  if (!error) return null
  if (missing(error)) return 'not live'
  return error.message || 'Could not save'
}

export type Suburb = { id: string; name: string; area: string | null }
export type School = { id: number; name: string; place: string | null }

// Read once per page load: about 300 rows each, public, and they change only
// when a migration re-seeds them.
let suburbsOnce: Promise<Suburb[]> | null = null
let schoolsOnce: Promise<School[]> | null = null

export function loadSuburbs(supabase: SupabaseClient): Promise<Suburb[]> {
  suburbsOnce ??= (async () => {
    const { data, error } = await supabase.from('nz_suburbs').select('id, name, area').order('name')
    if (error) { suburbsOnce = null; return [] }
    return (data ?? []) as Suburb[]
  })()
  return suburbsOnce
}

export function loadSchools(supabase: SupabaseClient): Promise<School[]> {
  schoolsOnce ??= (async () => {
    const { data, error } = await supabase.from('nz_schools').select('id, name, place').order('name')
    if (error) { schoolsOnce = null; return [] }
    return (data ?? []) as School[]
  })()
  return schoolsOnce
}
