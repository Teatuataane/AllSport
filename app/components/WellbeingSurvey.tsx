'use client'
// Quarterly wellbeing check-in — WHO-5 + HBSC activity item + self-rated
// fitness + 3 sport-context items (confidence / enjoyment / belonging).
// Shows a dashboard card when a survey is due (first visit, then no more
// than once a quarter); answers stay private to the player — kaiwhakawā only
// ever see aggregates (get_wellbeing_report RPC).
//
// Since v0.68.0.0 (multi-location step 9) the same card also asks who plays,
// for funders (lib/privateProfile.ts): a junior's parent's consent first (a
// junior's check-in waits for a parent's yes), ethnicity for anyone not asked
// at sign-up, and once a year suburb, school (juniors), disability and, once
// ever, "active before AllSport?". All of it private.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { nzYear } from '@/lib/seasonYear'
import {
  EMPTY_PROFILE, aboutYouComplete, aboutYouFrom, aboutYouPayload, cardNeeds, ethnicityAnswered, firstAsk, isJunior,
  type AboutYou, type Ethnicity, type PrivateProfile,
} from '@/lib/privateProfile'
import {
  loadPrivateProfile, loadSchools, loadSuburbs, saveEthnicity, saveJuniorConsent, savePrivateProfile,
  type School, type Suburb,
} from '@/lib/privateProfileData'
import { AboutYouQuestions, ConsentQuestions, EthnicityPicker, type ConsentAnswers } from '@/components/ProfileQuestions'

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

const CARD: React.CSSProperties = {
  background: '#111', border: '1px solid #1e1e1e', borderLeft: '4px solid #B87DB5',
  borderRadius: '16px', padding: '18px 22px', marginBottom: '12px',
}
const CARD_TITLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: '20px', color: '#fff', letterSpacing: '0.05em', lineHeight: 1,
}
const SAVE_BTN = (on: boolean): React.CSSProperties => ({
  background: on ? '#B87DB5' : '#1e1e1e', border: 'none', borderRadius: '999px', color: on ? '#fff' : '#555',
  cursor: on ? 'pointer' : 'default', padding: '10px 20px', minHeight: '44px',
  fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em',
})

type Loaded = {
  /** The check-in is due (first ever, or three months since the last). */
  due: boolean
  lastScore: number | null
  /** The private profile table is live; false = ask only the check-in, as before. */
  live: boolean
  profile: PrivateProfile | null
}

