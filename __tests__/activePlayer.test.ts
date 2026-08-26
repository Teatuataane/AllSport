import { describe, it, expect } from 'vitest'
import { resolveActiveId, playerLabel, type ActivePlayerRow } from '@/lib/activePlayer'

// ── The guard on the stored id ───────────────────────────────────────────────
// localStorage is user-editable from a console, and RLS on `players` fails
// SILENTLY — a query for someone else's row returns zero rows rather than an
// error. So a stored id is only ever honoured when it names someone this account
// actually has; anything else falls back to the signed-in user rather than
// rendering a page that quietly says nothing.

const SELF = 'self-uuid'
const child = (id: string, name: string): ActivePlayerRow => ({
  id, full_name: name, display_name: name, username: null,
  division: 'Juniors', date_of_birth: null, icon: null,
})

const FAMILY = [child('kid-1', 'Rima'), child('kid-2', 'Toa')]

describe('resolveActiveId', () => {
  it('falls back to the signed-in user when nothing is stored', () => {
    expect(resolveActiveId(null, SELF, FAMILY)).toBe(SELF)
  })

  it('honours a stored id that is one of this account’s children', () => {
    expect(resolveActiveId('kid-2', SELF, FAMILY)).toBe('kid-2')
  })

  it('REFUSES a stored id belonging to nobody in the household', () => {
    // The attack this closes: paste any player uuid into localStorage and the
    // page would ask for their rows. RLS returns none, so the page would render
    // empty under someone else's name rather than refusing.
    expect(resolveActiveId('someone-elses-uuid', SELF, FAMILY)).toBe(SELF)
  })

  it('refuses a stale id after that family member is removed', () => {
    expect(resolveActiveId('kid-1', SELF, [child('kid-2', 'Toa')])).toBe(SELF)
  })

  it('a solo account can never resolve to anyone but itself', () => {
    expect(resolveActiveId('kid-1', SELF, [])).toBe(SELF)
  })

  it('the signed-in user’s own id is always valid', () => {
    expect(resolveActiveId(SELF, SELF, [])).toBe(SELF)
  })
})

describe('playerLabel', () => {
  it('prefers display name, then username, then full name', () => {
    expect(playerLabel({ ...child('a', 'Full'), display_name: 'Disp', username: 'user' })).toBe('Disp')
    expect(playerLabel({ ...child('a', 'Full'), display_name: null, username: 'user' })).toBe('user')
    expect(playerLabel({ ...child('a', 'Full'), display_name: null, username: null })).toBe('Full')
  })

  it('treats blank as missing, not as a name', () => {
    // A blank display_name rendered an empty chip in the kaiwhakawa roster once
    // already — `??` alone does not catch '' and neither does a naive ||.
    expect(playerLabel({ ...child('a', 'Full'), display_name: '   ', username: null })).toBe('Full')
  })

  it('never returns an empty string', () => {
    expect(playerLabel(null)).toBe('—')
    expect(playerLabel({ ...child('a', ''), display_name: '', username: '' })).toBe('—')
  })
})
