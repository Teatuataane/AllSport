// @vitest-environment jsdom
//
// The Standards panel is behind a login in both places it appears, so this is
// what would notice it showing the wrong ladder, losing its bodyweight prompt,
// or marking the wrong colour as next.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import StandardsLadderView from '@/components/play/StandardsLadderView'
import { getEventBySlug } from '@/lib/eventData'

afterEach(cleanup)

const player = { division: "Men's", ageYears: 30, gender: null }

describe('StandardsLadderView', () => {
  it('lists the ladder and marks the colour above the one reached as next', () => {
    render(<StandardsLadderView ev={getEventBySlug('high-jump')} player={player} bodyweightKg={null} reached={2} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(12)
    const next = screen.getByText('NEXT').closest('[role="listitem"]')!
    expect(next.textContent).toContain('Karaka')
  })

  it('asks for a bodyweight on a lift, and shows the ratio meanwhile', () => {
    render(<StandardsLadderView ev={getEventBySlug('deadlift')} player={player} bodyweightKg={null}
      bodyweightPrompt={<span>WEIGH-IN</span>} />)
    expect(screen.getByText('WEIGH-IN')).toBeTruthy()
    expect(screen.getByText('0.56× bodyweight')).toBeTruthy()
  })

  it('shows kilograms and where the weight came from once there is a bodyweight', () => {
    render(<StandardsLadderView ev={getEventBySlug('deadlift')} player={player} bodyweightKg={80}
      bodyweightNote="at 80 kg, 2 Oct" bodyweightPrompt={<span>WEIGH-IN</span>} />)
    expect(screen.queryByText('WEIGH-IN')).toBeNull()
    expect(screen.getByText('0.56× bodyweight · 45 kg')).toBeTruthy()
    expect(screen.getByText(/at 80 kg, 2 Oct/)).toBeTruthy()
  })

  it('does not ask for a bodyweight on an event that is not a lift', () => {
    render(<StandardsLadderView ev={getEventBySlug('high-jump')} player={player} bodyweightKg={null}
      bodyweightPrompt={<span>WEIGH-IN</span>} />)
    expect(screen.queryByText('WEIGH-IN')).toBeNull()
  })

  it('says a rating-only event is graded on games', () => {
    render(<StandardsLadderView ev={getEventBySlug('wrestling')} player={player} bodyweightKg={null} />)
    expect(screen.getByText(/graded on games/)).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })

  it('renders nothing without a player', () => {
    const { container } = render(<StandardsLadderView ev={getEventBySlug('high-jump')} player={null} bodyweightKg={null} />)
    expect(container.textContent).toBe('')
  })
})
