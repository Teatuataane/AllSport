import { describe, it, expect } from 'vitest'

// Mirrors the GRADES array and helper functions from app/dashboard/page.tsx
// Keep in sync with any changes there.

const GRADES = [
  { name: 'Mā', colour: '#ffffff', textColour: '#000', threshold: 0 },
  { name: 'Kiwikiwi', colour: '#888888', textColour: '#fff', threshold: 500 },
  { name: 'Whero', colour: '#EA4742', textColour: '#fff', threshold: 1000 },
  { name: 'Karaka', colour: '#F9B051', textColour: '#000', threshold: 2000 },
  { name: 'Kōwhai', colour: '#FFE566', textColour: '#000', threshold: 3000 },
  { name: 'Kākāriki', colour: '#4DB26E', textColour: '#fff', threshold: 4000 },
  { name: 'Kahurangi', colour: '#2371BB', textColour: '#fff', threshold: 5000 },
  { name: 'Poroporo', colour: '#B87DB5', textColour: '#fff', threshold: 6000 },
  { name: 'Uenuku', colour: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)', textColour: '#fff', threshold: 8000 },
  { name: 'Taniwha', colour: '#000000', textColour: '#fff', threshold: 10000 },
]

function getCurrentGrade(points: number) {
  let grade = GRADES[0]
  for (const g of GRADES) { if (points >= g.threshold) grade = g }
  return grade
}

function getNextGrade(points: number) {
  for (const g of GRADES) { if (points < g.threshold) return g }
  return null
}

function gradeStyle(colour: string): Record<string, string> {
  return colour.startsWith('linear-gradient')
    ? { backgroundImage: colour }
    : { background: colour }
}

describe('getCurrentGrade', () => {
  it('returns Mā at 0 points', () => {
    expect(getCurrentGrade(0).name).toBe('Mā')
  })
  it('returns Mā at 499 points', () => {
    expect(getCurrentGrade(499).name).toBe('Mā')
  })
  it('returns Kiwikiwi at 500 points', () => {
    expect(getCurrentGrade(500).name).toBe('Kiwikiwi')
  })
  it('returns Uenuku at 8000 points', () => {
    expect(getCurrentGrade(8000).name).toBe('Uenuku')
  })
  it('returns Uenuku at 9999 points', () => {
    expect(getCurrentGrade(9999).name).toBe('Uenuku')
  })
  it('returns Taniwha at 10000 points', () => {
    expect(getCurrentGrade(10000).name).toBe('Taniwha')
  })
  it('returns Taniwha above 10000', () => {
    expect(getCurrentGrade(50000).name).toBe('Taniwha')
  })
})

describe('getNextGrade', () => {
  it('returns Kiwikiwi as next grade at 0 points', () => {
    expect(getNextGrade(0)?.name).toBe('Kiwikiwi')
  })
  it('returns Whero as next grade at 500 points', () => {
    expect(getNextGrade(500)?.name).toBe('Whero')
  })
  it('returns null at Taniwha (no next grade)', () => {
    expect(getNextGrade(10000)).toBeNull()
  })
  it('returns null above Taniwha threshold', () => {
    expect(getNextGrade(99999)).toBeNull()
  })
})

describe('gradeStyle', () => {
  it('uses background for hex colours', () => {
    expect(gradeStyle('#ffffff')).toEqual({ background: '#ffffff' })
  })
  it('uses backgroundImage for gradient strings', () => {
    const uenukuColour = 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)'
    expect(gradeStyle(uenukuColour)).toEqual({ backgroundImage: uenukuColour })
  })
  it('Uenuku grade uses backgroundImage (not background)', () => {
    const uenuku = GRADES.find(g => g.name === 'Uenuku')!
    const style = gradeStyle(uenuku.colour)
    expect(style).not.toHaveProperty('background')
    expect(style).toHaveProperty('backgroundImage')
  })
  it('Taniwha black uses background (not backgroundImage)', () => {
    const taniwha = GRADES.find(g => g.name === 'Taniwha')!
    const style = gradeStyle(taniwha.colour)
    expect(style).toHaveProperty('background')
    expect(style).not.toHaveProperty('backgroundImage')
  })
})

describe('points formula', () => {
  function calculatePoints(placement: number, playerCount: number): number {
    const gap = Math.max(100 / playerCount, 10)
    return Math.max(100 - gap * (placement - 1), 10)
  }

  it('5 players: gives 100/80/60/40/20', () => {
    expect(calculatePoints(1, 5)).toBe(100)
    expect(calculatePoints(2, 5)).toBe(80)
    expect(calculatePoints(3, 5)).toBe(60)
    expect(calculatePoints(4, 5)).toBe(40)
    expect(calculatePoints(5, 5)).toBe(20)
  })

  it('10 players: gives 100/90/.../10', () => {
    expect(calculatePoints(1, 10)).toBe(100)
    expect(calculatePoints(2, 10)).toBe(90)
    expect(calculatePoints(10, 10)).toBe(10)
  })

  it('enforces minimum 10 points for large fields', () => {
    // 20 players, gap = 5 — last place would be 5 without the floor
    expect(calculatePoints(20, 20)).toBe(10)
  })

  it('1 player: only player gets 100', () => {
    expect(calculatePoints(1, 1)).toBe(100)
  })
})
