// NOTE: effort task generation assumes correct difficultyTiers data in eventData.ts.
// An audit of eventData.ts is required — see CLAUDE.md What's Next item 2.

import type { DifficultyTier } from './eventData'

export type EffortTask = {
  tier: string         // e.g. "D3" or "strength" / "reps" etc. for non-tiered
  timeSeconds: number  // target time (tiered events), or 0 for non-time-based tasks
  label: string        // human-readable description, e.g. "D3 — Full Planche · 0:45"
  multiplier: number   // for display/debug; the ×N applied to base time
}

// For difficulty+time events, raw_score is encoded as: tierIndex * 10000 + timeSeconds
// (tierIndex is 0-based; D1 = index 0)
function decodeTieredScore(rawScore: number): { tierIndex: number; timeSeconds: number } {
  const abs = Math.abs(rawScore)
  return {
    tierIndex: Math.floor(abs / 10000),
    timeSeconds: abs % 10000,
  }
}

function fmtTime(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60)
  const s = Math.round(totalSecs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Generate up to 3 effort tasks for a difficulty+time event.
// Tasks step the player DOWN in tier with MORE time, making the hold more accessible.
// Slots (from easiest to hardest):
//   slot 0 (easiest): base - 3 tiers, time × 1.5  (or D1 with × 0.5 if floor hit)
//   slot 1 (medium):  base - 2 tiers, time × 2.0
//   slot 2 (hardest): base - 1 tier,  time × 3.0
// When a slot can't step down (already at D1), it clamps to D1 and the earliest
// such substitution uses × 0.5; subsequent clamped slots keep their original multiplier
// (since they still represent a valid, distinct time target at D1).
function generateTieredTasks(
  baseRawScore: number,
  tiers: DifficultyTier[],
): EffortTask[] {
  if (tiers.length === 0) return []

  const { tierIndex: baseTierIdx, timeSeconds: baseTime } = decodeTieredScore(baseRawScore)
  if (baseTime === 0) return []

  // drops[i] = how many tiers slot i steps down from base; multipliers[i] = time factor
  const drops = [3, 2, 1]
  const multipliers = [1.5, 2.0, 3.0]
  const FLOOR_MULTIPLIER = 0.5

  let floorHit = false
  const tasks: EffortTask[] = []

  for (let i = 0; i < 3; i++) {
    const targetIdx = baseTierIdx - drops[i]
    let tierIdx: number
    let multiplier: number

    if (targetIdx < 0) {
      // Below D1 floor — clamp to D1 (index 0)
      tierIdx = 0
      multiplier = floorHit ? multipliers[i] : FLOOR_MULTIPLIER
      floorHit = true
    } else {
      tierIdx = targetIdx
      multiplier = multipliers[i]
    }

    const tier = tiers[tierIdx]
    if (!tier) continue
    const timeSeconds = Math.max(1, Math.round(baseTime * multiplier))
    const tierLabel = `D${tier.level}`

    tasks.push({
      tier: tierLabel,
      timeSeconds,
      label: `${tierLabel} — ${tier.name} · ${fmtTime(timeSeconds)}`,
      multiplier,
    })
  }

  return tasks
}

// ─── Public API ───────────────────────────────────────────────────────────────

// compScore and prScore: pass the raw_score from the results/prs tables.
// For difficulty+time mode: encoded as tierIndex*10000 + timeSeconds.
// For other modes: not yet fully specified — returns [] until spec is complete.
export function generateEffortTasks(
  eventInputMode: string,
  compScore: number | null,
  prScore: number | null,
  difficultyTiers?: DifficultyTier[],
): EffortTask[] {
  if (eventInputMode === 'difficulty+time') {
    if (!difficultyTiers || difficultyTiers.length === 0) return []

    // Use the higher of compScore and prScore (tier wins; same tier → longer time wins)
    let baseScore: number | null = null
    if (compScore !== null && prScore !== null) {
      const comp = decodeTieredScore(compScore)
      const pr = decodeTieredScore(prScore)
      if (comp.tierIndex > pr.tierIndex) baseScore = compScore
      else if (pr.tierIndex > comp.tierIndex) baseScore = prScore
      else baseScore = comp.timeSeconds >= pr.timeSeconds ? compScore : prScore
    } else {
      baseScore = compScore ?? prScore
    }

    if (baseScore === null) return []
    return generateTieredTasks(baseScore, difficultyTiers)
  }

  // TODO: effort task generation for non-tiered event types (weight+reps, reps-only,
  // sprint, hold, long distance, sport) is not yet specified. Return empty for now.
  return []
}

// ─── Qualifying check ─────────────────────────────────────────────────────────

type EffortSubmission = {
  difficulty_tier: string | null
  time_seconds: number | null
  weight_kg: number | null
  reps: number | null
  distance_m: number | null
}

export function isQualifyingSubmission(task: EffortTask, submission: EffortSubmission): boolean {
  // For difficulty+time: tier must match exactly AND hold time >= task target
  if (task.tier.startsWith('D')) {
    return (
      submission.difficulty_tier === task.tier &&
      submission.time_seconds !== null &&
      submission.time_seconds >= task.timeSeconds
    )
  }

  // TODO: qualification logic for non-tiered event types not yet specified.
  return false
}
