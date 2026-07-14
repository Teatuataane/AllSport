'use client'
// Quarterly wellbeing check-in — WHO-5 + HBSC activity item + self-rated
// fitness + 3 sport-context items (confidence / enjoyment / belonging).
// Shows a dashboard card when a survey is due (first visit, then no more
// than once a quarter); answers stay private to the player — kaiwhakawā only
// ever see aggregates (get_wellbeing_report RPC).
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

const DUE_AFTER_DAYS = 91 // quarterly

const WHO5_ITEMS = [
  { key: 'who5_cheerful', text: 'I have felt cheerful and in good spirits' },
  { key: 'who5_calm', text: 'I have felt calm and relaxed' },
  { key: 'who5_active', text: 'I have felt active and vigorous' },
  { key: 'who5_rested', text: 'I woke up feeling fresh and rested' },
  { key: 'who5_interested', text: 'My daily life has been filled with things that interest me' },
] as const

const WHO5_SCALE = ['At no time', 'Some of the time', 'Less than half the time', 'More than half the time', 'Most of the time', 'All of the time']

const SPORT_ITEMS = [
  { key: 'confidence', text: 'I feel confident giving new sports and activities a go' },
  { key: 'enjoyment', text: 'I enjoy taking part in AllSport sessions' },
  { key: 'belonging', text: 'I feel like I belong at AllSport' },
] as const

const AGREE_SCALE = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']
const FITNESS_SCALE = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']

type Answers = Record<string, number>

const LBL: React.CSSProperties = {
  fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.15em',
  textTransform: 'uppercase', color: '#B87DB5', margin: '18px 0 8px',
}

function ScaleRow({ labels, offset, value, onPick }: {
  labels: string[]; offset: number; value: number | undefined; onPick: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '5px' }}>
      {labels.map((l, i) => {
        const v = i + offset
        const active = value === v
        return (
          <button key={l} onClick={() => onPick(v)} title={l} style={{
            flex: 1, minHeight: '40px', borderRadius: '8px', cursor: 'pointer',
            border: `1px solid ${active ? '#B87DB5' : '#2a2a2a'}`,
            background: active ? '#B87DB533' : '#141414',
            color: active ? '#fff' : '#777',
            fontFamily: 'var(--font-label)', fontSize: '11px', lineHeight: 1.15, padding: '4px 2px',
          }}>
            {l}
          </button>
        )
      })}
    </div>
  )
}

