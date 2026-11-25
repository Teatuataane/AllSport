'use client'
// ─── Who plays: the questions ────────────────────────────────────────────────
// Props only, so they can be tested (__tests__/profileQuestions.test.tsx).
// Used by sign-up (ethnicity, a junior's consent) and the wellbeing check-in
// card on HOME (all of them). Rules in lib/privateProfile.ts.

import { useState } from 'react'
import {
  ELSEWHERE, ETHNICITIES, searchList, toggleEthnicity,
  type AboutYou, type Disability, type Ethnicity, type SchoolStatus, type YesNo,
} from '@/lib/privateProfile'

const LABEL: React.CSSProperties = {
  fontSize: '12px', color: 'var(--grey)', display: 'block', marginBottom: '6px',
  fontFamily: 'var(--font-label)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
}
const HINT: React.CSSProperties = { fontSize: '12px', color: 'var(--grey)', marginTop: '6px', lineHeight: 1.6 }

function Chip({ on, children, onClick, label }: { on: boolean; children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" className="press" onClick={onClick} aria-pressed={on} aria-label={label} style={{
      padding: '9px 14px', borderRadius: '999px', cursor: 'pointer', minHeight: '40px',
      fontFamily: 'var(--font-label)', fontSize: '14px', fontWeight: 600,
      background: on ? 'var(--blue)' : 'var(--surface)',
      color: on ? 'var(--white)' : 'var(--grey-light)',
      border: `1px solid ${on ? 'var(--blue)' : 'var(--border-strong)'}`,
    }}>
      {children}
    </button>
  )
}

// ── Ethnicity ────────────────────────────────────────────────────────────────
export function EthnicityPicker({ value, onChange, heading = 'Which ethnic group do you belong to?' }: {
  value: Ethnicity[]; onChange: (v: Ethnicity[]) => void; heading?: string
}) {
  return (
    <div>
      <span style={LABEL}>{heading}</span>
      <div role="group" aria-label={heading} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {ETHNICITIES.map(e => (
          <Chip key={e.value} on={value.includes(e.value)} onClick={() => onChange(toggleEthnicity(value, e.value))}>
            {e.label}
          </Chip>
        ))}
      </div>
      <div style={HINT}>
        Tick all that apply. It stays private: funders only ever see totals, never your name. If you erase your account, only the broad group stays in those totals.
      </div>
    </div>
  )
}

// ── A yes / no question ──────────────────────────────────────────────────────
function YesNoRow<T extends string>({ question, value, options, onChange }: {
  question: string; value: T | null; options: readonly (readonly [T, string])[]; onChange: (v: T) => void
}) {
  return (
    <div>
      <div style={{ fontSize: '15px', color: 'var(--white)', marginBottom: '8px', lineHeight: 1.5 }}>{question}</div>
      <div role="group" aria-label={question} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map(([v, label]) => (
          <Chip key={v} on={value === v} onClick={() => onChange(v)}>{label}</Chip>
        ))}
      </div>
    </div>
  )
}

const YES_NO = [['yes', 'Yes'], ['no', 'No']] as const

// ── A junior's consent ───────────────────────────────────────────────────────
export type ConsentAnswers = { shareWithSchool: boolean | null; survey: boolean | null }

/**
 * The two questions a parent answers for a junior. `forChild` words it for a
 * parent on their own login; otherwise the junior is asked to answer with a
 * parent beside them.
 */
export function ConsentQuestions({ value, onChange, childName, forChild }: {
  value: ConsentAnswers; onChange: (v: ConsentAnswers) => void; childName: string; forChild: boolean
}) {
  const yn = (b: boolean | null): YesNo | null => (b == null ? null : b ? 'yes' : 'no')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {!forChild && (
        <div style={{ ...HINT, marginTop: 0, color: 'var(--grey-light)' }}>
          For a parent or guardian. Please answer these with a parent beside you.
        </div>
      )}
      <YesNoRow
        question={`Share ${childName}'s attendance with their school?`}
        value={yn(value.shareWithSchool)} options={YES_NO}
        onChange={v => onChange({ ...value, shareWithSchool: v === 'yes' })}
      />
      <YesNoRow
        question={`May ${childName} do the wellbeing check-in? A few questions about how they feel, every three months. Only totals are ever shared.`}
        value={yn(value.survey)} options={YES_NO}
        onChange={v => onChange({ ...value, survey: v === 'yes' })}
      />
    </div>
  )
}

// ── Search a list ────────────────────────────────────────────────────────────
type Pickable = { key: string; name: string; place?: string | null; area?: string | null }

