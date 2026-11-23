// @vitest-environment jsdom
//
// ── Who plays: the questions (multi-location step 9) ────────────────────────
// What this pins:
//   1. Ethnicity: ticking "Prefer not to say" clears the rest.
//   2. A junior's consent asks both questions, worded for the parent.
//   3. About you: suburb by search or "Somewhere else", school for juniors
//      only, "active before" only when asked, "Still right?" in a later year.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { AboutYouQuestions, ConsentQuestions, EthnicityPicker } from '@/components/ProfileQuestions'
import type { AboutYou } from '@/lib/privateProfile'

afterEach(cleanup)

describe('EthnicityPicker', () => {
  it('lets "Prefer not to say" clear the other boxes', () => {
    const onChange = vi.fn()
    render(<EthnicityPicker value={['maori', 'samoan']} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Māori' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Prefer not to say' }))
    expect(onChange).toHaveBeenCalledWith(['prefer_not'])
  })
})

describe('ConsentQuestions', () => {
  it('asks both questions for the child by name', () => {
    const onChange = vi.fn()
    render(<ConsentQuestions value={{ shareWithSchool: null, survey: null }} onChange={onChange} childName="Aroha" forChild />)
    const school = screen.getByRole('group', { name: /Share Aroha's attendance/ })
    fireEvent.click(school.querySelectorAll('button')[0])
    expect(onChange).toHaveBeenCalledWith({ shareWithSchool: true, survey: null })
    const survey = screen.getByRole('group', { name: /May Aroha do the wellbeing check-in/ })
    fireEvent.click(survey.querySelectorAll('button')[1])
    expect(onChange).toHaveBeenLastCalledWith({ shareWithSchool: null, survey: false })
  })

  it('asks a junior on their own login to answer with a parent beside them', () => {
    render(<ConsentQuestions value={{ shareWithSchool: null, survey: null }} onChange={() => {}} childName="Aroha" forChild={false} />)
    expect(screen.getByText(/with a parent beside you/)).toBeTruthy()
  })
})

describe('AboutYouQuestions', () => {
  const suburbs = [
    { id: 'elsewhere', name: 'Somewhere else', area: null },
    { id: '1', name: 'Woolston', area: 'Christchurch City' },
    { id: '2', name: 'Sockburn', area: 'Christchurch City' },
  ]
  const schools = [{ id: 333, name: 'Burnside High School', place: 'Burnside' }]
  const blank: AboutYou = { suburb_id: null, school_status: null, school_id: null, disability: null, active_before: null }
  const base = { suburbs, schools, askActiveBefore: true, stillRight: false, name: 'you' }

  it('finds a suburb by typing, or takes "Somewhere else"', () => {
    const onChange = vi.fn()
    render(<AboutYouQuestions {...base} value={blank} onChange={onChange} junior={false} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Suburb' }), { target: { value: 'sock' } })
    fireEvent.click(screen.getByRole('option', { name: /Sockburn/ }))
    expect(onChange).toHaveBeenLastCalledWith({ ...blank, suburb_id: '2' })
    fireEvent.click(screen.getByRole('button', { name: 'Somewhere else' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...blank, suburb_id: 'elsewhere' })
  })

  it('asks a school of juniors only', () => {
    const { rerender } = render(<AboutYouQuestions {...base} value={blank} onChange={() => {}} junior={false} />)
    expect(screen.queryByRole('textbox', { name: 'School' })).toBeNull()
    rerender(<AboutYouQuestions {...base} value={blank} onChange={() => {}} junior />)
    expect(screen.getByRole('textbox', { name: 'School' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Not at school' })).toBeTruthy()
  })

  it('asks "active before" only when told to, and says "Still right?" in a later year', () => {
    render(<AboutYouQuestions {...base} value={{ ...blank, suburb_id: '1' }} onChange={() => {}} junior={false}
      askActiveBefore={false} stillRight />)
    expect(screen.queryByText(/Before AllSport/)).toBeNull()
    expect(screen.getByText(/Still right\?/)).toBeTruthy()
    expect(screen.getByText('Woolston')).toBeTruthy()
  })
})
