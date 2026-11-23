import { describe, it, expect } from 'vitest'
import { distanceMetres, nearbySites, sameNameSites, pinFromMapUrl, formatMetres, pinOf } from '@/lib/sites'

// Hagley Park (Riccarton end) and points around it.
const hagley = { lat: -43.5310, lng: 172.6210 }

describe('distanceMetres', () => {
  it('is zero for the same point', () => {
    expect(distanceMetres(hagley, hagley)).toBe(0)
  })
  it('is about 111 m for a thousandth of a degree of latitude', () => {
    expect(distanceMetres(hagley, { lat: -43.5320, lng: 172.6210 })).toBeGreaterThan(105)
    expect(distanceMetres(hagley, { lat: -43.5320, lng: 172.6210 })).toBeLessThan(115)
  })
})

describe('nearbySites', () => {
  const sites = [
    { id: 'far', name: 'Jellie Park', lat: -43.5100, lng: 172.5800 },
    { id: 'near', name: 'Hagley Park', lat: -43.5313, lng: 172.6212 },
    { id: 'unpinned', name: 'AllSport HQ', lat: null, lng: null },
  ]
  it('offers only pinned sites within 500 m, nearest first', () => {
    expect(nearbySites(sites, hagley).map(s => s.id)).toEqual(['near'])
  })
  it('skips sites without a pin', () => {
    expect(nearbySites(sites, hagley, 1e7).map(s => s.id)).toEqual(['near', 'far'])
  })
})

describe('sameNameSites', () => {
  const sites = [{ id: 'a', name: 'Hagley Park' }, { id: 'b', name: 'Jellie Park' }]
  it('ignores case, spaces and punctuation', () => {
    expect(sameNameSites(sites, ' hagley-park ').map(s => s.id)).toEqual(['a'])
  })
  it('matches nothing for an empty name', () => {
    expect(sameNameSites(sites, '  ')).toEqual([])
  })
})

describe('pinFromMapUrl', () => {
  it('reads the @lat,lng of a Google Maps link', () => {
    expect(pinFromMapUrl('https://www.google.com/maps/place/Hagley+Park/@-43.531,172.621,15z'))
      .toEqual({ lat: -43.531, lng: 172.621 })
  })
  it('reads q= and query= links', () => {
    expect(pinFromMapUrl('https://maps.google.com/?q=-43.5,172.6')).toEqual({ lat: -43.5, lng: 172.6 })
    expect(pinFromMapUrl('https://www.google.com/maps/search/?api=1&query=-43.5%2C172.6')).toEqual({ lat: -43.5, lng: 172.6 })
  })
  it('refuses a link with no pin or an impossible one', () => {
    expect(pinFromMapUrl('https://maps.app.goo.gl/abc123')).toBeNull()
    expect(pinFromMapUrl('https://maps.google.com/?q=-143.5,172.6')).toBeNull()
  })
})

describe('formatMetres and pinOf', () => {
  it('rounds metres and switches to km', () => {
    expect(formatMetres(123)).toBe('120 m')
    expect(formatMetres(1440)).toBe('1.4 km')
  })
  it('needs both halves of a pin', () => {
    expect(pinOf({ lat: 1, lng: null })).toBeNull()
    expect(pinOf({ lat: 1, lng: 2 })).toEqual({ lat: 1, lng: 2 })
  })
})
