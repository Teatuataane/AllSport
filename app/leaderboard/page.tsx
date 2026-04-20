'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

type RankingRow = {
  id: string
  player_id: string
  total_points: number
  total_sessions: number
  average_placement: number | null
  average_score: number | null
  division: string
  // Supabase returns joins as array; we always take index 0
  players: { display_name: string | null; username: string | null }[] | { display_name: string | null; username: string | null } | null
}

type EnrichedPlayer = {
  rank: number
  username: string
  sessions: number
  avgPlacement: number
  totalPoints: number
  name: string
  color: string
}

function getGrade(points: number): { name: string; color: string } {
  if (points >= 10000) return { name: 'Taniwha', color: '#ffffff' }
  if (points >= 8000) return { name: 'Uenuku', color: '#f4a226' }
  if (points >= 6000) return { name: 'Poroporo', color: '#9333ea' }
  if (points >= 5000) return { name: 'Kahurangi', color: '#2563eb' }
  if (points >= 4000) return { name: 'Kākāriki', color: '#2d9e4f' }
  if (points >= 3000) return { name: 'Kōwhai', color: '#f7e03c' }
  if (points >= 2000) return { name: 'Karaka', color: '#f4a226' }
  if (points >= 1000) return { name: 'Whero', color: '#e63946' }
  if (points >= 500) return { name: 'Kiwikiwi', color: '#888888' }
  return { name: 'Mā', color: '#e8e8e8' }
}

const DIVISION_MAP: Record<string, string> = {
  men: "Men's",
  women: "Women's",
  juniors: 'Juniors',
}

const grades = [
  { name: 'Mā', meaning: 'White', color: '#e8e8e8', points: '0 pts' },
  { name: 'Kiwikiwi', meaning: 'Grey', color: '#888888', points: '500 pts' },
  { name: 'Whero', meaning: 'Red', color: '#e63946', points: '1,000 pts' },
  { name: 'Karaka', meaning: 'Orange', color: '#f4a226', points: '2,000 pts' },
  { name: 'Kōwhai', meaning: 'Yellow', color: '#f7e03c', points: '3,000 pts' },
  { name: 'Kākāriki', meaning: 'Green', color: '#2d9e4f', points: '4,000 pts' },
  { name: 'Kahurangi', meaning: 'Blue', color: '#2563eb', points: '5,000 pts' },
  { name: 'Poroporo', meaning: 'Purple', color: '#9333ea', points: '6,000 pts' },
  { name: 'Uenuku', meaning: 'Rainbow', color: '#f4a226', points: '8,000 pts' },
  { name: 'Taniwha', meaning: 'The Highest', color: '#ffffff', points: '10,000+ pts' },
]

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const tabs = [
  { key: 'men', label: 'Men', color: '#2563eb' },
  { key: 'women', label: 'Women', color: '#e63946' },
  { key: 'juniors', label: 'Juniors', color: '#2d9e4f', subtitle: 'Under 16' },
]