export default function WellbeingSurvey({ playerId }: { playerId: string }) {
  const [state, setState] = useState<'loading' | 'due' | 'notDue' | 'open' | 'done'>('loading')
  const [lastScore, setLastScore] = useState<number | null>(null) // last WHO-5 0–100
  const [answers, setAnswers] = useState<Answers>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setState('loading')
    supabase
      .from('wellbeing_surveys')
      .select('created_at, who5_cheerful, who5_calm, who5_active, who5_rested, who5_interested')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error: err }) => {
        if (err) { setState('notDue'); return } // table missing → stay silent
        const last = data?.[0]
        if (!last) { setState('due'); setLastScore(null); return }
        const score = (last.who5_cheerful + last.who5_calm + last.who5_active + last.who5_rested + last.who5_interested) * 4
        setLastScore(score)
        const ageDays = (Date.now() - new Date(last.created_at).getTime()) / 86400000
        setState(ageDays >= DUE_AFTER_DAYS ? 'due' : 'notDue')
      })
  }, [playerId])

  const allKeys = [...WHO5_ITEMS.map(i => i.key), 'activity_days', 'fitness', ...SPORT_ITEMS.map(i => i.key)]
  const complete = allKeys.every(k => answers[k] !== undefined)

  const submit = async () => {
    if (!complete || saving) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('wellbeing_surveys').insert({ player_id: playerId, ...answers })
    setSaving(false)
    if (err) { setError('Could not save — try again.'); return }
    const score = WHO5_ITEMS.reduce((s, i) => s + (answers[i.key] ?? 0), 0) * 4
    setLastScore(score)
    setAnswers({})
    setState('done')
  }

  if (state === 'loading' || state === 'notDue') return null

  if (state === 'due' || state === 'done') {
    return (
      <div style={{
        background: '#111', border: '1px solid #1e1e1e', borderLeft: '4px solid #B87DB5',
        borderRadius: '16px', padding: '18px 22px', marginBottom: '12px',
      }}>
        {state === 'done' ? (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#fff', letterSpacing: '0.05em', lineHeight: 1 }}>
              Ka pai — check-in saved
            </div>
            <div style={{ fontSize: '12px', color: '#888', fontFamily: 'var(--font-label)', marginTop: '6px' }}>
              Wellbeing score {lastScore}/100 · next check-in in about 3 months. Your answers stay private — only group trends are ever shared.
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#fff', letterSpacing: '0.05em', lineHeight: 1 }}>
                Wellbeing check-in
              </div>
              <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', marginTop: '4px' }}>
                {lastScore === null ? '10 quick questions · about 90 seconds' : 'Quarterly check-in due · 90 seconds'}
              </div>
            </div>
            <button onClick={() => setState('open')} style={{
              background: '#B87DB5', border: 'none', borderRadius: '999px', color: '#fff',
              cursor: 'pointer', padding: '10px 20px', flexShrink: 0,
              fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em',
            }}>
              START
            </button>
          </div>
        )}
      </div>
    )
  }

  // state === 'open' — full-screen survey
  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
        background: '#0a0a0a', borderBottom: '1px solid #222', padding: '14px 16px',
      }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', lineHeight: 1, color: '#fff' }}>
              Wellbeing Check-in
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginTop: '1px' }}>
              PRIVATE — ONLY GROUP TRENDS ARE SHARED
            </div>
          </div>
          <button onClick={() => setState('due')} style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px',
            color: '#ccc', cursor: 'pointer', padding: '10px 18px',
            fontFamily: 'var(--font-label)', fontSize: '14px', fontWeight: 700, minHeight: '44px',
          }}>
            ← Back
          </button>
        </div>
      </div>

      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.97)', zIndex: 1050, overflowY: 'auto', paddingTop: '72px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 16px 60px' }}>

          <div style={{ ...LBL, marginTop: 0 }}>Over the last two weeks…</div>
          {WHO5_ITEMS.map(item => (
            <div key={item.key} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14.5px', color: '#ddd', fontFamily: 'var(--font-body)', marginBottom: '7px' }}>{item.text}</div>
              <ScaleRow labels={WHO5_SCALE} offset={0} value={answers[item.key]} onPick={v => setAnswers(a => ({ ...a, [item.key]: v }))} />
            </div>
          ))}

          <div style={LBL}>Activity</div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14.5px', color: '#ddd', fontFamily: 'var(--font-body)', marginBottom: '7px' }}>
              In the past 7 days, on how many days were you physically active for at least 60 minutes in total?
            </div>
            <ScaleRow labels={['0', '1', '2', '3', '4', '5', '6', '7']} offset={0} value={answers.activity_days} onPick={v => setAnswers(a => ({ ...a, activity_days: v }))} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14.5px', color: '#ddd', fontFamily: 'var(--font-body)', marginBottom: '7px' }}>
              In general, how would you describe your physical fitness?
            </div>
            <ScaleRow labels={FITNESS_SCALE} offset={1} value={answers.fitness} onPick={v => setAnswers(a => ({ ...a, fitness: v }))} />
          </div>

          <div style={LBL}>Sport &amp; AllSport</div>
          {SPORT_ITEMS.map(item => (
            <div key={item.key} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14.5px', color: '#ddd', fontFamily: 'var(--font-body)', marginBottom: '7px' }}>{item.text}</div>
              <ScaleRow labels={AGREE_SCALE} offset={1} value={answers[item.key]} onPick={v => setAnswers(a => ({ ...a, [item.key]: v }))} />
            </div>
          ))}

          {error && <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'var(--font-label)', marginBottom: '10px' }}>{error}</div>}

          <button onClick={submit} disabled={!complete || saving} style={{
            width: '100%', minHeight: '52px', borderRadius: '999px', border: 'none',
            background: complete ? '#B87DB5' : '#1e1e1e',
            color: complete ? '#fff' : '#555', cursor: complete ? 'pointer' : 'default',
            fontFamily: 'var(--font-label)', fontSize: '15px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {saving ? 'Saving…' : complete ? 'Submit check-in' : `Answer all ${allKeys.length} questions`}
          </button>
        </div>
      </div>
    </>
  )
}
