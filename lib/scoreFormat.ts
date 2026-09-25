// ─── A stored score, as a player reads it ────────────────────────────────────
// formatPR turns a raw_score back into "120 kg", "D3 · 0:45" or "Win". Moved
// out of components/play/chrome.tsx (a 'use client' module) so pure libs such
// as lib/colourDisplay.ts can call it without pulling the play-screen UI into
// every bundle that imports them. chrome.tsx re-exports it.

import { fmtTime, tierScoring } from '@/lib/scoring'
import { decodeDiffTime, isTimedEffort, type EventData } from '@/lib/eventData'

export function formatPR(rawScore: number, inputMode: string, slug?: string, eventData?: EventData): string {
  switch (inputMode) {
    case 'strength':   return slug === 'shoulder-dislocate' ? `${Math.abs(rawScore)}cm` : `${rawScore} kg`
    case 'reps':       return `${rawScore} reps`
    case 'time':
    case 'sprint':     return fmtTime(Math.abs(rawScore))
    case 'hold':       return fmtTime(rawScore)
    case 'distance':   return rawScore >= 100 ? `${(rawScore / 100).toFixed(2)}m` : `${rawScore}cm`
    case 'sport':      return rawScore === 2 ? 'Win' : rawScore === 1 ? 'Draw' : 'Loss'
    case 'score':      return `${Math.abs(rawScore)} strokes`
    case 'difficulty+time': {
      const bandIdx = Math.floor(rawScore / 10000)
      if (tierScoring(eventData, bandIdx) === 'sport') {
        const term = rawScore % 10000
        return `D${bandIdx + 1} · ${term === 2 ? 'Win' : term === 1 ? 'Draw' : 'Loss'}`
      }
      const { tierIdx, secs } = decodeDiffTime(rawScore, isTimedEffort(slug))
      return `D${tierIdx + 1} · ${fmtTime(secs)}`
    }
    case 'difficulty+reps': {
      const tierIdx = Math.floor(rawScore / 10000)
      const term = rawScore % 10000
      // The within-tier term is only reps on an ordinary rung.
      const scoring = tierScoring(eventData, tierIdx)
      if (scoring === 'weight') return `D${tierIdx + 1} · ${term / 100}kg`
      if (scoring === 'sport') return `D${tierIdx + 1} · ${term === 2 ? 'Win' : term === 1 ? 'Draw' : 'Loss'}`
      return `D${tierIdx + 1} · ${term} reps`
    }
    case 'difficulty+distance': {
      const tierIdx = Math.floor(rawScore / 10000)
      return `D${tierIdx + 1} · ${(rawScore % 10000) / 10}m`
    }
    case 'weight+time': {
      const kg = Math.floor(rawScore / 10000) / 100
      const secs = rawScore % 10000
      return `${kg > 0 ? `${kg}kg` : 'Bodyweight'} · ${fmtTime(secs)}`
    }
    default: return String(rawScore)
  }
}
