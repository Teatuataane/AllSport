// Reads and writes for Kaiārahi levels. The rules are in lib/kaiarahi.ts.
//
// The kaiarahi table arrives with 20261123024501_kaiarahi_levels.sql, which is
// applied after the code deploys (CLAUDE.md §12), so every read here is its own
// query and a missing table reads as "not live yet" rather than an error.

import type { SupabaseClient } from '@supabase/supabase-js'
import { levelFrom, isKaiarahiLevel, type KaiarahiLevel } from '@/lib/kaiarahi'

const NOT_LIVE = new Set(['PGRST205', '42P01', 'PGRST202', '42883'])

export function notLive(error: { code?: string } | null | undefined): boolean {
  return !!error && NOT_LIVE.has(error.code ?? '')
}

/**
 * The signed-in player's own level. `role` is their players.role, used only
 * until the table is live. Any other failure reads as no level: hiding a
 * button is the safe way to be wrong.
 */
export async function loadOwnLevel(
  supabase: SupabaseClient,
  userId: string,
  role: string | null | undefined,
): Promise<KaiarahiLevel | null> {
  const { data, error } = await supabase
    .from('kaiarahi').select('level, suspended_at').eq('player_id', userId).maybeSingle()
  if (error) return notLive(error) ? levelFrom(undefined, role) : null
  return levelFrom(data ?? null, role)
}

export type KaiarahiRow = {
  player_id: string
  level: KaiarahiLevel
  granted_at: string
  qualified_via: string | null
  vetting_expires: string | null
  first_aid_expires: string | null
  suspended_at: string | null
  suspended_reason: string | null
}

/** Every Kaiārahi, for a head. Null when the table is not live yet. */
export async function loadKaiarahiList(supabase: SupabaseClient): Promise<KaiarahiRow[] | null> {
  const { data, error } = await supabase.rpc('kaiarahi_list')
  if (error) {
    if (notLive(error)) return null
    throw error
  }
  return ((data ?? []) as KaiarahiRow[]).filter(r => isKaiarahiLevel(r.level))
}

export async function grantKaiarahi(supabase: SupabaseClient, playerId: string, level: KaiarahiLevel, qualifiedVia: string) {
  const { error } = await supabase.rpc('grant_kaiarahi', { p_player_id: playerId, p_level: level, p_qualified_via: qualifiedVia || null })
  if (error) throw error
}

export async function setKaiarahiChecks(supabase: SupabaseClient, playerId: string, vetting: string | null, firstAid: string | null) {
  const { error } = await supabase.rpc('set_kaiarahi_checks', { p_player_id: playerId, p_vetting_expires: vetting, p_first_aid_expires: firstAid })
  if (error) throw error
}

export async function suspendKaiarahi(supabase: SupabaseClient, playerId: string, reason: string) {
  const { error } = await supabase.rpc('suspend_kaiarahi', { p_player_id: playerId, p_reason: reason })
  if (error) throw error
}

export async function removeKaiarahi(supabase: SupabaseClient, playerId: string) {
  const { error } = await supabase.rpc('remove_kaiarahi', { p_player_id: playerId })
  if (error) throw error
}