export default function WellbeingSurvey({ playerId, player, isSelf, name }: {
  playerId: string
  /** For the junior rule: turning 16 or under this year. */
  player: { date_of_birth: string | null; division: string | null }
  /** False when a parent is looking at their child's HOME. */
  isSelf: boolean
  name: string
}) {
  const [loaded, setLoaded] = useState<(Loaded & { id: string }) | null>(null)
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<number | 'about' | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [about, setAbout] = useState<AboutYou | null>(null)
  const [ethnicity, setEthnicity] = useState<Ethnicity[]>([])
  const [consent, setConsent] = useState<ConsentAnswers>({ shareWithSchool: null, survey: null })
  const [lists, setLists] = useState<{ suburbs: Suburb[]; schools: School[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let gone = false
    Promise.all([
      supabase
        .from('wellbeing_surveys')
        .select('created_at, who5_cheerful, who5_calm, who5_active, who5_rested, who5_interested')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(1),
      loadPrivateProfile(supabase, playerId),
    ]).then(([{ data, error: err }, { live, profile }]) => {
      if (gone) return
      setOpen(false); setDone(null); setAnswers({}); setError('')
      setEthnicity(profile?.ethnicity ?? [])
      setConsent({ shareWithSchool: profile?.share_with_school ?? null, survey: profile?.survey_consent ?? null })
      setAbout(aboutYouFrom(profile))
      if (err) { setLoaded({ id: playerId, due: false, lastScore: null, live, profile }); return } // table missing
      const last = data?.[0]
      if (!last) { setLoaded({ id: playerId, due: true, lastScore: null, live, profile }); return }
      const score = (last.who5_cheerful + last.who5_calm + last.who5_active + last.who5_rested + last.who5_interested) * 4
      const ageDays = (Date.now() - new Date(last.created_at).getTime()) / 86400000
      setLoaded({ id: playerId, due: ageDays >= DUE_AFTER_DAYS, lastScore: score, live, profile })
    })
    return () => { gone = true }
  }, [playerId])

  const junior = isJunior(player)
  const current = loaded && loaded.id === playerId ? loaded : null
  // Before the migration is live, the card is the check-in alone, as it was.
  const needs = !current ? [] : current.live
    ? cardNeeds({ junior, profile: current.profile, surveyDue: current.due })
    : current.due ? ['survey' as const] : []
  const askAbout = needs.includes('about')
  const askSurvey = needs.includes('survey')
  const you = isSelf ? 'you' : name

  useEffect(() => {
    if (!open || !askAbout) return
    let gone = false
    Promise.all([loadSuburbs(supabase), loadSchools(supabase)]).then(([suburbs, schools]) => {
      if (!gone) setLists({ suburbs, schools })
    })
    return () => { gone = true }
  }, [open, askAbout])

  const allKeys = [...WHO5_ITEMS.map(i => i.key), 'activity_days', 'fitness', ...SPORT_ITEMS.map(i => i.key)]
  const surveyComplete = !askSurvey || allKeys.every(k => answers[k] !== undefined)
  const aboutComplete = !askAbout || (!!about && aboutYouComplete(about, junior, current?.profile ?? null))
  const complete = surveyComplete && aboutComplete

  const afterSave = (patch: Partial<PrivateProfile>, dueNow?: boolean) => {
    if (!current) return
    setLoaded({
      ...current,
      due: dueNow ?? current.due,
      profile: { ...(current.profile ?? EMPTY_PROFILE), ...patch },
    })
  }

  const saveConsent = async () => {
    if (consent.shareWithSchool == null || consent.survey == null || saving) return
    setSaving(true); setError('')
    const err = await saveJuniorConsent(supabase, playerId, consent.shareWithSchool, consent.survey)
    setSaving(false)
    if (err) { setError('Could not save. Try again.'); return }
    afterSave({ share_with_school: consent.shareWithSchool, survey_consent: consent.survey })
  }

  const saveEth = async () => {
    if (!ethnicityAnswered(ethnicity) || saving) return
    setSaving(true); setError('')
    const err = await saveEthnicity(supabase, playerId, ethnicity)
    setSaving(false)
    if (err) { setError('Could not save. Try again.'); return }
    afterSave({ ethnicity })
  }

  const submit = async () => {
    if (!complete || saving || !current) return
    setSaving(true)
    setError('')
    if (askAbout && about) {
      const err = await savePrivateProfile(supabase, playerId, aboutYouPayload(about, junior))
      if (err) { setSaving(false); setError('Could not save. Try again.'); return }
    }
    if (askSurvey) {
      const { error: err } = await supabase.from('wellbeing_surveys').insert({ player_id: playerId, ...answers })
      if (err) { setSaving(false); setError('Could not save. Try again.'); return }
    }
    setSaving(false)
    const score = askSurvey ? WHO5_ITEMS.reduce((s, i) => s + (answers[i.key] ?? 0), 0) * 4 : null
    afterSave(askAbout && about ? {
      ...about,
      active_before: current.profile?.active_before ?? about.active_before,
      confirmed_year: nzYear(),
    } : {}, askSurvey ? false : undefined)
    setAnswers({})
    setOpen(false)
    setDone(score ?? 'about')
  }

  if (done != null) {
    return (
      <div style={CARD}>
        <div style={CARD_TITLE}>Ka pai. Saved</div>
        <div style={{ fontSize: '12px', color: '#888', fontFamily: 'var(--font-label)', marginTop: '6px' }}>
          {typeof done === 'number'
            ? `Wellbeing score ${done}/100 · next check-in in about 3 months. Your answers stay private: only group trends are ever shared.`
            : 'Thanks. These stay private: funders only ever see totals.'}
        </div>
      </div>
    )
  }

  if (needs.length === 0) return null

  // ── A parent's consent for a junior comes first ──────────────────────────
  if (needs[0] === 'consent') {
    const ready = consent.shareWithSchool != null && consent.survey != null
    return (
      <div style={CARD}>
        <div style={CARD_TITLE}>{isSelf ? 'A parent\'s OK' : `${name}: a parent's OK`}</div>
        <div style={{ marginTop: '14px' }}>
          <ConsentQuestions value={consent} onChange={setConsent} childName={name} forChild={!isSelf} />
        </div>
        {error && <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'var(--font-label)', marginTop: '10px' }}>{error}</div>}
        <div style={{ marginTop: '14px' }}>
          <button className="press" onClick={saveConsent} disabled={!ready || saving} style={SAVE_BTN(ready)}>
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </div>
      </div>
    )
  }

  // ── Ethnicity, for anyone not asked at sign-up ───────────────────────────
  if (needs[0] === 'ethnicity') {
    const ready = ethnicityAnswered(ethnicity)
    return (
      <div style={CARD}>
        <div style={CARD_TITLE}>One question</div>
        <div style={{ marginTop: '14px' }}>
          <EthnicityPicker value={ethnicity} onChange={setEthnicity}
            heading={isSelf ? 'Which ethnic group do you belong to?' : `Which ethnic group does ${name} belong to?`} />
        </div>
        {error && <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'var(--font-label)', marginTop: '10px' }}>{error}</div>}
        <div style={{ marginTop: '14px' }}>
          <button className="press" onClick={saveEth} disabled={!ready || saving} style={SAVE_BTN(ready)}>
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </div>
      </div>
    )
  }

  const lastScore = current?.lastScore ?? null
  if (!open) {
    return (
      <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <div>
              <div style={CARD_TITLE}>
                {askSurvey ? 'Wellbeing check-in' : 'A few questions'}
              </div>
              <div style={{ fontSize: '12px', color: '#777', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', marginTop: '4px' }}>
                {!askSurvey ? 'Once a year · about 30 seconds'
                  : lastScore === null ? 'A few quick questions · about 2 minutes' : 'Quarterly check-in due · 90 seconds'}
              </div>
            </div>
            <button className="press" onClick={() => setOpen(true)} style={{
              background: '#B87DB5', border: 'none', borderRadius: '999px', color: '#fff',
              cursor: 'pointer', padding: '10px 20px', flexShrink: 0,
              fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em',
            }}>
              START
            </button>
          </div>
      </div>
    )
  }

  // Open: full-screen
  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
        background: '#0a0a0a', borderBottom: '1px solid #222', padding: '14px 16px',
      }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', lineHeight: 1, color: '#fff' }}>
              {askSurvey ? 'Wellbeing Check-in' : 'About you'}
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginTop: '1px' }}>
              PRIVATE — ONLY GROUP TRENDS ARE SHARED
            </div>
          </div>
          <button className="press" onClick={() => setOpen(false)} style={{
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

          {askAbout && about && (
            <>
              <div style={{ ...LBL, marginTop: 0 }}>About {you === 'you' ? 'you' : name}</div>
              {lists ? (
                <AboutYouQuestions
                  value={about} onChange={setAbout} suburbs={lists.suburbs} schools={lists.schools}
                  junior={junior} askActiveBefore={!current?.profile?.active_before}
                  stillRight={!firstAsk(current?.profile ?? null)} name={you}
                />
              ) : (
                <div style={{ fontSize: '13px', color: '#777' }}>Loading…</div>
              )}
            </>
          )}

          {askSurvey && (<>
          <div style={{ ...LBL, marginTop: askAbout ? 28 : 0 }}>Over the last two weeks…</div>
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
          </>)}

          {error && <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'var(--font-label)', marginBottom: '10px' }}>{error}</div>}

          <button onClick={submit} disabled={!complete || saving} style={{
            width: '100%', minHeight: '52px', borderRadius: '999px', border: 'none',
            background: complete ? '#B87DB5' : '#1e1e1e',
            color: complete ? '#fff' : '#555', cursor: complete ? 'pointer' : 'default',
            fontFamily: 'var(--font-label)', fontSize: '15px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {saving ? 'Saving…' : complete ? (askSurvey ? 'Submit check-in' : 'Save') : 'Answer every question'}
          </button>
        </div>
      </div>
    </>
  )
}
