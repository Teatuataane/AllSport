// @vitest-environment jsdom
//
// How to Play's "Play Your First Game" (Tāne, 19 Nov 2026): a signed-in player
// goes HOME, anyone else to /play, where they sign in or join.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import FirstGameButton from '@/app/how-to-play/FirstGameButton'

const signedIn = vi.hoisted(() => ({ value: false }))
vi.mock('@/lib/authCookie', () => ({ hasAuthCookie: () => signedIn.value }))

afterEach(cleanup)

describe('FirstGameButton', () => {
  it('sends a visitor to sign in or join', () => {
    signedIn.value = false
    render(<FirstGameButton />)
    expect(screen.getByRole('link', { name: 'Play Your First Game' }).getAttribute('href')).toBe('/play')
  })

  it('sends a signed-in player home', () => {
    signedIn.value = true
    render(<FirstGameButton />)
    expect(screen.getByRole('link', { name: 'Play Your First Game' }).getAttribute('href')).toBe('/dashboard')
  })
})