function LeaderboardTable({ data, accentColor, loading }: { data: EnrichedPlayer[]; accentColor: string; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: '56px', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
        <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '32px', marginBottom: '8px' }}>No rankings yet</div>
        <p style={{ fontFamily: 'Barlow, sans-serif', fontSize: '15px' }}>Rankings appear once sessions begin.</p>
      </div>
    )
  }

  return (
    <>
      {/* Top 3 podium */}
      {data.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxWidth: '680px', marginBottom: '40px' }}>
          {/* 2nd */}
          <div style={{ background: '#111111', border: '1px solid #c0c0c022', padding: '24px 16px', textAlign: 'center', marginTop: '28px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#c0c0c0' }} />
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>🥈</div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '44px', color: '#c0c0c0', lineHeight: 1 }}>2</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '14px', color: '#ffffff', marginTop: '6px' }}>{data[1]?.username ?? '—'}</div>
            <div style={{ color: data[1]?.color, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{data[1]?.name}</div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '24px', color: '#666666', marginTop: '8px' }}>{data[1]?.totalPoints} pts</div>
          </div>
          {/* 1st */}
          <div style={{ background: 'linear-gradient(180deg, #0d0505 0%, #111111 100%)', border: `1px solid ${accentColor}44`, padding: '32px 16px 24px', textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${accentColor}, #f4a226)` }} />
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>🥇</div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '56px', color: accentColor, lineHeight: 1 }}>1</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '16px', color: '#ffffff', marginTop: '6px' }}>{data[0]?.username ?? '—'}</div>
            <div style={{ color: data[0]?.color, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{data[0]?.name}</div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: accentColor, marginTop: '8px' }}>{data[0]?.totalPoints} pts</div>
          </div>
          {/* 3rd */}
          <div style={{ background: '#111111', border: '1px solid #cd7f3222', padding: '24px 16px', textAlign: 'center', marginTop: '28px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#cd7f32' }} />
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>🥉</div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '44px', color: '#cd7f32', lineHeight: 1 }}>3</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '14px', color: '#ffffff', marginTop: '6px' }}>{data[2]?.username ?? '—'}</div>
            <div style={{ color: data[2]?.color, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{data[2]?.name}</div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '24px', color: '#666666', marginTop: '8px' }}>{data[2]?.totalPoints} pts</div>
          </div>
        </div>
      )}

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 90px 110px 110px 160px', gap: '16px', padding: '10px 24px' }}>
        {['#', 'Player', 'Sessions', 'Avg Place', 'Total Pts', 'Grade'].map(h => (
          <div key={h} style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444444' }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {data.map(player => (
          <div key={player.rank} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 90px 110px 110px 160px', gap: '16px', padding: '14px 24px', alignItems: 'center', border: '1px solid', borderColor: player.rank === 1 ? `${accentColor}22` : '#1a1a1a', background: '#0d0d0d' }}>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: player.rank <= 3 ? player.color : '#333333' }}>{medals[player.rank] || player.rank}</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '16px', color: '#ffffff' }}>{player.username}</div>
            <div style={{ color: '#555555', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif' }}>{player.sessions}</div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: accentColor }}>{player.avgPlacement > 0 ? player.avgPlacement.toFixed(1) : '—'}</div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#ffffff' }}>{player.totalPoints}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: player.name === 'Uenuku' ? 'linear-gradient(135deg, #e63946, #f4a226, #2d9e4f, #2563eb, #9333ea)' : player.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '13px', color: player.color }}>{player.name}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('men')
  const [rankings, setRankings] = useState<RankingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('rankings')
      .select('id, player_id, total_points, total_sessions, average_placement, average_score, division, players(display_name, username)')
      .order('total_points', { ascending: false })
      .then(({ data }) => {
        setRankings(data || [])
        setLoading(false)
      })
  }, [])

  const getTabData = (tabKey: string): EnrichedPlayer[] => {
    const division = DIVISION_MAP[tabKey]
    return rankings
      .filter(r => r.division === division)
      .map((r, i) => {
        const p = Array.isArray(r.players) ? r.players[0] : r.players
      const username = p?.display_name || p?.username || 'Anonymous'
        const grade = getGrade(r.total_points)
        return {
          rank: i + 1,
          username,
          sessions: r.total_sessions,
          avgPlacement: r.average_placement ?? 0,
          totalPoints: r.total_points,
          ...grade,
        }
      })
  }

  const activeTabData = tabs.find(t => t.key === activeTab)!
  const tabData = getTabData(activeTab)

  return (
    <>
      <style>{`
        .rank-pill { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #0d0d0d; border: 1px solid #1a1a1a; transition: background 0.2s; }
        .rank-pill:hover { background: #111111; }
        .tab-btn { font-family: 'Bebas Neue', cursive; font-size: 22px; letter-spacing: 0.08em; padding: 12px 32px; cursor: pointer; border: 1px solid #1e1e1e; background: #0d0d0d; color: #555555; transition: all 0.2s; }
        .tab-btn:hover { color: #ffffff; border-color: #333; }
        .tab-btn.active { color: #ffffff; }
      `}</style>

      {/* Hero */}
      <section style={{ paddingTop: '152px', paddingBottom: '80px', background: '#000000', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">2026 Season</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.95, marginBottom: '8px' }}>
            LEADER<br />
            <span style={{ background: 'linear-gradient(90deg, #2563eb, #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>BOARD</span>
          </h1>
          <div className="rainbow-line" style={{ width: '80px', marginBottom: '28px' }} />
          <p style={{ color: '#cccccc', fontSize: '20px', maxWidth: '560px', lineHeight: 1.7 }}>
            Current season standings across three divisions. Points accumulate throughout the year — grades are awarded at year end. Leaderboard resets each January.
          </p>
        </div>
      </section>

      {/* Tabs + table */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #2563eb' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '4px', marginBottom: '48px', flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button key={tab.key} className={`tab-btn${activeTab === tab.key ? ' active' : ''}`} onClick={() => setActiveTab(tab.key)}
                style={{ background: activeTab === tab.key ? tab.color : '#0d0d0d', borderColor: activeTab === tab.key ? tab.color : '#1e1e1e', color: activeTab === tab.key ? '#ffffff' : '#555555' }}>
                {tab.label}
                {tab.subtitle && <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>{tab.subtitle}</span>}
              </button>
            ))}
          </div>
          <div className="tag">{activeTabData.label} Division</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginBottom: '32px' }}>
            <span style={{ color: activeTabData.color }}>{activeTabData.label.toUpperCase()}</span> RANKINGS
          </h2>
          <LeaderboardTable data={tabData} accentColor={activeTabData.color} loading={loading} />
        </div>
      </section>

      {/* Grade key */}
      <section className="section" style={{ background: '#0a0a0a' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #e63946, #f4a226, #f7e03c, #2d9e4f, #2563eb, #9333ea)', marginTop: '-80px', marginBottom: '80px' }} />
        <div className="container">
          <div className="tag">Grade Thresholds</div>
          <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
            GRADE <span style={{ background: 'linear-gradient(90deg, #e63946, #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>KEY</span>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', marginBottom: '16px' }} />
          <p style={{ color: '#888888', fontSize: '15px', maxWidth: '560px', marginBottom: '40px', lineHeight: 1.7 }}>
            Collect points every time you play. Your total at year end determines your grade. Grades reset each January — your history is kept forever.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
            {grades.map(grade => (
              <div key={grade.name} className="rank-pill">
                <div style={{ width: '28px', height: '18px', borderRadius: '3px', flexShrink: 0, background: grade.name === 'Uenuku' ? 'linear-gradient(135deg, #e63946, #f4a226, #2d9e4f, #2563eb, #9333ea)' : grade.name === 'Taniwha' ? '#111111' : grade.color, border: grade.name === 'Taniwha' ? '1px solid #555' : 'none', boxShadow: `0 0 5px ${grade.color}44` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '18px', color: grade.color, lineHeight: 1 }}>{grade.name}</div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#444444' }}>{grade.meaning}</div>
                </div>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '16px', color: '#555555' }}>{grade.points}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '24px' }}>
            <Link href="/koha" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d9e4f', borderBottom: '1px solid #2d9e4f', paddingBottom: '2px' }}>
              Learn about Koha rewards for grade achievers →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: '#000000', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            GET ON THE <span style={{ background: 'linear-gradient(90deg, #2563eb, #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>BOARD</span>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px' }} />
          <p style={{ color: '#888888', fontSize: '16px', maxWidth: '400px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            The only way to appear on this leaderboard is to register and compete. Your journey starts at Mā.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '20px' }}>Register Now</Link>
        </div>
      </section>
    </>
  )
}
