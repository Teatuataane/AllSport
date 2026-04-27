'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getEventByName, type EventData } from '@/lib/eventData'

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type InputMode =
  | 'strength'      // weight kg + optional reps  → raw = weight
  | 'reps'          // reps only                  → raw = reps
  | 'time'          // mm:ss, lower = better      → raw = -totalSecs
  | 'hold'          // mm:ss, longer = better     → raw = +totalSecs
  | 'distance'      // value + m/cm toggle        → raw = cm
  | 'flexibility'   // blocks (lower = better)    → raw = -blocks
  | 'sport'         // win/draw/loss + score       → raw = 2/1/0
  | 'weight+time'   // weight + mm:ss             → raw = -totalSecs
  | 'distance+time' // distance + mm:ss           → raw = distance cm
  | 'sprint'        // ss.cs (seconds + centiseconds), lower = better → raw = -(secs*100 + cs)
  | 'dynamic'       // variation suffix drives mode: "/ Hold" → hold, "/ Reps" → reps

type EventConfig = {
  mode: InputMode
  variations?: string[]
  freeVariation?: boolean
  orderedVariations?: boolean
  tierBasedScoring?: boolean  // tier × 10000 + time is the raw_score (Breakdancing, Standing Split)
}

type SessionEvent = {
  id: string
  domain_number: number
  domain_name: string
  event_name: string
}

type Result = {
  id: string
  player_name: string
  player_id: string | null
  event_id: string
  raw_score: number
  adjusted_score?: number | null
  score_label: string
  result_type?: string
  opponent_name?: string
  match_score?: string
  difficulty_tier?: string | null
  disadvantage_type?: string | null
  disadvantage_option?: string | null
}

type Standing = {
  player_name: string
  player_id: string | null
  total_placement: number
  events_done: number
  placements: { [eventId: string]: number }
}

type DivisionTab = 'overall' | 'mens' | 'womens' | 'juniors'

// ─── Per-event config ─────────────────────────────────────────────────────────
// Keys match the event_name stored in session_events (set by scoring/page.tsx DOMAINS).

