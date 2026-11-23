import { describe, it, expect } from 'vitest'
import { ORGANISATION, SITE_NAME, WEBSITE, jsonLd } from '@/lib/structuredData'

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

  it('names the site the same in WebSite data and the share card', async () => {
    const fs = await import('node:fs')
    expect(WEBSITE).toMatchObject({ '@type': 'WebSite', name: 'Allsport Aotearoa', url: 'https://allsport.nz/' })
    expect(fs.readFileSync('app/layout.tsx', 'utf8')).toContain('siteName: SITE_NAME')
    expect(SITE_NAME).toBe(WEBSITE.name)
  })
})
