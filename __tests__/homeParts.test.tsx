// @vitest-environment jsdom
//
// ── HOME's small parts ───────────────────────────────────────────────────────
// app/dashboard/page.tsx is behind a login and calls Supabase at module scope,
// so its presentational pieces live in components/HomeParts.tsx where they can
// be rendered. What this pins:
//   1. The avatar is ringed in the overall colour: grey while loading and on
//      Mā, the rainbow on Uenuku, black with a white ring on Taniwha.
//   2. A running game is one button straight into it, worded for the viewer.
//   3. No game: one slim line naming the next session, "Your first game" for
//      a player who has never played.
//   4. The links off HOME go where they say.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ColourAvatar, GameOnCard, TrainingOnCard, NextSessionLine, HomeLink } from '@/components/HomeParts'

afterEach(cleanup)

const avatar = () => screen.getByRole('img') as HTMLElement

describe('ColourAvatar', () => {
  it('has a plain label and white ink while the colour is still loading', () => {
    render(<ColourAvatar rung={null} icon={null} initial="T" />)
    expect(avatar().getAttribute('aria-label')).toBe('Your avatar')
    expect(avatar().style.color).toBe('var(--white)')
    expect(avatar().textContent).toBe('T')
  })

  it('names Mā once loaded, still in white ink', () => {
    render(<ColourAvatar rung={0} icon={null} initial="T" />)
    expect(avatar().getAttribute('aria-label')).toBe('Your avatar, overall colour Mā')
    expect(avatar().style.color).toBe('var(--white)')
  })

  it('rings a colour in its readable ink, the same one the card names it in', () => {
    render(<ColourAvatar rung={2} icon={null} initial="R" />)
    expect(avatar().getAttribute('aria-label')).toBe('Your avatar, overall colour Whero')
    // Whero's ink (#EE625D), not its raw hex, as gradeInk gives the card title.
    expect(avatar().style.color).toMatch(/#EE625D|rgb\(238, 98, 93\)/i)
  })

  it('shows the icon instead of the initial when there is one', () => {
    render(<ColourAvatar rung={3} icon="🏉" initial="R" />)
    expect(avatar().textContent).toBe('🏉')
    expect(avatar().style.fontSize).toBe('26px')
  })

  it('paints Uenuku as a rainbow ring', () => {
    render(<ColourAvatar rung={11} icon={null} initial="U" />)
    expect(avatar().getAttribute('aria-label')).toBe('Your avatar, overall colour Uenuku')
    const bg = avatar().style.background
    // jsdom may drop a multi-layer background it cannot parse; when it keeps
    // it, it must be the conic rainbow.
    if (bg) expect(bg).toContain('conic-gradient')
    expect(avatar().dataset.ring).toBe('rainbow')
    expect(avatar().style.color).toMatch(/#F397C0|rgb\(243, 151, 192\)/i)
  })

  it('paints Taniwha with a white ring', () => {
    render(<ColourAvatar rung={12} icon={null} initial="T" />)
    expect(avatar().dataset.ring).toBe('inverted')
    expect(avatar().getAttribute('aria-label')).toBe('Your avatar, overall colour Taniwha')
    expect(avatar().style.color).toMatch(/#ffffff|rgb\(255, 255, 255\)/i)
  })
})

describe('GameOnCard', () => {
  it('sends a player straight into the game with one JOIN button', () => {
    render(<GameOnCard game={{ id: 'abc', location: 'Selwyn' }} isJudge={false} error="" />)
    const join = screen.getByRole('link', { name: 'Join →' })
    expect(join.getAttribute('href')).toBe('/scoring/abc')
    expect(screen.getByText('Selwyn')).toBeTruthy()
    expect(screen.getByText('Game on now')).toBeTruthy()
  })

  it('words the button for a kaiwhakawā, and falls back to HQ with no location', () => {
    render(<GameOnCard game={{ id: 'abc', location: null }} isJudge error="" />)
    expect(screen.getByRole('link', { name: 'Open the game →' })).toBeTruthy()
    expect(screen.getByText('AllSport HQ')).toBeTruthy()
  })

  it('shows a join error only when there is one', () => {
    render(<GameOnCard game={{ id: 'abc', location: null }} isJudge={false} error="Code not found" />)
    expect(screen.getByText('Code not found')).toBeTruthy()
    cleanup()
    const { container } = render(<GameOnCard game={{ id: 'abc', location: null }} isJudge={false} error="" />)
    expect(container.textContent).not.toContain('Code not found')
  })
})

describe('NextSessionLine', () => {
  const next = { label: 'Tue 4:30pm', relative: 'in 2 days' }

  it('names the next game and when it is', () => {
    render(<NextSessionLine nextSession={next} firstRun={false} error="" />)
    expect(screen.getByText(/Next game/)).toBeTruthy()
    expect(screen.getByText('Tue 4:30pm')).toBeTruthy()
    expect(screen.getByText('in 2 days')).toBeTruthy()
    expect(screen.queryByText(/Your first game/)).toBeNull()
    // Nothing to tap: it is a line, not a button.
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('calls it your first game for a player who has never played', () => {
    render(<NextSessionLine nextSession={next} firstRun error="" />)
    expect(screen.getByText(/Your first game/)).toBeTruthy()
    expect(screen.queryByText(/Next game/)).toBeNull()
  })

  it('shows a join error under the line', () => {
    render(<NextSessionLine nextSession={next} firstRun={false} error="That game has ended" />)
    expect(screen.getByText('That game has ended')).toBeTruthy()
  })
})

describe('HomeLink', () => {
  it('is a link to where it says', () => {
    render(<HomeLink href="/prs">My events</HomeLink>)
    expect(screen.getByRole('link', { name: 'My events' }).getAttribute('href')).toBe('/prs')
  })
})

describe('TrainingOnCard', () => {
  it('is one button into the session, with the event count', () => {
    render(<TrainingOnCard session={{ id: 'w1', events: 3 }} />)
    expect(screen.getByText(/3 events so far/)).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/workout/w1')
  })
  it('says the kaiwhakawā is setting it up while nothing is planned', () => {
    render(<TrainingOnCard session={{ id: 'w1', events: 0 }} />)
    expect(screen.getByText(/setting it up/)).toBeTruthy()
  })
  it('names the child when a parent is viewing one', () => {
    render(<TrainingOnCard session={{ id: 'w1', events: 1 }} who="Kiri" />)
    expect(screen.getByText(/Kiri: training session/)).toBeTruthy()
    expect(screen.getByText(/1 event so far/)).toBeTruthy()
  })
})
