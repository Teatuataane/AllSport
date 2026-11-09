// ─── What to score next ──────────────────────────────────────────────────────
// After a score goes in, the toast offers the next official event this player
// has not scored (v0.49.0.0), so nobody hunts down the list for it. "Next" is
// list order after the one just scored, wrapping round to the top.
//
// Pure: no Supabase, no React.

/**
 * The id of the next event in `orderedIds` after `justScoredId` that is not in
 * `scoredIds`, wrapping round. Null when every other event is scored. The
 * event just scored is never offered, even if it is not in `scoredIds` yet.
 */
export function nextUnscored(
  orderedIds: readonly string[],
  scoredIds: ReadonlySet<string>,
  justScoredId: string,
): string | null {
  const start = orderedIds.indexOf(justScoredId)
  for (let step = 1; step <= orderedIds.length; step++) {
    const id = orderedIds[((start < 0 ? -1 : start) + step) % orderedIds.length]
    if (id !== justScoredId && !scoredIds.has(id)) return id
  }
  return null
}
