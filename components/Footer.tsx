import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      padding: '60px 0 32px',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rainbow)' }} />
      <style>{`
        .footer-link { color: var(--grey-light); font-size: 14px; transition: color 0.2s; display: block; }
        .footer-link:hover { color: var(--red); }
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
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            }}>
              <img src="/logo.png" alt="AllSport" style={{ height: 34 }} />
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '30px',
                letterSpacing: '0.09em',
                lineHeight: 1,
              }}>
                ALL<span style={{ color: 'var(--red)' }}>SPORT</span>
              </span>
            </div>
            <p style={{ color: 'var(--grey)', fontSize: '14px', lineHeight: '1.7', maxWidth: '260px' }}>
              One sport, every sport. A koha-based community sport built in
              Ōtautahi for everyone in Aotearoa.
            </p>
          </div>

          <div>
            <div style={{
              fontFamily: 'var(--font-label)',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--grey)',
              marginBottom: '16px',
            }}>Navigation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { href: '/', label: 'Home' },
                { href: '/how-to-play', label: 'How To Play' },
                { href: '/schedule', label: 'Schedule' },
                { href: '/leaderboard', label: 'Leaderboard' },
                { href: '/koha', label: 'Koha' },
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
              fontFamily: 'var(--font-label)',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--grey)',
              marginBottom: '16px',
            }}>Find us</div>
            <p style={{ color: 'var(--grey-light)', fontSize: '14px', lineHeight: '1.7' }}>
              26 Carbine Place, Sockburn<br />
              Ōtautahi Christchurch, Aotearoa
            </p>
            <p style={{ color: 'var(--grey)', fontSize: '13px', marginTop: '8px' }}>
              Tue &amp; Thu 4:30pm · Sat 9:00am
            </p>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <p style={{ color: '#555555', fontSize: '13px' }}>
            © {new Date().getFullYear()} AllSport. Mahi. Mauri. Mana.
          </p>
          <p style={{ color: '#555555', fontSize: '13px' }}>
            Built in Ōtautahi, Aotearoa
          </p>
        </div>
      </div>
    </footer>
  )
}
