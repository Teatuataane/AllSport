import { describe, it, expect } from 'vitest'
import { ORGANISATION, jsonLd } from '@/lib/structuredData'

describe('structured data', () => {
  it('lists the three weekly games, each 100 minutes', () => {
    expect(ORGANISATION.openingHoursSpecification).toEqual([
      expect.objectContaining({ dayOfWeek: 'https://schema.org/Tuesday', opens: '16:30', closes: '18:10' }),
      expect.objectContaining({ dayOfWeek: 'https://schema.org/Thursday', opens: '16:30', closes: '18:10' }),
      expect.objectContaining({ dayOfWeek: 'https://schema.org/Saturday', opens: '09:00', closes: '10:40' }),
    ])
  })

  it('escapes < so a value cannot close the script tag', () => {
    const out = jsonLd({ x: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('<')
    expect(JSON.parse(out)).toEqual({ x: '</script><script>alert(1)</script>' })
  })
})
