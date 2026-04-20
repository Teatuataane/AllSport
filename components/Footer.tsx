import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{
      background: '#111111',
      borderTop: '1px solid #2a2a2a',
      padding: '60px 0 32px',
    }}>
      <style>{`
        .footer-link { color: #cccccc; font-size: 14px; transition: color 0.2s; display: block; }
        .footer-link:hover { color: #e63946; }
      `}</style>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '48px',
          marginBottom: '48px',
        }}>
          <div>
            <div style={{
              fontFamily: 'Bebas Neue, cursive',
              fontSize: '32px',
              letterSpacing: '0.1em',
              marginBottom: '12px',
            }}>
              ALL<span style={{ color: '#e63946' }}>SPORT</span>
            </div>
            <p style={{ color: '#888888', fontSize: '14px', lineHeight: '1.7', maxWidth: '240px' }}>
              A gamified strength and conditioning programme. Compete. Score. Rise.
            </p>
          </div>

          <div>
            <div style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#888888',
              marginBottom: '16px',
            }}>Navigation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { href: '/', label: 'Home' },
                { href: '/how-to-play', label: 'How To Play' },
                { href: '/schedule', label: 'Schedule' },
                { href: '/leaderboard', label: 'Leaderboard' },
                { href: '/register', label: 'Register' },
              ].map(link => (
                <Link key={link.href} href={link.href} className="footer-link">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#888888',
              marginBottom: '16px',
            }}>Location</div>
            <p style={{ color: '#cccccc', fontSize: '14px', lineHeight: '1.7' }}>
              Christchurch, New Zealand
            </p>
            <p style={{ color: '#888888', fontSize: '13px', marginTop: '8px' }}>
              Sessions run multiple times per week
            </p>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid #2a2a2a',
          paddingTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <p style={{ color: '#555555', fontSize: '13px' }}>
            © {new Date().getFullYear()} AllSport. All rights reserved.
          </p>
          <p style={{ color: '#555555', fontSize: '13px' }}>
            Built in Christchurch, NZ 🇳🇿
          </p>
        </div>
      </div>
    </footer>
  )
}