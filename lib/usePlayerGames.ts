'use client'

// ─── One player's games, scored on the colour ladder ─────────────────────────
// Loads the player's grade inputs once (the same read HOME makes) and derives
// every game's colour score from them through lib/gameReport.ts. Used by the
// session-end screen, the game report and play history.
//
// Only ever for the viewer's own player (or a family member they manage):
// strength scores need the private bodyweight, which RLS only shows to them.

import { useEffect, useState } from 'react'
import { loadGradeInputs, gradeStateFrom, gradePlayerOf, type GradeDb, type GradeInputs, type GradeState } from './loadGrades'
import { gameScores, type GameScore } from './gameReport'
import type { GradePlayer } from './playerGrades'

export type PlayerGames = {
  playerId: string
  inputs: GradeInputs
  state: GradeState
  player: GradePlayer
  scores: Map<string, GameScore>
}

/**
 * `refresh` reloads when it changes: the session-end screen bumps it once the
 * recheck has conferred, so the new colours are in the awards it reads.
 */
export function usePlayerGames(db: GradeDb, playerId: string | null, refresh = 0): PlayerGames | null {
  const [loaded, setLoaded] = useState<PlayerGames | null>(null)

  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    loadGradeInputs(db, playerId).then(inputs => {
      if (cancelled || !inputs) return
      setLoaded({
        playerId, inputs,
        state: gradeStateFrom(playerId, inputs),
        player: gradePlayerOf(inputs),
        scores: gameScores(playerId, inputs),
      })
    }).catch(() => { /* the report simply shows no colour score */ })
    return () => { cancelled = true }
  }, [db, playerId, refresh])

  // Never hand back another player's games while the new ones load.
  return loaded && loaded.playerId === playerId ? loaded : null
}
