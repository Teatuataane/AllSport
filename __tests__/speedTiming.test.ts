import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripQuery } from '@/components/SpeedTiming'

describe('Speed Insights (components/SpeedTiming.tsx)', () => {
  it('never sends a query string or hash (a join link carries a game code)', () => {
    expect(stripQuery('https://allsport.nz/dashboard?code=AB12')).toBe('https://allsport.nz/dashboard')
    expect(stripQuery('https://allsport.nz/auth/callback?code=x&next=/prs')).toBe('https://allsport.nz/auth/callback')
    expect(stripQuery('https://allsport.nz/dashboard#join')).toBe('https://allsport.nz/dashboard')
    expect(stripQuery('https://allsport.nz/prs')).toBe('https://allsport.nz/prs')
  })

  it('is mounted once, in the root layout, through the wrapper', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8')
    expect(layout).toMatch(/<SpeedTiming \/>/)
    const wrapper = readFileSync('components/SpeedTiming.tsx', 'utf8')
    expect(wrapper).toMatch(/beforeSend=\{e => \(\{ \.\.\.e, url: stripQuery\(e\.url\) \}\)\}/)
  })

  it('the privacy policy says it is there', () => {
    expect(readFileSync('app/privacy/page.tsx', 'utf8')).toMatch(/Vercel Speed Insights/)
  })
})
