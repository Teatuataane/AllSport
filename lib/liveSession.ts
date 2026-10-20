import type { SupabaseClient } from '@supabase/supabase-js'

// Live updates during a game, by Realtime BROADCAST rather than postgres_changes.
//
// Why: postgres_changes makes the Realtime server poll the database's
// replication slot several times a second for as long as anyone has a game
// screen open, decoding the write-ahead log from disk on every poll. By
// 21 Oct 2026 that poll had run 3.35 million times, and Supabase warned that
// the project was draining its Disk IO budget on the Micro compute (the
// database itself is 22 MB and fits in memory). A broadcast is a message
// relayed by the Realtime server alone and never touches Postgres.
//
// The trade: a broadcast is only sent by a screen that wrote. The scoring page
// is the only place `results` is written from the browser, so it announces
// every save and delete; anything else that changes results (a server close,
// a future RPC) is picked up by the scoring page's 15-second poll and by each
// screen's own reload. Messages carry no data, only "go and re-read", so a
// stray or forged ping costs one extra read and nothing more.
//
// Public channel (as postgres_changes was): no private-channel RLS, so nothing
// is written to realtime.messages either.

export const RESULTS_CHANGED = 'results-changed'

export function liveSessionTopic(sessionId: string): string {
  return `session-live-${sessionId}`
}

/**
 * Calls `onChange` whenever another screen announces a result change in this
 * game. Returns the unsubscribe function for a useEffect cleanup.
 */
export function onResultsChanged(
  supabase: SupabaseClient, sessionId: string, onChange: () => void,
): () => void {
  const channel = supabase
    .channel(liveSessionTopic(sessionId))
    .on('broadcast', { event: RESULTS_CHANGED }, () => onChange())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

/**
 * Tells every screen watching this game that its results changed. Fire and
 * forget: a lost ping only delays a refresh until the next poll, so it must
 * never turn a saved score into an error.
 */
export function announceResultsChanged(supabase: SupabaseClient, sessionId: string): void {
  // supabase.channel() hands back the page's own subscribed channel when there
  // is one (channels are keyed by topic), so this goes down the open socket.
  const channel = supabase.channel(liveSessionTopic(sessionId))
  if (channel.state === 'joined') {
    channel.send({ type: 'broadcast', event: RESULTS_CHANGED, payload: {} }).catch(() => {})
    return
  }
  // Not subscribed here: send over REST, then drop the channel object this call
  // created so it does not linger on the client unsubscribed.
  channel.httpSend(RESULTS_CHANGED, {})
    .catch(() => {})
    .finally(() => { if (channel.state === 'closed') supabase.removeChannel(channel) })
}
