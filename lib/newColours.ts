// ─── Colours the player has not seen yet ─────────────────────────────────────
// A colour now lands without anyone tapping anything, so something has to mark
// the moment. Driving that off the recheck's RESPONSE would miss the case the
// response cannot cover: a kaiwhakawā opening the release panel confers for
// players who are not there (spec decision 8), and those players would never
// be told.
//
// So it is driven off the awards themselves, against a watermark the viewer
// keeps. Pure, and tested, because the cold-start rule below is easy to get
// wrong and loud when it is.

export type AwardLike = { domain_number: number; rung: number; grade_name: string; conferred_at: string }

/**
 * Compared as instants, never as strings. The watermark is written by
 * JavaScript ("…06.123Z") and the award by Postgres ("…06.123456+00:00");
 * comparing those lexically is right only by luck of the character codes.
 * Same rule as gradeStateFrom and the replay.
 */
const ms = (iso: string) => Date.parse(iso)

export const coloursSeenKey = (playerId: string) => `allsport_colours_seen_${playerId}`

/** The most recent conferral in a set, or null when there are none. */
export function latestConferredAt(awards: readonly AwardLike[]): string | null {
  let latest: string | null = null
  for (const a of awards) if (!latest || ms(a.conferred_at) > ms(latest)) latest = a.conferred_at
  return latest
}

/**
 * Awards conferred since `seenAt`, newest first.
 *
 * A null watermark means this viewer has never been marked up to date, and it
 * returns NOTHING. That is the cold start: the backfill confers every colour a
 * player has ever earned at once (spec decision 9), and treating those as news
 * would open the app on ten unread cards for something they did months ago.
 * The caller writes `latestConferredAt` as the watermark in that case, so only
 * what happens NEXT is new.
 */
export function unseenAwards(awards: readonly AwardLike[], seenAt: string | null): AwardLike[] {
  if (!seenAt) return []
  const seen = ms(seenAt)
  return awards.filter(a => ms(a.conferred_at) > seen)
    .sort((a, b) => ms(b.conferred_at) - ms(a.conferred_at))
}

// ─── Colours taken back ──────────────────────────────────────────────────────
// Spec decision 7: a withdrawal is told plainly and quietly, naming what
// changed. Same watermark as new colours, so one "Got it" clears both and a
// cold start shows neither.

export type WithdrawalLike = {
  domain_number: number
  rung: number
  grade_name: string
  withdrawn_at: string
  reason: string | null
}

export function unseenWithdrawals(rows: readonly WithdrawalLike[], seenAt: string | null): WithdrawalLike[] {
  if (!seenAt) return []
  const seen = ms(seenAt)
  return rows.filter(w => ms(w.withdrawn_at) > seen)
    .sort((a, b) => ms(b.withdrawn_at) - ms(a.withdrawn_at))
}
