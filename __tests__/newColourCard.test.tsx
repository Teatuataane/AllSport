// @vitest-environment jsdom
//
// The new-colour card is the moment auto-conferral produces, and it sits behind
// a login on two pages — so rendering it here is the only way it gets looked at.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewColourCard from '@/components/NewColourCard'
import type { AwardLike } from '@/lib/newColours'

const award = (domain_number: number, rung: number, grade_name: string): AwardLike =>
  ({ domain_number, rung, grade_name, conferred_at: '2026-09-21T00:00:00Z' })

afterEach(cleanup)

describe('NewColourCard', () => {
  it('renders nothing when there is no news', () => {
    const { container } = render(<NewColourCard awards={[]} onDismiss={() => {}} />)
    // jest-dom is not installed; the plain assertion says the same thing.
    expect(container.innerHTML).toBe('')
  })

  it('names the colour and the domain it was earned in', () => {
    render(<NewColourCard awards={[award(3, 4, 'Kōwhai')]} onDismiss={() => {}} />)
    expect(screen.getByText('Kōwhai')).toBeTruthy()
    expect(screen.getByText('in Power')).toBeTruthy()
    expect(screen.getByText('New colour')).toBeTruthy()
  })

  it('shows the stored name, not the current ladder name', () => {
    // An award snapshots what the colour was called when it was conferred, so
    // a later rename never rewrites someone's history.
    render(<NewColourCard awards={[award(1, 1, 'Some Old Name')]} onDismiss={() => {}} />)
    expect(screen.getByText('Some Old Name')).toBeTruthy()
  })

  it('pluralises when several land at once', () => {
    render(<NewColourCard awards={[award(1, 1, 'Kiwikiwi'), award(2, 1, 'Kiwikiwi')]} onDismiss={() => {}} />)
    expect(screen.getByText('2 new colours')).toBeTruthy()
  })

  it('dismisses', async () => {
    const onDismiss = vi.fn()
    render(<NewColourCard awards={[award(1, 1, 'Kiwikiwi')]} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByText('Got it'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('gives the dismiss control a 44px target', async () => {
    render(<NewColourCard awards={[award(1, 1, 'Kiwikiwi')]} onDismiss={() => {}} />)
    expect((screen.getByText('Got it') as HTMLElement).style.minHeight).toBe('44px')
  })
})

describe('a colour taken back', () => {
  const taken = { domain_number: 3, rung: 4, grade_name: 'Kōwhai', withdrawn_at: '2026-09-21T00:00:00Z', reason: 'Deadlift: 200kg × 1 was removed.' }

  it('is told plainly: names the colour, the domain and why', () => {
    render(<NewColourCard awards={[]} withdrawn={[taken]} onDismiss={() => {}} />)
    expect(screen.getByText('Kōwhai')).toBeTruthy()
    expect(screen.getByText(/in Power was/)).toBeTruthy()
    expect(screen.getByText(taken.reason)).toBeTruthy()
    expect(screen.getByText('Colours updated')).toBeTruthy()
  })

  it('is never a celebration in reverse: no rainbow stripe', () => {
    const { container } = render(<NewColourCard awards={[]} withdrawn={[taken]} onDismiss={() => {}} />)
    // The stripe is the only element that paints the rainbow.
    expect(container.innerHTML).not.toMatch(/linear-gradient|var\(--rainbow\)/)
  })

  it('still celebrates a new colour that arrives alongside a withdrawal', () => {
    const { container } = render(
      <NewColourCard awards={[award(1, 1, 'Kiwikiwi')]} withdrawn={[taken]} onDismiss={() => {}} />,
    )
    expect(screen.getByText('New colour')).toBeTruthy()
    // The same check that must FAIL for a withdrawal-only card must pass here,
    // or the test above could be passing because the stripe never renders.
    expect(container.innerHTML).toMatch(/linear-gradient|var\(--rainbow\)/)
  })
})

describe('a withdrawal alongside a new colour', () => {
  it('is told in its own card, never inside the celebration', () => {
    const taken = { domain_number: 3, rung: 4, grade_name: 'Kōwhai', withdrawn_at: '2026-09-21T00:00:00Z', reason: null }
    const { container } = render(
      <NewColourCard awards={[award(1, 1, 'Kiwikiwi')]} withdrawn={[taken]} onDismiss={() => {}} />,
    )
    const celebration = container.querySelector('[data-card="new-colours"]')!
    const quiet = container.querySelector('[data-card="withdrawn"]')!
    expect(celebration.textContent).not.toMatch(/taken back/)
    expect(quiet.textContent).toMatch(/Kōwhai in Power was/)
    expect(quiet.innerHTML).not.toMatch(/linear-gradient|var\(--rainbow\)/)
  })

  it('dismisses both with either button, because they share one watermark', async () => {
    const onDismiss = vi.fn()
    const taken = { domain_number: 3, rung: 4, grade_name: 'Kōwhai', withdrawn_at: '2026-09-21T00:00:00Z', reason: null }
    render(<NewColourCard awards={[award(1, 1, 'Kiwikiwi')]} withdrawn={[taken]} onDismiss={onDismiss} />)
    const buttons = screen.getAllByText('Got it')
    expect(buttons).toHaveLength(2)
    await userEvent.click(buttons[1])
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

describe('reading order', () => {
  it('puts the withdrawal first, so it is not dismissed unread by answering the celebration', () => {
    const taken = { domain_number: 3, rung: 4, grade_name: 'Kōwhai', withdrawn_at: '2026-09-21T00:00:00Z', reason: null }
    const { container } = render(<NewColourCard awards={[award(1, 1, 'Kiwikiwi')]} withdrawn={[taken]} onDismiss={() => {}} />)
    const cards = [...container.querySelectorAll('[data-card]')].map(c => c.getAttribute('data-card'))
    expect(cards).toEqual(['withdrawn', 'new-colours'])
  })

  it('names what each Got it dismisses, for a screen reader', () => {
    const taken = { domain_number: 3, rung: 4, grade_name: 'Kōwhai', withdrawn_at: '2026-09-21T00:00:00Z', reason: null }
    render(<NewColourCard awards={[award(1, 1, 'Kiwikiwi')]} withdrawn={[taken]} onDismiss={() => {}} />)
    // Both start with the visible "Got it" (so voice control finds them) and
    // say that one tap clears both notices, because it does.
    expect(screen.getAllByLabelText('Got it, dismiss both notices')).toHaveLength(2)
  })
})

describe('a lone card', () => {
  it('names only itself when there is nothing else to dismiss', () => {
    render(<NewColourCard awards={[award(1, 1, 'Kiwikiwi')]} onDismiss={() => {}} />)
    expect(screen.getByLabelText('Got it, dismiss New colour')).toBeTruthy()
  })
})