const EVENT_CONFIG: Record<string, EventConfig> = {
  // Maximal Strength
  '1 Arm Press':       { mode: 'strength' },
  'Deadlift':          { mode: 'strength' },
  'Overhead Press':    { mode: 'strength' },
  'Pause Dips':        { mode: 'strength' },
  'Pause Chin Up':     { mode: 'strength' },
  'Pause Squat':       { mode: 'strength' },
  'Zercher Deadlift':  { mode: 'strength' },
  'Hamstring Curl':    { mode: 'strength' },
  'Pause Bench Press': { mode: 'strength' },
  'Turkish Get-Up':    { mode: 'strength' },

  // Relative Strength
  '1 Leg Squat': {
    mode: 'reps',
    variations: ['Assisted Lunge', 'Lunge', 'Bulgarian Split Squat', 'Shrimp Squat', 'Pistol Squat', 'Dragon Squat'],
    orderedVariations: true,
  },
  'Flag': {
    mode: 'dynamic',
    variations: ['Side Plank / Hold', '1 Leg Side Plank / Hold', 'Partial Flag / Hold', 'Full Flag / Hold', 'Jumping Side Plank / Reps'],
    orderedVariations: true,
  },
  'Windshield Wipers': { mode: 'reps' },
  'Toe Lift':          { mode: 'reps' },
  'Planche': {
    mode: 'dynamic',
    variations: ['Tuck / Hold', 'Straddle / Hold', 'Full / Hold', 'Tuck / Reps', 'Straddle / Reps', 'Full / Reps'],
    orderedVariations: true,
  },
  'Back Lever': {
    mode: 'dynamic',
    variations: ['Tuck / Hold', 'Straddle / Hold', 'Full / Hold', 'Tuck / Reps', 'Straddle / Reps', 'Full / Reps'],
    orderedVariations: true,
  },
  'Iron Cross': {
    mode: 'dynamic',
    variations: ['Band Assisted / Hold', 'Unassisted / Hold', 'Band Assisted / Reps', 'Unassisted / Reps'],
    orderedVariations: true,
  },
  'Front Lever': {
    mode: 'dynamic',
    variations: ['Tuck / Hold', 'Straddle / Hold', 'Full / Hold', 'Tuck / Reps', 'Straddle / Reps', 'Full / Reps'],
    orderedVariations: true,
  },
  'Chin Hang':   { mode: 'hold' },
  'Rope Climb':  { mode: 'time' },

  // Muscular Endurance
  'Chin Up Contest':   { mode: 'reps' },
  'Push Up Contest':   { mode: 'reps', variations: ['Assisted', 'Knee Push Up', 'Full Push Up'], orderedVariations: true },
  'Reverse Hyper':     { mode: 'reps' },
  'L-Sit Hold': {
    mode: 'hold',
    variations: ['Parallel Bars', 'Floor', 'Rings'],
    orderedVariations: true,
  },
  'Tibialis Curl':     { mode: 'reps' },
  'Headstand': {
    mode: 'hold',
    variations: ['Wall Supported', 'Freestanding', 'Handstand'],
    orderedVariations: true,
  },
  'Finger Push Up':    { mode: 'reps' },
  'Calf Raise':        { mode: 'reps' },
  'Leg Extension':     { mode: 'reps' },
  'Ab Wheel Rollout':  { mode: 'reps' },

  // Flexibility & Mobility (blocks — 0 = floor = best)
  'Rear Hand Clasp':   { mode: 'flexibility' },
  'Bridge':            { mode: 'hold', variations: ['Wall Bridge', 'Deep Wall Bridge', 'Assisted Bridge', 'Bridge'], orderedVariations: true },
  'Forward Fold':      { mode: 'flexibility' },
  'Needle Pose':       { mode: 'flexibility' },
  'Front Split':       { mode: 'flexibility' },
  'Middle Split':      { mode: 'flexibility' },
  'Standing Split':    { mode: 'hold', tierBasedScoring: true },
  'Foot Behind Head':  { mode: 'flexibility' },
  'Shoulder Dislocate':{ mode: 'flexibility' },
  'Side Bend':         { mode: 'flexibility' },

  // Power
  'Kelly Snatch':      { mode: 'strength' },
  '1 Arm Snatch':      { mode: 'strength' },
  'Triple Jump':       { mode: 'distance' },
  'Javelin Throw':     { mode: 'distance' },
  'Shot Put':          { mode: 'distance' },
  'AFL':               { mode: 'sport' },
  'Vertical Jump':     { mode: 'distance' },
  'Glute Bridge':      { mode: 'strength' },
  'Clean & Jerk':      { mode: 'strength' },
  'Snatch':            { mode: 'strength' },

  // Aerobic Endurance
  '200m Burpee Broad Jump': { mode: 'time' },
  '1k Run':            { mode: 'time' },
  '1k Cycle':          { mode: 'time' },
  '1k Ski Erg':        { mode: 'time' },
  '1k Row':            { mode: 'time' },
  'Iron Lungs':        { mode: 'hold' },
  '200m Carry':        { mode: 'weight+time' },
  '2k Run':            { mode: 'time' },
  '200m Repeats':      { mode: 'time' },
  'Bronco':            { mode: 'time' },

  // Speed & Agility
  '100m Sprint':       { mode: 'sprint' },
  'Tag':               { mode: 'sport' },
  'T-Race':            { mode: 'sport' },
  '400m Race':         { mode: 'time' },
  'Beach Flags':       { mode: 'sport' },
  '50m Sprint':        { mode: 'sprint' },
  '200m Sprint':       { mode: 'sprint' },
  'Touch Rugby':       { mode: 'sport' },
  'Football Dribble':  { mode: 'time' },
  'Repeat High Jump':  { mode: 'distance+time' },

  // Body Awareness
  'Tae Kwon Do':       { mode: 'sport' },
  'Breakdancing':      { mode: 'hold', tierBasedScoring: true },
  'Trampolining':      { mode: 'sport' },
  'Jump Rope':         { mode: 'reps' },
  'Wrestling':         { mode: 'sport' },
  'Gymnastics':        { mode: 'sport' },
  'Balance Ball': {
    mode: 'hold',
    variations: ['1 Foot', 'Knees', 'Eyes Closed', 'Arms Out', 'Eyes Closed + Arms Out'],
    orderedVariations: true,
  },
  'SKATE':             { mode: 'sport' },
  'Fencing':           { mode: 'sport' },
  'Juggling':          { mode: 'sport' },

  // Co-ordination
  'Volleyball':        { mode: 'sport' },
  'Baseball':          { mode: 'sport' },
  'Teqball':           { mode: 'sport' },
  'Tennis':            { mode: 'sport' },
  'Cricket':           { mode: 'sport' },
  'Badminton':         { mode: 'sport' },
  'Basketball':        { mode: 'sport' },
  'Football':          { mode: 'sport' },
  'Hockey':            { mode: 'sport' },
  'Squash':            { mode: 'sport' },

  // Aim & Precision
  'Netball':           { mode: 'sport' },
  'Handball':          { mode: 'sport' },
  'Cornhole':          { mode: 'sport' },
  'Dodgeball':         { mode: 'sport' },
  'Carrom':            { mode: 'sport' },
  'Archery':           { mode: 'sport' },
  'Bowling':           { mode: 'sport' },
  'Darts':             { mode: 'sport' },
  'Disc Golf':         { mode: 'sport' },
  'Golf':              { mode: 'sport' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function effectiveScore(r: Result): number {
  return r.adjusted_score != null ? r.adjusted_score : r.raw_score
}

function calcPlacements(results: Result[], events: SessionEvent[]): Standing[] {
  // All unique players who have joined the session (have at least one result)
  const playerMap = new Map<string, string | null>()
  results.forEach(r => { if (!playerMap.has(r.player_name)) playerMap.set(r.player_name, r.player_id) })

  const standings: Standing[] = [...playerMap.entries()].map(([name, pid]) => ({
    player_name: name,
    player_id: pid,
    total_placement: 0,
    events_done: 0,
    placements: {},
  }))

  events.forEach(event => {
    const eventResults = results
      .filter(r => r.event_id === event.id)
      .sort((a, b) => effectiveScore(b) - effectiveScore(a))
    const playersWithScores = new Set(eventResults.map(r => r.player_name))
    const lastPlace = eventResults.length + 1

    let placement = 1
    eventResults.forEach((result, idx) => {
      if (idx > 0 && effectiveScore(result) < effectiveScore(eventResults[idx - 1])) placement = idx + 1
      const s = standings.find(st => st.player_name === result.player_name)
      if (s) { s.placements[event.id] = placement; s.total_placement += placement; s.events_done += 1 }
    })

    // Players who haven't submitted for this event get last place
    standings.forEach(s => {
      if (!playersWithScores.has(s.player_name)) {
        s.placements[event.id] = lastPlace
        s.total_placement += lastPlace
      }
    })
  })
  return standings.sort((a, b) => a.total_placement - b.total_placement)
}

// Multiplier for cross-division Overall ranking.
// Applied to raw_score before placement so boosted players rank higher.
function getMultiplier(division: string, dob: string | null): number {
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null
  if (division === 'Juniors') return 1.2
  if (division === "Women's") {
    if (age !== null && age >= 40) return 1.4  // Masters Women
    return 1.2
  }
  if (division === "Men's" && age !== null && age >= 40) return 1.2  // Masters Men
  return 1.0
}

function calcOverallPlacements(
  results: Result[],
  events: SessionEvent[],
  playerDivisions: Record<string, { division: string; dob: string | null }>
): Standing[] {
  // Track unique players
  const playerMap = new Map<string, string | null>()
  results.forEach(r => { if (!playerMap.has(r.player_name)) playerMap.set(r.player_name, r.player_id) })

  const standings: Standing[] = [...playerMap.entries()].map(([name, pid]) => ({
    player_name: name,
    player_id: pid,
    total_placement: 0,
    events_done: 0,
    placements: {},
  }))

  events.forEach(event => {
    const eventResults = results
      .filter(r => r.event_id === event.id)
      .map(r => {
        const info = r.player_id ? (playerDivisions[r.player_id] ?? { division: '', dob: null }) : { division: '', dob: null }
        const mult = getMultiplier(info.division, info.dob)
        const base = r.adjusted_score != null ? r.adjusted_score : r.raw_score
        return { ...r, _display_score: base * mult }
      })
      .sort((a, b) => b._display_score - a._display_score)

    const playersWithScores = new Set(eventResults.map(r => r.player_name))
    const lastPlace = eventResults.length + 1

    let placement = 1
    eventResults.forEach((result, idx) => {
      if (idx > 0 && result._display_score < eventResults[idx - 1]._display_score) placement = idx + 1
      const s = standings.find(st => st.player_name === result.player_name)
      if (s) { s.placements[event.id] = placement; s.total_placement += placement; s.events_done += 1 }
    })

    // Players who haven't submitted for this event get last place
    standings.forEach(s => {
      if (!playersWithScores.has(s.player_name)) {
        s.placements[event.id] = lastPlace
        s.total_placement += lastPlace
      }
    })
  })
  return standings.sort((a, b) => a.total_placement - b.total_placement)
}

function fmtTime(totalSecs: number) {
  const m = Math.floor(totalSecs / 60)
  const s = Math.round(totalSecs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '8px',
  padding: '14px', color: '#fff', fontSize: '22px', fontWeight: 'bold',
  width: '100%', boxSizing: 'border-box',
}

const inpSm: React.CSSProperties = { ...inp, fontSize: '16px', padding: '10px 12px' }

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()

  const [events, setEvents] = useState<SessionEvent[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [session, setSession] = useState<any>(null)
  const [player, setPlayer] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'submit'>('leaderboard')
  const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [preSessionSecsLeft, setPreSessionSecsLeft] = useState<number | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [divisionTab, setDivisionTab] = useState<DivisionTab>('overall')
  // Judge score management
  const [judgeEdit, setJudgeEdit] = useState<Result | null>(null)
  const [judgeEditLabel, setJudgeEditLabel] = useState('')
  const [judgeEditRaw, setJudgeEditRaw] = useState('')
  const [judgeDeleteId, setJudgeDeleteId] = useState<string | null>(null)
  const [judgeSaving, setJudgeSaving] = useState(false)
  // player_id → { division, date_of_birth }
  const [playerDivisions, setPlayerDivisions] = useState<Record<string, { division: string; dob: string | null }>>({})
  const [bodyweights, setBodyweights] = useState<Record<string, string>>({})
  const [bodyweightSaved, setBodyweightSaved] = useState(false)
  // Family accounts
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [activePlayer, setActivePlayer] = useState<any>(null)

  // Score input fields
  const [weightKg, setWeightKg] = useState('')
  const [repCount, setRepCount] = useState('')
  const [timeMins, setTimeMins] = useState('')
  const [timeSecs, setTimeSecs] = useState('')
  const [sprintCs, setSprintCs] = useState('')
  const [distanceVal, setDistanceVal] = useState('')
  const [distanceUnit, setDistanceUnit] = useState<'m' | 'cm'>('m')
  const [sportResult, setSportResult] = useState<'win' | 'draw' | 'loss' | ''>('')
  const [sportScore, setSportScore] = useState('')
  const [exerciseVariation, setExerciseVariation] = useState('')
  const [opponentName, setOpponentName] = useState('')
  // Difficulty tier (Feature 8)
  const [difficultyTier, setDifficultyTier] = useState('')
  // Disadvantage (Feature 9)
  const [disadvantageType, setDisadvantageType] = useState<'small' | 'large' | ''>('')
  const [disadvantageOption, setDisadvantageOption] = useState('')
  const [showDisadvantage, setShowDisadvantage] = useState(false)
  // Post-game popup (Feature 4)
  const [showPostGamePopup, setShowPostGamePopup] = useState(false)
  const [postGamePoints, setPostGamePoints] = useState<number | null>(null)
  const [prevTotalPoints, setPrevTotalPoints] = useState<number | null>(null)

  function clearInputs() {
    setWeightKg(''); setRepCount(''); setTimeMins(''); setTimeSecs(''); setSprintCs('')
    setDistanceVal(''); setDistanceUnit('m'); setSportResult(''); setSportScore('')
    setExerciseVariation(''); setOpponentName(''); setError('')
    setDifficultyTier(''); setDisadvantageType(''); setDisadvantageOption(''); setShowDisadvantage(false)
  }

  useEffect(() => { clearInputs() }, [selectedEvent?.id])

  // Post-game popup: trigger when session ends (Feature 4)
  useEffect(() => {
    if (!sessionEnded || !player) return
    const key = `dismissed_sessions_${player.id}`
    const dismissed: string[] = JSON.parse(localStorage.getItem(key) || '[]')
    if (dismissed.includes(sessionId as string)) return
    setShowPostGamePopup(true)

    // Load points earned in this session (after trigger fires)
    const loadPoints = async () => {
      await new Promise(r => setTimeout(r, 3000))
      const { data } = await supabase
        .from('results')
        .select('points_earned')
        .eq('session_id', sessionId)
        .eq('player_id', player.id)
        .not('points_earned', 'is', null)
        .limit(1)
      if (data?.[0]?.points_earned) setPostGamePoints(data[0].points_earned)

      // Load previous total points to detect colour threshold crossing
      const year = new Date().getFullYear()
      const { data: rData } = await supabase
        .from('rankings')
        .select('total_points')
        .eq('player_id', player.id)
        .eq('season_year', year)
        .maybeSingle()
      if (rData) setPrevTotalPoints(rData.total_points)
    }
    loadPoints()
  }, [sessionEnded, player?.id])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.started_at || !session?.duration_minutes) return
    const startTs = new Date(session.started_at).getTime()
    const endTs = startTs + session.duration_minutes * 60 * 1000

    let sessionClosedByTimer = false
    const tick = () => {
      const now = Date.now()
      if (now < startTs) {
        // Pre-session: count down to start time
        setPreSessionSecsLeft(Math.ceil((startTs - now) / 1000))
        setTimeLeft(null)
      } else {
        // Live: count down remaining session time
        setPreSessionSecsLeft(null)
        const remaining = Math.max(0, Math.floor((endTs - now) / 1000))
        setTimeLeft(remaining)
        if (remaining === 0 && !sessionClosedByTimer) {
          sessionClosedByTimer = true
          setSessionEnded(true)
          // Closing the session triggers the award_session_points DB trigger automatically
          supabase.from('sessions')
            .update({ is_active: false, ended_at: new Date().toISOString() })
            .eq('id', sessionId)
        }
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [session, sessionId])

  // ── Load data + realtime ───────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setAuthLoading(false)
      if (authUser) {
        const { data: p } = await supabase.from('players').select('*').eq('id', authUser.id).single()
        setPlayer(p)
        setActivePlayer(p)
        const initBw: Record<string, string> = {}
        if (p?.bodyweight_kg) initBw[p.id] = String(p.bodyweight_kg)

        // Load linked child profiles
        const { data: children } = await supabase
          .from('players')
          .select('id, full_name, display_name, username, division, date_of_birth, bodyweight_kg')
          .eq('parent_id', authUser.id)
          .order('full_name')
        setFamilyMembers(children || [])
        ;(children || []).forEach((c: any) => { if (c.bodyweight_kg) initBw[c.id] = String(c.bodyweight_kg) })
        setBodyweights(initBw)
      }
      const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      setSession(s)
      if (s && !s.is_active) setSessionEnded(true)
      const { data: ev } = await supabase.from('session_events').select('*').eq('session_id', sessionId).order('domain_number')
      setEvents(ev || [])
      const { data: res } = await supabase.from('results').select('*').eq('session_id', sessionId)
      setResults(res || [])

      // Load division info for every player_id seen in results
      const playerIds = [...new Set((res || []).map((r: any) => r.player_id).filter(Boolean))]
      if (playerIds.length > 0) {
        const { data: pData } = await supabase
          .from('players')
          .select('id, division, date_of_birth')
          .in('id', playerIds)
        if (pData) {
          const map: Record<string, { division: string; dob: string | null }> = {}
          pData.forEach((p: any) => { map[p.id] = { division: p.division ?? '', dob: p.date_of_birth ?? null } })
          setPlayerDivisions(map)
        }
      }
    }
    load()

    const ch = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        async p => {
          setResults(prev => [...prev, p.new as Result])
          const newPlayerId = (p.new as any).player_id
          if (newPlayerId) {
            setPlayerDivisions(prev => {
              if (prev[newPlayerId]) return prev
              // fetch in background
              supabase.from('players').select('id, division, date_of_birth').eq('id', newPlayerId).single().then(({ data }) => {
                if (data) setPlayerDivisions(m => ({ ...m, [data.id]: { division: data.division ?? 'Men\'s', dob: data.date_of_birth ?? null } }))
              })
              return prev
            })
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        p => setResults(prev => prev.map(r => r.id === (p.new as Result).id ? p.new as Result : r)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        p => setResults(prev => prev.filter(r => r.id !== (p.old as any).id)))
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [sessionId])

  // ── Mode resolution ────────────────────────────────────────────────────────
  const eventConfig = selectedEvent ? EVENT_CONFIG[selectedEvent.event_name] : null
  const rawMode = eventConfig?.mode ?? 'strength'

  function getEffectiveMode(): InputMode | null {
    if (!selectedEvent) return null
    if (rawMode === 'dynamic') {
      if (!exerciseVariation) return null
      return exerciseVariation.endsWith('/ Reps') ? 'reps' : 'hold'
    }
    return rawMode
  }
  const effectiveMode = getEffectiveMode()

  // ── Validation ─────────────────────────────────────────────────────────────
  function isScoreValid(): boolean {
    // Tier-based events need a tier selected
    if (eventConfig?.tierBasedScoring) return !!difficultyTier
    const m = effectiveMode
    if (!m) return false
    switch (m) {
      case 'strength': {
        const bw = parseFloat(bodyweights[(activePlayer || player)?.id] ?? '') || 0
        return !!weightKg && bw > 0
      }
      case 'reps':         return !!repCount
      case 'time':
      case 'hold':         return !!(timeMins || timeSecs)
      case 'sprint':       return !!(timeSecs)
      case 'distance':     return !!distanceVal
      case 'flexibility':  return !!distanceVal
      case 'sport':        return !!sportResult
      case 'weight+time':  return !!weightKg && !!(timeMins || timeSecs)
      case 'distance+time':return !!distanceVal
      default:             return false
    }
  }

  // ── Score computation ──────────────────────────────────────────────────────
  function computeScore(): { raw_score: number; score_label: string; adjusted_score?: number } {
    const m = effectiveMode
    if (!m) return { raw_score: 0, score_label: '' }

    // Tier-based events (Breakdancing, Standing Split): tier × 10000 + time_seconds
    const evData = selectedEvent ? getEventByName(selectedEvent.event_name) : null
    if (eventConfig?.tierBasedScoring && difficultyTier && evData?.difficultyTiers) {
      const tierIdx = evData.difficultyTiers.findIndex(t => t.name === difficultyTier)
      if (tierIdx < 0) return { raw_score: 0, score_label: '' }
      const time = (parseFloat(timeMins) || 0) * 60 + (parseFloat(timeSecs) || 0)
      const rawScore = tierIdx * 10000 + time
      const label = `D${tierIdx + 1} ${difficultyTier}${time > 0 ? ` · ${fmtTime(time)}` : ''}`
      return { raw_score: rawScore, score_label: label }
    }

    const totalSecs = (parseFloat(timeMins) || 0) * 60 + (parseFloat(timeSecs) || 0)
    const timeStr = fmtTime(totalSecs)

    // Strip "/ Hold" / "/ Reps" from variation for display
    const varLabel = exerciseVariation.replace(' / Hold', '').replace(' / Reps', '')
    const varPrefix = varLabel ? `${varLabel}: ` : ''

    // Ordered variations: each tier step adds 10000 so any score at tier N beats any score at tier N-1
    const varIdx = (eventConfig?.orderedVariations && exerciseVariation && eventConfig.variations)
      ? Math.max(0, eventConfig.variations.indexOf(exerciseVariation))
      : 0
    const tierBonus = eventConfig?.orderedVariations ? varIdx * 10000 : 0

    // Disadvantage multiplier for Domain 1+2 strength events
    const domainNum = selectedEvent ? events.find(e => e.id === selectedEvent.id)?.domain_number : null
    const isStrengthDomain = domainNum === 1 || domainNum === 2
    const disadvMult = isStrengthDomain && disadvantageType === 'small' ? 1.2 : isStrengthDomain && disadvantageType === 'large' ? 1.5 : 1.0

    switch (m) {
      case 'strength': {
        const w = parseFloat(weightKg) || 0
        const bw = parseFloat(bodyweights[(activePlayer || player)?.id] ?? '') || 0
        const r = parseInt(repCount) || 0
        const ratio = bw > 0 ? w / bw : 0
        const ratioLabel = bw > 0 ? ` (${ratio.toFixed(2)}× BW)` : ''
        const adjScore = ratio * disadvMult
        return {
          raw_score: ratio,
          adjusted_score: disadvMult !== 1.0 ? adjScore : undefined,
          score_label: r > 0 ? `${weightKg}kg × ${r} rep${r !== 1 ? 's' : ''}${ratioLabel}` : `${weightKg}kg${ratioLabel}`,
        }
      }
      case 'reps':
        return { raw_score: (parseInt(repCount) || 0) + tierBonus, score_label: `${varPrefix}${repCount} reps` }

      case 'time':
        return { raw_score: -totalSecs, score_label: `${varPrefix}${timeStr}` }

      case 'hold':
        return { raw_score: totalSecs + tierBonus, score_label: `${varPrefix}${timeStr}` }

      case 'distance': {
        const val = parseFloat(distanceVal) || 0
        const raw_score = distanceUnit === 'm' ? Math.round(val * 100) : Math.round(val)
        return { raw_score, score_label: `${distanceVal}${distanceUnit}` }
      }

      case 'flexibility': {
        const blocks = parseInt(distanceVal) || 0
        const holdSecs = totalSecs
        let label = blocks === 0 ? '0 blocks (floor)' : `${blocks} block${blocks !== 1 ? 's' : ''}`
        if (holdSecs > 0) label += ` · ${timeStr} hold`
        return { raw_score: -blocks, score_label: label }
      }

      case 'sport': {
        const raw_score = sportResult === 'win' ? 2 : sportResult === 'draw' ? 1 : 0
        let label = sportResult ? sportResult.charAt(0).toUpperCase() + sportResult.slice(1) : ''
        if (opponentName) label += ` vs ${opponentName}`
        if (sportScore) label += ` (${sportScore})`
        return { raw_score, score_label: label }
      }

      case 'sprint': {
        const s = parseFloat(timeSecs) || 0
        const cs = parseInt(sprintCs) || 0
        const totalCs = Math.round(s * 100) + cs
        const label = `${s.toFixed(0)}s${cs > 0 ? `.${cs.toString().padStart(2, '0')}` : ''}`
        return { raw_score: -totalCs, score_label: label }
      }

      case 'weight+time':
        return { raw_score: -totalSecs, score_label: `${weightKg}kg · ${timeStr}` }

      case 'distance+time': {
        const val = parseFloat(distanceVal) || 0
        const raw_score = distanceUnit === 'm' ? Math.round(val * 100) : Math.round(val)
        const parts = [`${distanceVal}${distanceUnit}`]
        if (totalSecs > 0) parts.push(timeStr)
        return { raw_score, score_label: parts.join(' · ') }
      }

      default:
        return { raw_score: 0, score_label: '' }
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const submittingAs = activePlayer || player
    if (!submittingAs) { setError('You must be logged in to submit a score'); return }
    if (sessionEnded) { setError('Session has ended — scores are locked'); return }
    if (preSessionSecsLeft !== null) { setError('Session has not started yet'); return }
    if (!selectedEvent || !isScoreValid()) return
    setSubmitting(true); setError('')
    try {
      const { raw_score, score_label, adjusted_score } = computeScore()
      const totalSecs = (parseFloat(timeMins) || 0) * 60 + (parseFloat(timeSecs) || 0)
      const m = effectiveMode!

      const payload: Record<string, any> = {
        session_id: sessionId,
        event_id: selectedEvent.id,
        player_name: submittingAs.display_name || submittingAs.username || submittingAs.full_name,
        player_id: submittingAs.id,
        raw_score,
        score_label,
      }

      if (adjusted_score != null) payload.adjusted_score = adjusted_score
      if (difficultyTier) payload.difficulty_tier = difficultyTier
      if (disadvantageType) { payload.disadvantage_type = disadvantageType; payload.disadvantage_option = disadvantageOption || null }
      if (exerciseVariation) payload.exercise_variation = exerciseVariation

      if (m === 'strength') {
        payload.weight_kg = parseFloat(weightKg) || 0
        if (repCount) payload.reps = parseInt(repCount)
      }
      if (m === 'reps') payload.reps = parseInt(repCount) || 0
      if (['time', 'hold', 'weight+time', 'distance+time', 'flexibility'].includes(m) && totalSecs > 0) {
        payload.time_seconds = totalSecs
      }
      if (m === 'sprint') {
        const s = parseFloat(timeSecs) || 0
        const cs = parseInt(sprintCs) || 0
        payload.time_seconds = s + cs / 100
      }
      if (m === 'weight+time') payload.weight_kg = parseFloat(weightKg) || 0
      if (m === 'sport') {
        payload.result_type = sportResult
        if (sportScore) payload.match_score = sportScore
        if (opponentName) payload.opponent_name = opponentName

        // Conflict check: does opponent's existing result contradict ours?
        if (opponentName) {
          const theirResult = results.find(r =>
            r.event_id === selectedEvent.id && r.player_name === opponentName
          )
          if (theirResult?.result_type) {
            const mine = sportResult
            const theirs = theirResult.result_type
            const conflict =
              (mine === 'win' && theirs === 'win') ||
              (mine === 'loss' && theirs === 'loss') ||
              (mine === 'draw' && theirs !== 'draw')
            if (conflict) {
              setError(`⚠ Score conflict: ${opponentName} recorded a "${theirs}" for this match. Check with your judge.`)
              setSubmitting(false)
              return
            }
          }
        }
      }

      const { error: err } = await supabase.from('results').upsert(payload, {
        onConflict: 'player_id,session_id,event_id',
      })
      if (err) throw err

      // Always re-fetch results — don't rely solely on realtime,
      // which won't fire an INSERT event for upserts that resolve as UPDATE.
      const { data: freshResults } = await supabase.from('results').select('*').eq('session_id', sessionId)
      if (freshResults) setResults(freshResults)

      clearInputs(); setSelectedEvent(null)
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  // ── Judge score management ─────────────────────────────────────────────────
  const isJudge = player?.role === 'judge'

  const openJudgeEdit = (r: Result) => {
    setJudgeEdit(r)
    setJudgeEditLabel(r.score_label)
    setJudgeEditRaw(String(r.raw_score))
    setJudgeDeleteId(null)
  }

  const handleJudgeSave = async () => {
    if (!judgeEdit) return
    setJudgeSaving(true)
    const { error } = await supabase.from('results').update({
      score_label: judgeEditLabel,
      raw_score: parseFloat(judgeEditRaw) || 0,
      adjusted_score: null,
    }).eq('id', judgeEdit.id)
    if (!error) {
      const { data: fresh } = await supabase.from('results').select('*').eq('session_id', sessionId)
      if (fresh) setResults(fresh)
      setJudgeEdit(null)
    }
    setJudgeSaving(false)
  }

  const handleJudgeDelete = async (resultId: string) => {
    if (judgeDeleteId !== resultId) {
      setJudgeDeleteId(resultId)
      setTimeout(() => setJudgeDeleteId(d => d === resultId ? null : d), 3000)
      return
    }
    setJudgeSaving(true)
    await supabase.from('results').delete().eq('id', resultId)
    const { data: fresh } = await supabase.from('results').select('*').eq('session_id', sessionId)
    if (fresh) setResults(fresh)
    setJudgeDeleteId(null)
    setJudgeSaving(false)
  }

  const saveBodyweight = async () => {
    const target = activePlayer || player
    const bwVal = bodyweights[target?.id]
    if (!target || !bwVal) return
    await supabase.from('players').update({ bodyweight_kg: parseFloat(bwVal) }).eq('id', target.id)
    setBodyweightSaved(true); setTimeout(() => setBodyweightSaved(false), 2000)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  // Filter results by division for the non-overall tabs
  const DIVISION_MAP: Record<DivisionTab, string | null> = {
    overall: null,
    mens: "Men's",
    womens: "Women's",
    juniors: 'Juniors',
  }
  const divisionFilter = DIVISION_MAP[divisionTab]

  function resultsForDivision(divFilter: string | null): Result[] {
    if (!divFilter) return results
    return results.filter(r => {
      if (!r.player_id) return false
      const info = playerDivisions[r.player_id]
      return info?.division === divFilter
    })
  }

  const standings = divisionTab === 'overall'
    ? calcOverallPlacements(results, events, playerDivisions)
    : calcPlacements(resultsForDivision(divisionFilter), events)
  const RANK_COLOURS = ['#F9B051', '#aaa', '#CD7F32', '#2371BB', '#4DB26E']
  const timerColour = preSessionSecsLeft !== null
    ? '#B87DB5'   // purple = waiting to start
    : timeLeft !== null
      ? timeLeft < 600 ? '#EA4742' : timeLeft < 1800 ? '#F9B051' : '#4DB26E'
      : '#4DB26E'

  type EventScore = (Result & { placement: number }) | { id: string; player_name: string; player_id: string | null; placement: number; noScore: true }

  function getEventScores(eventId: string): EventScore[] {
    const withScore = results
      .filter(r => r.event_id === eventId)
      .sort((a, b) => effectiveScore(b) - effectiveScore(a))
      .map((r, idx, arr) => {
        let placement = idx + 1
        if (idx > 0 && effectiveScore(r) === effectiveScore(arr[idx - 1])) {
          placement = arr.findIndex(x => effectiveScore(x) === effectiveScore(r)) + 1
        }
        return { ...r, placement, noScore: false as const }
      })

    // All players who've joined the session
    const playerMap = new Map<string, string | null>()
    results.forEach(r => { if (!playerMap.has(r.player_name)) playerMap.set(r.player_name, r.player_id) })
    const playersWithScore = new Set(withScore.map(r => r.player_name))
    const lastPlace = withScore.length + 1

    const noScorePlayers: EventScore[] = [...playerMap.entries()]
      .filter(([name]) => !playersWithScore.has(name))
      .map(([name, pid]) => ({ id: `no-score-${pid || name}`, player_name: name, player_id: pid, placement: lastPlace, noScore: true as const }))

    return [...withScore, ...noScorePlayers]
  }

  // ── Style helpers ──────────────────────────────────────────────────────────
  const unitBtn = (unit: 'm' | 'cm'): React.CSSProperties => ({
    padding: '10px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '14px',
    background: distanceUnit === unit ? '#2371BB' : '#1a1a1a',
    color: distanceUnit === unit ? '#fff' : '#666',
  })

  const sportBtn = (val: 'win' | 'draw' | 'loss'): React.CSSProperties => {
    const colours = { win: '#4DB26E', draw: '#F9B051', loss: '#EA4742' }
    const active = sportResult === val
    return {
      flex: 1, padding: '16px', border: `2px solid ${active ? colours[val] : '#222'}`,
      borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px',
      background: active ? colours[val] + '22' : '#111',
      color: active ? colours[val] : '#444',
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/* ── Judge edit modal ── */}
      {judgeEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#111', border: '1px solid #2371BB', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <div style={{ fontSize: '11px', color: '#555', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Judge Edit</div>
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>{judgeEdit.player_name}</div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '20px' }}>
              {events.find(e => e.id === judgeEdit.event_id)?.event_name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>SCORE LABEL</label>
                <input
                  value={judgeEditLabel}
                  onChange={e => setJudgeEditLabel(e.target.value)}
                  style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px', color: '#fff', fontSize: '16px', boxSizing: 'border-box' as const }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>RAW SCORE (used for ranking)</label>
                <input
                  type="number"
                  value={judgeEditRaw}
                  onChange={e => setJudgeEditRaw(e.target.value)}
                  style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px', color: '#fff', fontSize: '16px', boxSizing: 'border-box' as const }}
                />
                <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>Note: time events use negative values, faster = more negative</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setJudgeEdit(null)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                Cancel
              </button>
              <button onClick={handleJudgeSave} disabled={judgeSaving} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#2371BB', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', opacity: judgeSaving ? 0.6 : 1 }}>
                {judgeSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#2371BB', padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
              {session?.is_championship ? '🏆 CHAMPIONSHIP' : 'LIVE SESSION'} · {session?.location}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>AllSport Scoring</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: timerColour, fontVariantNumeric: 'tabular-nums' }}>
              {sessionEnded ? 'ENDED' : preSessionSecsLeft !== null ? fmtCountdown(preSessionSecsLeft) : timeLeft !== null ? fmtCountdown(timeLeft) : '--:--'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
              {preSessionSecsLeft !== null ? 'until start' : 'remaining'}
            </div>
          </div>
        </div>
        {session?.session_code && (
          <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>SESSION CODE</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '6px' }}>{session.session_code}</div>
          </div>
        )}
      </div>

      {sessionEnded && (
        <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', padding: '14px 20px', textAlign: 'center' }}>
          <div style={{ color: '#EA4742', fontWeight: 'bold', fontSize: '15px' }}>⏱ Session Ended</div>
          <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Score submission is locked</div>
          <a href="/dashboard" style={{ display: 'inline-block', marginTop: '10px', color: '#2371BB', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>← Back to Dashboard</a>
        </div>
      )}

      <div style={{ height: '4px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
        {(['leaderboard', 'submit'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '14px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
            background: activeTab === tab ? '#111' : '#0a0a0a',
            color: activeTab === tab ? '#2371BB' : '#555',
            borderBottom: activeTab === tab ? '2px solid #2371BB' : '2px solid transparent',
          }}>
            {tab === 'leaderboard' ? '📊 Leaderboard' : '➕ Submit Score'}
          </button>
        ))}
      </div>

      {/* ── LEADERBOARD TAB ────────────────────────────────────────────────── */}
      {activeTab === 'leaderboard' && (
        <div style={{ padding: '16px' }}>

          {/* Division tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {([
              { key: 'overall', label: '🌐 All-Divisions' },
              { key: 'mens',    label: "Men's" },
              { key: 'womens',  label: "Women's" },
              { key: 'juniors', label: 'Juniors' },
            ] as { key: DivisionTab; label: string }[]).map(({ key, label }) => {
              const active = divisionTab === key
              return (
                <button key={key} onClick={() => setDivisionTab(key)} style={{
                  flex: 1, padding: '8px 4px', border: `1px solid ${active ? '#2371BB' : '#222'}`,
                  borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: active ? 700 : 400,
                  background: active ? '#0d1a2e' : '#111',
                  color: active ? '#2371BB' : '#555',
                }}>
                  {label}
                </button>
              )
            })}
          </div>

          {divisionTab === 'overall' && (
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '10px', textAlign: 'center' }}>
              Multipliers applied: Women's & Juniors ×1.2 · Masters Men ×1.2 · Masters Women ×1.4
            </div>
          )}

          {standings.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', padding: '48px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏁</div>
              <div>{divisionTab === 'overall' ? 'No scores yet — be the first to submit!' : `No ${DIVISION_MAP[divisionTab]} scores yet`}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {standings.map((s, idx) => {
                const divInfo = s.player_id ? playerDivisions[s.player_id] : null
                const divLabel = divInfo?.division ?? null
                const divColour = divLabel === "Women's" ? '#F397C0' : divLabel === 'Juniors' ? '#F9B051' : '#2371BB'
                return (
                  <div key={s.player_name} style={{
                    background: '#111', borderRadius: '10px', padding: '14px 16px',
                    border: `1px solid ${idx === 0 ? '#F9B051' : '#1e1e1e'}`,
                    display: 'flex', alignItems: 'center', gap: '14px',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '14px',
                      background: RANK_COLOURS[idx] || '#333', color: idx < 3 ? '#000' : '#fff',
                    }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{s.player_name}</div>
                      <div style={{ fontSize: '12px', color: '#555', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{s.events_done} event{s.events_done !== 1 ? 's' : ''} done</span>
                        {divisionTab === 'overall' && divLabel && (
                          <span style={{ color: divColour, fontSize: '11px', background: divColour + '22', padding: '1px 6px', borderRadius: '4px' }}>{divLabel}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: idx === 0 ? '#F9B051' : '#fff' }}>{s.total_placement}</div>
                      <div style={{ fontSize: '11px', color: '#555' }}>{divisionTab === 'overall' ? 'adj. pts' : 'placement pts'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Events list */}
          <div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Today's Events</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {events.map(event => {
                const scores = getEventScores(event.id)
                const leader = (scores.find(s => !('noScore' in s)) ?? null) as (typeof scores[0] & { score_label: string }) | null
                const isExpanded = expandedEventId === event.id
                return (
                  <div key={event.id} style={{ background: '#111', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${isExpanded ? '#2371BB' : '#1e1e1e'}` }}>
                    <button
                      onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                      style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                    >
                      <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                          {event.event_name}
                          {(() => { const ev = getEventByName(event.event_name); return ev?.hasDifficultyTiers && ev.difficultyTiers ? <span style={{ marginLeft: '6px', fontSize: '10px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>D1–D{ev.difficultyTiers.length}</span> : null })()}
                        </div>
                        <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{event.domain_name}</div>
                      </div>
                      {leader ? (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#F9B051' }}>{leader.player_name}</div>
                          <div style={{ fontSize: '11px', color: '#4DB26E' }}>{leader.score_label} · {scores.length} score{scores.length !== 1 ? 's' : ''}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#444' }}>No scores yet</div>
                      )}
                      <div style={{ color: '#333', fontSize: '12px', flexShrink: 0, marginLeft: '4px' }}>{isExpanded ? '▲' : '▼'}</div>
                    </button>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #1e1e1e' }}>
                        {scores.length === 0 ? (
                          <div style={{ padding: '12px 14px', color: '#444', fontSize: '12px' }}>No scores yet.</div>
                        ) : scores.map((r, idx) => {
                          const isNoScore = (r as any).noScore === true
                          return (
                            <div key={r.id} style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '10px 14px',
                              borderBottom: idx < scores.length - 1 ? '1px solid #1a1a1a' : 'none',
                              background: idx === 0 && !isNoScore ? '#0d1a0d' : 'transparent',
                              opacity: isNoScore ? 0.5 : 1,
                            }}>
                              <div style={{
                                width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: 'bold',
                                background: isNoScore ? '#222' : (RANK_COLOURS[idx] || '#222'),
                                color: (!isNoScore && idx < 3) ? '#000' : '#fff',
                              }}>{r.placement}</div>
                              <div style={{ flex: 1, fontSize: '13px', color: idx === 0 && !isNoScore ? '#fff' : '#aaa', fontWeight: idx === 0 && !isNoScore ? 'bold' : 'normal' }}>{r.player_name}</div>
                              {isNoScore ? (
                                <div style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>No score — last place</div>
                              ) : (
                                <>
                                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: idx === 0 ? '#F9B051' : '#666' }}>
                                    {(r as Result).score_label}
                                    {(r as Result).difficulty_tier && (
                                      <span style={{ fontSize: '10px', color: '#B87DB5', marginLeft: '4px', background: '#B87DB522', padding: '1px 5px', borderRadius: '3px' }}>
                                        {(r as Result).difficulty_tier}
                                      </span>
                                    )}
                                    {(r as Result).disadvantage_type && (
                                      <span
                                        title={(r as Result).disadvantage_option || ''}
                                        style={{ fontSize: '10px', color: '#F9B051', marginLeft: '4px', background: '#F9B05122', padding: '1px 5px', borderRadius: '3px', cursor: 'help' }}
                                      >
                                        {(r as Result).disadvantage_type === 'small' ? 'S' : 'L'}
                                      </span>
                                    )}
                                  </div>
                                  {isJudge && (
                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                      <button
                                        onClick={() => openJudgeEdit(r as Result)}
                                        title="Edit score"
                                        style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #2371BB44', background: '#2371BB11', color: '#2371BB', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => handleJudgeDelete((r as Result).id)}
                                        disabled={judgeSaving}
                                        title={judgeDeleteId === (r as Result).id ? 'Tap again to confirm' : 'Delete score'}
                                        style={{ padding: '4px 8px', borderRadius: '5px', border: `1px solid ${judgeDeleteId === (r as Result).id ? '#EA4742' : '#EA474244'}`, background: judgeDeleteId === (r as Result).id ? '#EA474222' : '#EA474211', color: '#EA4742', cursor: 'pointer', fontSize: '12px', lineHeight: 1, transition: 'all 0.15s' }}
                                      >
                                        {judgeDeleteId === (r as Result).id ? '⚠️' : '🗑'}
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMIT TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'submit' && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {authLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#555' }}>Loading...</div>
          ) : !player ? (
            <div style={{ background: '#1a1a2e', border: '1px solid #2371BB', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔒</div>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Login required</div>
              <div style={{ color: '#555', fontSize: '13px', marginBottom: '16px' }}>You need an AllSport account to submit scores</div>
              <a href="/play" style={{ background: '#2371BB', color: '#fff', padding: '10px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>Log In →</a>
            </div>
          ) : sessionEnded ? (
            <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏱</div>
              <div style={{ fontWeight: 'bold', color: '#EA4742' }}>Session has ended</div>
              <div style={{ color: '#555', fontSize: '13px', marginTop: '8px' }}>Score submission is locked</div>
            </div>
          ) : (
            <>
              {submitSuccess && (
                <div style={{ background: '#0d2e1a', border: '1px solid #4DB26E', borderRadius: '8px', padding: '12px 16px', color: '#4DB26E', fontSize: '14px' }}>
                  ✓ Score submitted!
                </div>
              )}

              {/* Submitting as — family switcher */}
              <div style={{ background: '#111', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', color: '#444', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Submitting as
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[player, ...familyMembers].filter(Boolean).map((p: any) => {
                    const isActive = (activePlayer || player)?.id === p.id
                    const name = p.display_name || p.username || p.full_name || '?'
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setActivePlayer(p); setSelectedEvent(null); clearInputs() }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '7px 12px', borderRadius: '8px', border: `1px solid ${isActive ? '#2371BB' : '#2a2a2a'}`,
                          background: isActive ? '#0d1a2e' : 'transparent',
                          cursor: 'pointer', color: isActive ? '#fff' : '#666',
                        }}
                      >
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                          background: isActive ? '#2371BB' : '#222',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '12px', color: '#fff',
                        }}>
                          {name[0].toUpperCase()}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ fontSize: '10px', color: '#555' }}>{p.division}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Bodyweight — for all players, required for strength events */}
              <div style={{ background: '#111', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#555', flex: 1 }}>Bodyweight</span>
                <input
                  type="number"
                  value={bodyweights[(activePlayer || player)?.id] ?? ''}
                  onChange={e => {
                    const id = (activePlayer || player)?.id
                    if (id) setBodyweights(prev => ({ ...prev, [id]: e.target.value }))
                  }}
                  onBlur={saveBodyweight}
                  placeholder="kg"
                  style={{ width: '70px', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}
                />
                <span style={{ fontSize: '11px', color: bodyweightSaved ? '#4DB26E' : '#444' }}>
                  {bodyweightSaved ? '✓ saved' : 'kg'}
                </span>
              </div>

              {/* Event selector */}
              <div>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>SELECT EVENT</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {events.map(event => {
                    const myScore = results.find(r => r.event_id === event.id && r.player_id === (activePlayer || player)?.id)
                    const isSelected = selectedEvent?.id === event.id
                    return (
                      <button key={event.id} onClick={() => setSelectedEvent(isSelected ? null : event)} style={{
                        padding: '12px 14px', borderRadius: '8px', border: `1px solid ${isSelected ? '#2371BB' : '#1e1e1e'}`,
                        cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: isSelected ? '#0d1a2e' : '#111', color: isSelected ? '#fff' : '#aaa', fontSize: '13px',
                      }}>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>{event.event_name}</span>
                          {(() => { const ev = getEventByName(event.event_name); return ev?.hasDifficultyTiers && ev.difficultyTiers ? <span style={{ marginLeft: '6px', fontSize: '10px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>D1–D{ev.difficultyTiers.length}</span> : null })()}
                          <span style={{ marginLeft: '8px', opacity: 0.5, fontSize: '11px' }}>{event.domain_name}</span>
                        </div>
                        {myScore && (
                          <span style={{ fontSize: '11px', color: '#4DB26E', flexShrink: 0 }}>✓ {myScore.score_label}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Score input panel ── */}
              {selectedEvent && (
                <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {selectedEvent.domain_name} — {selectedEvent.event_name}
                  </div>

                  {/* Variation picker */}
                  {eventConfig?.variations && (
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '8px' }}>VARIATION</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: eventConfig.freeVariation ? '8px' : '0' }}>
                        {eventConfig.variations.map(v => {
                          const active = exerciseVariation === v
                          const label = v.replace(' / Hold', '').replace(' / Reps', '')
                          const isHold = v.endsWith('/ Hold')
                          const isReps = v.endsWith('/ Reps')
                          const accent = isHold ? '#B87DB5' : isReps ? '#F9B051' : '#2371BB'
                          return (
                            <button key={v} onClick={() => setExerciseVariation(active ? '' : v)} style={{
                              padding: '8px 14px', borderRadius: '6px', border: `1px solid ${active ? accent : '#2a2a2a'}`,
                              cursor: 'pointer', fontSize: '13px', fontWeight: active ? 'bold' : 'normal',
                              background: active ? accent + '22' : '#111',
                              color: active ? accent : '#777',
                            }}>
                              {label}
                              {isHold && <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.6 }}>hold</span>}
                              {isReps && <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.6 }}>reps</span>}
                            </button>
                          )
                        })}
                      </div>
                      {/* Free-text override — for events like 1 Leg Squat where custom variations are common */}
                      {eventConfig.freeVariation && (
                        <input
                          value={exerciseVariation}
                          onChange={e => setExerciseVariation(e.target.value)}
                          placeholder="Or type your own variation..."
                          style={{ ...inpSm, fontSize: '14px' }}
                        />
                      )}
                    </div>
                  )}

                  {/* Dynamic mode: prompt to select variation first */}
                  {rawMode === 'dynamic' && !exerciseVariation && (
                    <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '8px 0' }}>
                      Select a variation above to continue
                    </div>
                  )}

                  {/* Difficulty tier selector (Feature 8) */}
                  {(() => {
                    const evData = getEventByName(selectedEvent.event_name)
                    if (!evData?.hasDifficultyTiers || !evData.difficultyTiers) return null
                    return (
                      <div>
                        <label style={{ fontSize: '11px', color: '#B87DB5', display: 'block', marginBottom: '8px', letterSpacing: '1px' }}>DIFFICULTY TIER</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {evData.difficultyTiers.map(t => {
                            const active = difficultyTier === t.name
                            return (
                              <button key={t.level} onClick={() => setDifficultyTier(active ? '' : t.name)} style={{
                                padding: '7px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                                border: `1px solid ${active ? '#B87DB5' : '#2a2a2a'}`,
                                background: active ? '#B87DB522' : '#111',
                                color: active ? '#B87DB5' : '#777', fontWeight: active ? 'bold' : 'normal',
                              }}>
                                D{t.level} — {t.name}
                              </button>
                            )
                          })}
                        </div>
                        {eventConfig?.tierBasedScoring && !difficultyTier && (
                          <div style={{ fontSize: '11px', color: '#555', marginTop: '6px' }}>Select a tier to continue</div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Tier-based scoring: tier already selected above, optionally add time */}
                  {eventConfig?.tierBasedScoring && difficultyTier && (
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>DURATION (seconds — optional)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>MINUTES</label>
                          <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} placeholder="0" style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>SECONDS</label>
                          <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="30" style={inp} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STRENGTH: weight + reps */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'strength' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>WEIGHT (kg)</label>
                        <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="100" style={inp} />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>REPS (optional)</label>
                        <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)} placeholder="5" style={inp} />
                      </div>
                    </div>
                  )}

                  {/* REPS */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'reps' && (
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>REPS / COUNT</label>
                      <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)} placeholder="20" style={{ ...inp, fontSize: '32px' }} />
                    </div>
                  )}

                  {/* SPRINT (ss.cs — seconds + centiseconds, lower = better) */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'sprint' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>SECONDS</label>
                          <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="10" style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>CENTISECONDS (00–99)</label>
                          <input type="number" min="0" max="99" value={sprintCs} onChange={e => setSprintCs(e.target.value)} placeholder="54" style={inp} />
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#444' }}>e.g. 10s 54cs = 10.54s · Lower = better</div>
                    </>
                  )}

                  {/* TIME (lower = better — runs, rows) */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'time' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>MINUTES</label>
                          <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} placeholder="4" style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>SECONDS</label>
                          <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="30" style={inp} />
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#444' }}>Lower time = better ranking</div>
                    </>
                  )}

                  {/* HOLD (longer = better — L-sit, planche, iron lungs) */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'hold' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>MINUTES</label>
                          <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} placeholder="1" style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>SECONDS</label>
                          <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="30" style={inp} />
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#444' }}>Longer hold = better ranking</div>
                    </>
                  )}

                  {/* DISTANCE (jumps, throws) */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'distance' && (
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>DISTANCE</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="number" value={distanceVal} onChange={e => setDistanceVal(e.target.value)} placeholder="8.5" style={{ ...inp, flex: 1 }} />
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => setDistanceUnit('m')} style={unitBtn('m')}>m</button>
                          <button onClick={() => setDistanceUnit('cm')} style={unitBtn('cm')}>cm</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FLEXIBILITY — blocks (0 = floor = best) + optional hold time */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'flexibility' && (
                    <>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>BLOCKS FROM FLOOR (0 = touching floor)</label>
                        <input type="number" min="0" max="20" value={distanceVal} onChange={e => setDistanceVal(e.target.value)}
                          placeholder="2" style={{ ...inp, fontSize: '32px' }} />
                        <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>Fewer blocks = better ranking</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>HOLD TIME (optional — min / sec)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} placeholder="0" style={inpSm} />
                          <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="30" style={inpSm} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* SPORT — opponent + win/draw/loss + score */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'sport' && (() => {
                    const myName = (activePlayer || player)?.display_name || (activePlayer || player)?.username || (activePlayer || player)?.full_name
                    const otherPlayers = [...new Set(results.map(r => r.player_name))].filter(n => n !== myName)
                    return (
                      <>
                        {/* Opponent picker */}
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '8px' }}>OPPONENT</label>
                          {otherPlayers.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                              {otherPlayers.map(name => {
                                const active = opponentName === name
                                return (
                                  <button key={name} onClick={() => setOpponentName(active ? '' : name)} style={{
                                    padding: '7px 13px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                                    border: `1px solid ${active ? '#2371BB' : '#2a2a2a'}`,
                                    background: active ? '#2371BB22' : '#111',
                                    color: active ? '#2371BB' : '#777', fontWeight: active ? 'bold' : 'normal',
                                  }}>{name}</button>
                                )
                              })}
                            </div>
                          )}
                          <input
                            value={opponentName}
                            onChange={e => setOpponentName(e.target.value)}
                            placeholder={otherPlayers.length > 0 ? 'Or type a name...' : 'Opponent name'}
                            style={{ ...inpSm, fontSize: '14px' }}
                          />
                        </div>

                        {/* Result */}
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '8px' }}>RESULT</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setSportResult('win')} style={sportBtn('win')}>Win</button>
                            <button onClick={() => setSportResult('draw')} style={sportBtn('draw')}>Draw</button>
                            <button onClick={() => setSportResult('loss')} style={sportBtn('loss')}>Loss</button>
                          </div>
                        </div>

                        {/* Score */}
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>SCORE (optional — e.g. 21-15)</label>
                          <input value={sportScore} onChange={e => setSportScore(e.target.value)} placeholder="21-15" style={{ ...inp, fontSize: '18px' }} />
                        </div>

                        {/* Conflict notice when opponent already submitted */}
                        {opponentName && sportResult && (() => {
                          const their = results.find(r => r.event_id === selectedEvent?.id && r.player_name === opponentName)
                          if (!their?.result_type) return null
                          const mine = sportResult
                          const conflict =
                            (mine === 'win' && their.result_type === 'win') ||
                            (mine === 'loss' && their.result_type === 'loss') ||
                            (mine === 'draw' && their.result_type !== 'draw')
                          return (
                            <div style={{
                              padding: '10px 12px', borderRadius: '8px', fontSize: '12px',
                              background: conflict ? '#2e0d0d' : '#0d2e1a',
                              border: `1px solid ${conflict ? '#EA4742' : '#4DB26E'}`,
                              color: conflict ? '#EA4742' : '#4DB26E',
                            }}>
                              {conflict
                                ? `⚠ Conflict: ${opponentName} recorded a "${their.result_type}" — scores don't match. Check with your judge.`
                                : `✓ Matches ${opponentName}'s record (${their.result_type})`}
                            </div>
                          )
                        })()}
                      </>
                    )
                  })()}

                  {/* WEIGHT + TIME — 200m Carry */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'weight+time' && (
                    <>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>WEIGHT CARRIED (kg)</label>
                        <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="50" style={inp} />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>TIME (min / sec)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} placeholder="4" style={inp} />
                          <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="30" style={inp} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>Lower time = better ranking</div>
                      </div>
                    </>
                  )}

                  {/* DISTANCE + TIME — Repeat High Jump */}
                  {!eventConfig?.tierBasedScoring && effectiveMode === 'distance+time' && (
                    <>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>HEIGHT REACHED</label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input type="number" value={distanceVal} onChange={e => setDistanceVal(e.target.value)} placeholder="45" style={{ ...inp, flex: 1 }} />
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button onClick={() => setDistanceUnit('cm')} style={unitBtn('cm')}>cm</button>
                            <button onClick={() => setDistanceUnit('m')} style={unitBtn('m')}>m</button>
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>Higher = better ranking</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>TIME FOR 10 JUMPS (optional — min / sec)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} placeholder="1" style={inpSm} />
                          <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="30" style={inpSm} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Disadvantage section (Feature 9) */}
                  {(() => {
                    const evData = getEventByName(selectedEvent.event_name)
                    const disadvData = evData?.disadvantage
                    if (!disadvData) return null
                    return (
                      <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: '12px' }}>
                        <button
                          onClick={() => setShowDisadvantage(v => !v)}
                          style={{ background: 'none', border: 'none', color: '#F9B051', cursor: 'pointer', fontSize: '12px', padding: '0', fontWeight: 'bold', letterSpacing: '0.5px' }}
                        >
                          {showDisadvantage ? '▼' : '▶'} Disadvantage (optional)
                        </button>
                        {showDisadvantage && (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {(['small', 'large'] as const).map(type => (
                                <button key={type} onClick={() => { setDisadvantageType(disadvantageType === type ? '' : type); setDisadvantageOption('') }} style={{
                                  flex: 1, padding: '9px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                                  border: `1px solid ${disadvantageType === type ? '#F9B051' : '#2a2a2a'}`,
                                  background: disadvantageType === type ? '#F9B05122' : '#111',
                                  color: disadvantageType === type ? '#F9B051' : '#666',
                                }}>
                                  {type === 'small' ? 'Small Disadvantage' : 'Large Disadvantage'}
                                </button>
                              ))}
                            </div>
                            {disadvantageType && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ fontSize: '11px', color: '#555' }}>Which option did you take?</div>
                                {disadvData[disadvantageType].map((opt: string) => (
                                  <button key={opt} onClick={() => setDisadvantageOption(disadvantageOption === opt ? '' : opt)} style={{
                                    padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '13px',
                                    border: `1px solid ${disadvantageOption === opt ? '#F9B051' : '#2a2a2a'}`,
                                    background: disadvantageOption === opt ? '#F9B05111' : 'transparent',
                                    color: disadvantageOption === opt ? '#F9B051' : '#888',
                                  }}>
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Score preview */}
                  {isScoreValid() && (
                    <div style={{ background: '#111', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#555' }}>Preview</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#4DB26E' }}>{computeScore().score_label}</span>
                    </div>
                  )}
                </div>
              )}

              {error && <p style={{ color: '#EA4742', fontSize: '13px', margin: 0 }}>{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!selectedEvent || !isScoreValid() || submitting}
                style={{
                  padding: '16px', borderRadius: '10px', border: 'none', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                  background: selectedEvent && isScoreValid() ? '#EA4742' : '#1a1a1a',
                  color: selectedEvent && isScoreValid() ? '#fff' : '#444',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Score'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Post-game popup (Feature 4) ─────────────────────────────────────── */}
      {showPostGamePopup && player && (() => {
        const dismissPopup = () => {
          const key = `dismissed_sessions_${player.id}`
          const dismissed: string[] = JSON.parse(localStorage.getItem(key) || '[]')
          dismissed.push(sessionId as string)
          localStorage.setItem(key, JSON.stringify(dismissed))
          setShowPostGamePopup(false)
        }

        const myStanding = standings.find(s => s.player_id === player.id) ?? standings.find(s => s.player_name === (player.display_name || player.username || player.full_name))
        const totalPlayers = standings.length
        const myPlacement = myStanding ? standings.indexOf(myStanding) + 1 : null

        // Grade colour data
        const GRADES = [
          { name: 'Mā', colour: '#ffffff', textColour: '#000', threshold: 0 },
          { name: 'Kiwikiwi', colour: '#888888', textColour: '#fff', threshold: 500 },
          { name: 'Whero', colour: '#EA4742', textColour: '#fff', threshold: 1000 },
          { name: 'Karaka', colour: '#F9B051', textColour: '#000', threshold: 2000 },
          { name: 'Kōwhai', colour: '#FFE566', textColour: '#000', threshold: 3000 },
          { name: 'Kākāriki', colour: '#4DB26E', textColour: '#fff', threshold: 4000 },
          { name: 'Kahurangi', colour: '#2371BB', textColour: '#fff', threshold: 5000 },
          { name: 'Poroporo', colour: '#B87DB5', textColour: '#fff', threshold: 6000 },
          { name: 'Uenuku', colour: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)', textColour: '#fff', threshold: 8000 },
          { name: 'Taniwha', colour: '#000000', textColour: '#fff', threshold: 10000 },
        ]

        const currentTotal = prevTotalPoints || 0
        const newTotal = currentTotal + (postGamePoints || 0)
        const prevGrade = GRADES.reduce((acc, g) => currentTotal >= g.threshold ? g : acc, GRADES[0])
        const newGrade = GRADES.reduce((acc, g) => newTotal >= g.threshold ? g : acc, GRADES[0])
        const colourLevelUp = newGrade.threshold > prevGrade.threshold

        const ordSuffix = (n: number) => (n % 100 >= 11 && n % 100 <= 13) ? 'th' : (['th','st','nd','rd'][n % 10] ?? 'th')

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.95)', zIndex: 300, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px' }}>
            <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Header */}
              <div style={{ background: '#111', borderRadius: '14px', padding: '24px', textAlign: 'center', border: '1px solid #2371BB' }}>
                <div style={{ fontSize: '11px', color: '#2371BB', letterSpacing: '2px', marginBottom: '8px' }}>
                  {session?.location} · {session?.session_date ? new Date(session.session_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                </div>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '36px', letterSpacing: '2px', color: '#fff', lineHeight: 1 }}>Session Complete</div>
              </div>

              {/* Placement */}
              <div style={{ background: '#111', borderRadius: '12px', padding: '20px', border: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '12px', letterSpacing: '1px' }}>YOUR PLACEMENT</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {myPlacement && (
                    <div style={{ flex: 1, background: '#0a0a0a', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '32px', color: '#F9B051' }}>
                        {myPlacement}{ordSuffix(myPlacement)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>of {totalPlayers} players (All-Divisions)</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Per-event breakdown */}
              <div style={{ background: '#111', borderRadius: '12px', padding: '20px', border: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '12px', letterSpacing: '1px' }}>EVENT BREAKDOWN</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {events.map(ev => {
                    const myResult = results.find(r => r.event_id === ev.id && r.player_id === player.id)
                    const eventScores = getEventScores(ev.id)
                    const myPlace = myStanding?.placements[ev.id]
                    return (
                      <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', color: '#ccc' }}>{ev.event_name}</div>
                          <div style={{ fontSize: '11px', color: myResult ? '#4DB26E' : '#555', marginTop: '1px' }}>
                            {myResult ? myResult.score_label : 'No score'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '13px', color: myPlace === 1 ? '#F9B051' : '#888', fontWeight: myPlace === 1 ? 'bold' : 'normal' }}>
                          {myPlace ? `#${myPlace}` : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Points earned */}
              {postGamePoints !== null && (
                <div style={{ background: '#0d2e1a', borderRadius: '12px', padding: '20px', border: '1px solid #4DB26E', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#4DB26E', marginBottom: '6px' }}>Points Earned This Session</div>
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '48px', color: '#fff', lineHeight: 1 }}>+{postGamePoints}</div>
                </div>
              )}

              {/* Colour level-up moment */}
              {colourLevelUp && (() => {
                const isRainbow = newGrade.colour.startsWith('linear')
                const isTaniwha = newGrade.name === 'Taniwha'
                return (
                  <div style={{
                    borderRadius: '12px', padding: '24px', textAlign: 'center', overflow: 'hidden',
                    ...(isRainbow ? { backgroundImage: newGrade.colour } : { background: isTaniwha ? '#000' : newGrade.colour }),
                    border: isTaniwha ? '2px solid #F9B051' : 'none',
                    animation: 'pulse 2s infinite',
                  }}>
                    <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.85} }`}</style>
                    <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '40px', color: newGrade.textColour, letterSpacing: '2px', lineHeight: 1 }}>
                      {newGrade.name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '14px', color: newGrade.textColour, opacity: 0.8, marginTop: '8px' }}>
                      You've reached {newGrade.name}! Keep going.
                    </div>
                  </div>
                )
              })()}

              {/* Close */}
              <button onClick={dismissPopup} style={{
                padding: '16px', borderRadius: '10px', border: 'none', background: '#2371BB',
                color: '#fff', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
              }}>
                Nice work — close
              </button>

            </div>
          </div>
        )
      })()}
    </div>
  )
}