function SearchPick({ label, items, value, onPick, placeholder }: {
  label: string; items: readonly Pickable[]; value: Pickable | null; onPick: (key: string) => void; placeholder: string
}) {
  const [q, setQ] = useState('')
  const hits = searchList(items, q, 8)
  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '15px', color: 'var(--white)' }}>
          {value.name}{value.place || value.area ? <span style={{ color: 'var(--grey)' }}> · {value.place ?? value.area}</span> : null}
        </div>
        <button type="button" className="press" onClick={() => { setQ(''); onPick('') }} aria-label={`Change ${label}`} style={{
          background: 'none', border: '1px solid var(--border-strong)', borderRadius: '999px', color: 'var(--grey-light)',
          padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: '13px',
        }}>Change</button>
      </div>
    )
  }
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} aria-label={label} style={{
        width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: '10px',
        padding: '12px 14px', color: 'var(--white)', fontSize: '16px', boxSizing: 'border-box',
      }} />
      {hits.length > 0 && (
        <ul role="listbox" aria-label={label} style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {hits.map(h => (
            <li key={h.key}>
              <button type="button" role="option" aria-selected={false} className="press" onClick={() => onPick(h.key)} style={{
                width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
                color: 'var(--white)', padding: '10px 12px', cursor: 'pointer', fontSize: '15px',
              }}>
                {h.name}{h.place || h.area ? <span style={{ color: 'var(--grey)' }}> · {h.place ?? h.area}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── About you: suburb, school, disability, active before ────────────────────
export function AboutYouQuestions({
  value, onChange, suburbs, schools, junior, askActiveBefore, stillRight, name,
}: {
  value: AboutYou
  onChange: (v: AboutYou) => void
  suburbs: readonly { id: string; name: string; area: string | null }[]
  schools: readonly { id: number; name: string; place: string | null }[]
  junior: boolean
  /** "Active before AllSport?" is asked once, ever. */
  askActiveBefore: boolean
  /** A later year: the answers are last year's, shown to confirm. */
  stillRight: boolean
  /** "you", or a child's name when a parent answers. */
  name: string
}) {
  const you = name === 'you'
  const suburbItems = suburbs.filter(s => s.id !== ELSEWHERE).map(s => ({ key: s.id, name: s.name, area: s.area }))
  const schoolItems = schools.map(s => ({ key: String(s.id), name: s.name, place: s.place }))
  const suburbPicked = value.suburb_id && value.suburb_id !== ELSEWHERE
    ? suburbItems.find(s => s.key === value.suburb_id) ?? { key: value.suburb_id, name: 'Your suburb' }
    : null
  const schoolPicked = value.school_status === 'listed' && value.school_id != null
    ? schoolItems.find(s => s.key === String(value.school_id)) ?? { key: String(value.school_id), name: 'Your school' }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {stillRight && (
        <div style={{ ...HINT, marginTop: 0, color: 'var(--grey-light)' }}>
          A new year. Still right? Change anything that has moved.
        </div>
      )}

      <div>
        <span style={LABEL}>{you ? 'Which suburb do you live in?' : `Which suburb does ${name} live in?`}</span>
        {value.suburb_id === ELSEWHERE ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Chip on onClick={() => onChange({ ...value, suburb_id: null })}>Somewhere else</Chip>
          </div>
        ) : (
          <>
            <SearchPick label="Suburb" items={suburbItems} value={suburbPicked} placeholder="Start typing your suburb"
              onPick={k => onChange({ ...value, suburb_id: k || null })} />
            {!suburbPicked && (
              <div style={{ marginTop: '8px' }}>
                <Chip on={false} onClick={() => onChange({ ...value, suburb_id: ELSEWHERE })}>Somewhere else</Chip>
              </div>
            )}
          </>
        )}
      </div>

      {junior && (
        <div>
          <span style={LABEL}>{you ? 'Which school do you go to?' : `Which school does ${name} go to?`}</span>
          {value.school_status === 'listed' || value.school_status == null ? (
            <SearchPick label="School" items={schoolItems} value={schoolPicked} placeholder="Start typing the school"
              onPick={k => onChange(k
                ? { ...value, school_status: 'listed', school_id: Number(k) }
                : { ...value, school_status: null, school_id: null })} />
          ) : null}
          {!schoolPicked && (
            <div role="group" aria-label="Not on the list" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              {([['other', 'Other school'], ['none', 'Not at school']] as const).map(([v, l]) => (
                <Chip key={v} on={value.school_status === v} onClick={() => onChange({
                  ...value, school_id: null, school_status: (value.school_status === v ? null : v) as SchoolStatus | null,
                })}>{l}</Chip>
              ))}
            </div>
          )}
        </div>
      )}

      <YesNoRow<Disability>
        question={you
          ? 'Do you have a disability? (Optional)'
          : `Does ${name} have a disability? (Optional)`}
        value={value.disability}
        options={[['yes', 'Yes'], ['no', 'No'], ['prefer_not', 'Prefer not to say']]}
        onChange={v => onChange({ ...value, disability: value.disability === v ? null : v })}
      />

      {askActiveBefore && (
        <YesNoRow<YesNo>
          question={you
            ? 'Before AllSport, were you active most weeks?'
            : `Before AllSport, was ${name} active most weeks?`}
          value={value.active_before} options={YES_NO}
          onChange={v => onChange({ ...value, active_before: v })}
        />
      )}
    </div>
  )
}
