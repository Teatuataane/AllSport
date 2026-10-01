import { describe, it, expect } from 'vitest'
import { isTrainingOpen, recentClients, RECENT_DAYS } from '@/lib/training'

// 2026-10-01 noon NZ
const now = new Date('2026-10-01T00:00:00Z')

describe('isTrainingOpen', () => {
  it('is open for a witnessed workout today that is not finished', () => {
    expect(isTrainingOpen({ witnessed: true, performed_on: '2026-10-01', finished_at: null }, now)).toBe(true)
  })
  it('closes on Finish, at the end of the NZ day, and for a self-logged workout', () => {
    expect(isTrainingOpen({ witnessed: true, performed_on: '2026-10-01', finished_at: '2026-10-01T02:00:00Z' }, now)).toBe(false)
    expect(isTrainingOpen({ witnessed: true, performed_on: '2026-09-30', finished_at: null }, now)).toBe(false)
    expect(isTrainingOpen({ witnessed: false, performed_on: '2026-10-01', finished_at: null }, now)).toBe(false)
  })
})

describe('recentClients', () => {
  const me = 'judge-1'
  const w = (player_id: string, performed_on: string, extra = {}) => ({ player_id, performed_on, witnessed: true, logged_by: me, ...extra })

  it('lists each player once with their last session, newest first', () => {
    const out = recentClients([w('a', '2026-09-20'), w('b', '2026-09-28'), w('a', '2026-09-25')], me, now)
    expect(out).toEqual([{ player_id: 'b', last: '2026-09-28' }, { player_id: 'a', last: '2026-09-25' }])
  })
  it('drops sessions older than the window', () => {
    expect(RECENT_DAYS).toBe(30)
    expect(recentClients([w('a', '2026-08-31')], me, now)).toEqual([])
    expect(recentClients([w('a', '2026-09-01')], me, now)).toHaveLength(1)
  })
  it('ignores other kaiwhakawā and self-logged workouts', () => {
    expect(recentClients([w('a', '2026-09-28', { logged_by: 'judge-2' }), w('b', '2026-09-28', { witnessed: false })], me, now)).toEqual([])
  })
})
