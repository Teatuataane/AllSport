import Link from 'next/link'
import { RainbowText, SectionLabel } from '@/components/ui'

export const metadata = {
  title: 'Privacy Policy — AllSport',
  description:
    'How AllSport collects, uses, stores and shares your personal information, and the choices you have. Written for the New Zealand Privacy Act 2020.',
}

// Last substantive review of this page. Update whenever the content changes.
const LAST_UPDATED = '13 August 2026'

const CONTACT_EMAIL = 'tane.clement@gmail.com'

type Row = { what: string; why: string; who: string }

const accountData: Row[] = [
  {
    what: 'Name',
    why: 'To identify you at sessions, and for insurance and safeguarding records.',
    who: 'Kaiwhakawā. Shown to other players only if it is also your display name.',
  },
  {
    what: 'Email address',
    why: 'To create and sign in to your account, and to contact you about sessions.',
    who: 'Kaiwhakawā only. Never displayed on the site.',
  },
  {
    what: 'Password',
    why: 'To secure your account. Stored only by our authentication provider, hashed — we never see it.',
    who: 'Nobody, including us.',
  },
  {
    what: 'Date of birth',
    why: 'To place you in the right division and age group, and to know when a player is under 17.',
    who: 'Your age group is used in leaderboards. Kaiwhakawā can see the date itself.',
  },
  {
    what: 'Gender',
    why: 'To place you in a competition division. A kaiwhakawā can reassign your division on request.',
    who: 'Kaiwhakawā. Your division is public if you choose to show it.',
  },
  {
    what: 'Phone number',
    why: 'Optional. So a kaiwhakawā can reach you about a session or an injury on the day.',
    who: 'Kaiwhakawā only. Never displayed on the site.',
  },
  {
    what: 'City and region',
    why: 'Optional. To understand which communities we are reaching, which funders ask us to report on.',
    who: 'Kaiwhakawā only. Your location is never published on the site or shown to other players.',
  },
  {
    what: 'Username and display name',
    why: 'How you appear to other players on leaderboards and in sessions.',
    who: 'Public. Anyone visiting the site can see it.',
  },
  {
    what: 'Profile icon',
    why: 'A picture next to your name. Chosen from a fixed set — you cannot upload a photo.',
    who: 'Public.',
  },
]

const competitionData: Row[] = [
  {
    what: 'Your scores',
    why: 'To rank each event, work out placements and award points. This is the sport.',
    who: 'Public, next to your display name.',
  },
  {
    what: 'Placements, points and colours',
    why: 'To run leaderboards and the colour ladder, and to report participation to funders in aggregate.',
    who: 'Public.',
  },
  {
    what: 'Session attendance',
    why: 'To count sessions played, qualify referrals and report total attendances to funders.',
    who: 'Public that you played; kaiwhakawā for the detail.',
  },
  {
    what: 'Opponent names in head-to-head events',
    why: 'To record who played whom in match events such as Tennis or Arm Wrestling.',
    who: 'Public, as part of the result.',
  },
]

const wellbeingData: Row[] = [
  {
    what: 'WHO-5 wellbeing answers (5 questions)',
    why: 'To measure whether taking part in AllSport improves how people feel. Required evidence for our health and community funders.',
    who: 'Only you (and a parent, for a child profile). Kaiwhakawā see group averages only.',
  },
  {
    what: 'Days active in the last week, and self-rated fitness',
    why: 'To track physical activity change across the group over time.',
    who: 'Only you. Group averages only for everyone else.',
  },
  {
    what: 'Confidence, enjoyment and belonging answers',
    why: 'To check we are actually building the community we say we are.',
    who: 'Only you. Group averages only for everyone else.',
  },
]

const kohaData: Row[] = [
  {
    what: 'Koha amounts',
    why: 'To recognise supporters and to keep the charity’s financial records.',
    who: 'You and kaiwhakawā. Your name appears on the supporters wall only with your agreement.',
  },
  {
    what: 'Who referred you',
    why: 'To credit the player who invited you once you have played 10 sessions.',
    who: 'You, the player who referred you, and kaiwhakawā.',
  },
  {
    what: 'Your event votes',
    why: 'To choose the events for a competition by community vote.',
    who: 'Other players see counts only. Kaiwhakawā can see who voted for what.',
  },
]

const storageRows = [
  {
    name: 'sb-…-auth-token',
    kind: 'Cookie',
    purpose: 'Keeps you signed in. Set by our authentication provider and refreshed as you browse.',
    life: 'Until you sign out or it expires.',
  },
  {
    name: 'allsport_active_player_id',
    kind: 'Local storage',
    purpose: 'Remembers which family member’s profile you are currently viewing.',
    life: 'Until you clear your browser data.',
  },
  {
    name: 'pending_session_code',
    kind: 'Local storage',
    purpose: 'Holds a session code while you sign in, so you land in the right session.',
    life: 'Deleted as soon as you join.',
  },
  {
    name: 'allsport_postgame_…, allsport_effortmax_…, allsport_fullhouse_…',
    kind: 'Local storage',
    purpose: 'Remembers that you have already seen an end-of-session or celebration message, so it does not repeat.',
    life: 'Until you clear your browser data.',
  },
]

const thirdParties = [
  {
    name: 'Supabase',
    role: 'Database and sign-in',
    detail:
      'Stores everything described above, and handles passwords and Google sign-in. Our database is hosted in Sydney, Australia (AWS ap-southeast-2). Supabase Inc. is a United States company, so your information is stored and processed outside New Zealand.',
  },
  {
    name: 'Vercel',
    role: 'Website hosting',
    detail:
      'Serves the site. Its servers automatically log request information including your IP address, browser type and the pages you request, for security and reliability. Vercel Inc. is a United States company.',
  },
  {
    name: 'Google Fonts',
    role: 'Typefaces',
    detail:
      'Our fonts load from Google’s servers, which means Google receives your IP address and browser type when you open any page — including if you never sign up. We are moving these fonts onto our own site to remove this.',
  },
  {
    name: 'Google Sign-In',
    role: 'Optional sign-in',
    detail:
      'Only if you choose "Continue with Google". Google tells us your name and email address; we do not receive your Google password and we cannot see anything else in your Google account.',
  },
]

const rights = [
  {
    title: 'See what we hold',
    body: 'You can ask for a copy of everything we hold about you. Most of it is already on your dashboard, personal bests and profile pages.',
  },
  {
    title: 'Fix what is wrong',
    body: 'You can edit your username, display name, icon and visibility settings yourself on your profile. Ask a kaiwhakawā to correct anything else, including your division.',
  },
  {
    title: 'Delete your account',
    body: 'Email us and we will delete your account and personal details. Scores from sessions you played stay in the leaderboard history, but we detach them from your name and contact details.',
  },
  {
    title: 'Skip the wellbeing check-in',
    body: 'The wellbeing check-in is entirely voluntary. Close it and nothing is recorded. It will not affect your scores, your colour or anything else.',
  },
  {
    title: 'Choose what is public',
    body: 'Your visibility settings on your profile control whether your full name and division labels appear alongside your display name. They are applied in the database, not just in the page, so they hold everywhere.',
  },
  {
    title: 'Complain',
    body: 'If we get it wrong, tell us first and we will put it right. You can also complain to the Office of the Privacy Commissioner at privacy.org.nz.',
  },
]

const sectionStyle = { background: 'var(--dark)', borderTop: '1px solid var(--border)' }

function DataTable({ rows }: { rows: Row[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map(r => (
        <div key={r.what} className="privacy-row">
          <div className="privacy-row-what">{r.what}</div>
          <div className="privacy-row-body">
            <div style={{ color: 'var(--grey-light)', fontSize: '15px', lineHeight: 1.65 }}>{r.why}</div>
            <div className="privacy-row-who">
              <span style={{ color: '#555' }}>Who can see it — </span>
              {r.who}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PrivacyPolicy() {
  return (
    <>
      <style>{`
        .privacy-row { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; display: grid; grid-template-columns: minmax(180px, 240px) 1fr; gap: 24px; align-items: start; }
        .privacy-row-what { font-family: var(--font-label); font-size: 13px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--white); line-height: 1.4; }
        .privacy-row-body { display: flex; flex-direction: column; gap: 8px; }
        .privacy-row-who { font-size: 13px; color: var(--grey); font-family: var(--font-body); line-height: 1.6; }
        @media (max-width: 720px) {
          .privacy-row { grid-template-columns: 1fr; gap: 10px; padding: 18px 20px; }
        }
        .privacy-p { color: var(--grey-light); font-size: 16px; line-height: 1.8; max-width: 680px; margin-bottom: 16px; }
        .privacy-h2 { font-size: clamp(30px, 4vw, 42px); line-height: 1.05; margin-bottom: 8px; }
        .privacy-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px 26px; }
        .privacy-link { color: var(--red); text-decoration: none; border-bottom: 1px solid rgba(234,71,66,0.4); }
        .privacy-link:hover { border-bottom-color: var(--red); }
        .privacy-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      `}</style>

      {/* Hero */}
      <section style={{ paddingTop: '120px', paddingBottom: '72px', background: 'var(--black)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '15%', right: '6%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(35,113,187,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">Your Information</div>
          <h1 style={{ fontSize: 'clamp(52px, 8vw, 104px)', lineHeight: 0.92, marginBottom: '8px' }}>
            PRIVACY<br />
            <RainbowText>POLICY</RainbowText>
          </h1>
          <div className="rainbow-line" style={{ width: '88px', margin: '20px 0 28px', borderRadius: '2px' }} />
          <p style={{ color: 'var(--grey-light)', fontSize: '20px', maxWidth: '660px', lineHeight: 1.7 }}>
            AllSport is a koha-based community sport. We collect the least we can get away with,
            we do not sell anything to anyone, and we will tell you plainly what we hold.
          </p>
          <div style={{ marginTop: '24px', fontFamily: 'var(--font-label)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#555' }}>
            Last updated {LAST_UPDATED}
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid var(--green)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>The Short Version</SectionLabel>
          <h2 className="privacy-h2">IN PLAIN <span style={{ color: 'var(--green)' }}>WORDS</span></h2>
          <div className="privacy-grid-2" style={{ marginTop: '32px' }}>
            {[
              ['Your scores are public', 'AllSport is a competition. Your display name, scores, placements and colour are visible to anyone — that is how a leaderboard works.'],
              ['Your contact details are not', 'Your email, phone number and date of birth are never shown anywhere on the site. They are for kaiwhakawā to run sessions and keep you safe.'],
              ['The wellbeing check-in is yours', 'Nobody at AllSport can read your individual answers. Kaiwhakawā only ever see group averages, and only when at least three people have answered.'],
              ['We do not sell or advertise', 'No advertising, no tracking pixels, no analytics, no data broker. We have never sold personal information and we will not.'],
              ['You can leave', 'Ask us and we will delete your account and your personal details.'],
              ['You choose your name', 'Play under a username. You never have to show your legal name to other players.'],
            ].map(([title, body]) => (
              <div key={title} className="privacy-card">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.04em', color: 'var(--white)', marginBottom: '8px' }}>{title}</div>
                <div style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who we are */}
      <section className="section" style={sectionStyle}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Who We Are</SectionLabel>
          <h2 className="privacy-h2">WHO HOLDS <RainbowText>YOUR DATA</RainbowText></h2>
          <div style={{ marginTop: '28px' }}>
            <p className="privacy-p">
              AllSport is run by <strong style={{ color: 'var(--white)' }}>Te Kura ō ngā Koha/Allsport Aotearoa</strong>,
              a charitable trust board incorporated under the Charitable Trusts Act 1957 and registered with Charities Services.
              We are based at 26 Carbine Place, Sockburn, Ōtautahi Christchurch.
            </p>
            <p className="privacy-p">
              This policy covers the AllSport website and app at allsport.nz. It is written to meet the
              New Zealand Privacy Act 2020. In this policy, &ldquo;we&rdquo; means the trust, and
              &ldquo;kaiwhakawā&rdquo; means the judges who run sessions and hold administrator accounts.
            </p>
            <p className="privacy-p">
              For anything about your privacy — a question, a correction, a copy of your information, or a deletion —
              email <a className="privacy-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              We aim to reply within 5 working days, and the Privacy Act gives us 20 working days at the outside.
            </p>
          </div>
        </div>
      </section>

      {/* Account and profile */}
      <section className="section" style={{ ...sectionStyle, background: '#0d0d0d' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>What We Collect</SectionLabel>
          <h2 className="privacy-h2">YOUR <span style={{ color: 'var(--red)' }}>ACCOUNT</span></h2>
          <p className="privacy-p" style={{ marginTop: '16px', marginBottom: '28px' }}>
            Collected when you register, or when you sign in with Google and finish your profile.
            Only your name, email, password, date of birth and username are required — everything else you can leave blank.
          </p>
          <DataTable rows={accountData} />
        </div>
      </section>

      {/* Competition */}
      <section className="section" style={sectionStyle}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>What We Collect</SectionLabel>
          <h2 className="privacy-h2">YOUR <span style={{ color: 'var(--amber)' }}>RESULTS</span></h2>
          <p className="privacy-p" style={{ marginTop: '16px', marginBottom: '28px' }}>
            Collected every time you or a kaiwhakawā records a score during a session. This is the public
            part of AllSport — a leaderboard only works if the results are on it.
          </p>
          <DataTable rows={competitionData} />
        </div>
      </section>

      {/* Wellbeing */}
      <section className="section" style={{ ...sectionStyle, background: '#0d0d0d', borderTop: '3px solid var(--purple)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>What We Collect</SectionLabel>
          <h2 className="privacy-h2">THE WELLBEING <span style={{ color: 'var(--purple)' }}>CHECK-IN</span></h2>
          <p className="privacy-p" style={{ marginTop: '16px' }}>
            About once every three months we may show you a 10-question check-in on your dashboard.
            It uses the WHO-5 Wellbeing Index and two standard activity questions. Your answers say something
            about your health, so we treat them more carefully than anything else on this page.
          </p>
          <p className="privacy-p" style={{ marginBottom: '28px' }}>
            <strong style={{ color: 'var(--white)' }}>It is voluntary.</strong> You can close it and nothing is saved.
            Skipping it has no effect on your scores, points, colour or standing. Kaiwhakawā can never read your
            individual answers — the report they see shows group averages only, and hides any group with fewer
            than three responses so no single person can be identified. We use those averages to show funders
            whether AllSport actually improves wellbeing.
          </p>
          <DataTable rows={wellbeingData} />
        </div>
      </section>

      {/* Koha */}
      <section className="section" style={sectionStyle}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>What We Collect</SectionLabel>
          <h2 className="privacy-h2">KOHA, REFERRALS <span style={{ color: 'var(--blue)' }}>AND VOTES</span></h2>
          <p className="privacy-p" style={{ marginTop: '16px', marginBottom: '28px' }}>
            We do not take payments through this website. There is no card processor and we never see or
            store card or bank details. Koha is given by bank transfer or in person, and a kaiwhakawā
            records the amount against your name by hand.
          </p>
          <DataTable rows={kohaData} />
        </div>
      </section>

      {/* Tamariki */}
      <section className="section" style={{ ...sectionStyle, background: '#0d0d0d', borderTop: '3px solid var(--blue)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Tamariki And Rangatahi</SectionLabel>
          <h2 className="privacy-h2">PLAYERS UNDER <span style={{ color: 'var(--blue)' }}>17</span></h2>
          <div style={{ marginTop: '28px' }}>
            <p className="privacy-p">
              Juniors are welcome at AllSport and a lot of our mahi is aimed at rangatahi. If a player is
              under 17, we also collect a parent or guardian&apos;s name, email address and phone number, so
              that we can reach someone responsible about a session, an injury or a concern. That is the only
              reason we hold it.
            </p>
            <p className="privacy-p">
              A parent or guardian can create and manage profiles for their tamariki from their own account.
              If you do that, you can see and change everything on your child&apos;s profile, including their
              wellbeing check-in answers.
            </p>
            <p className="privacy-p">
              A junior&apos;s display name, age group, scores and placements appear on public leaderboards in the
              same way as any other player. If you would rather your child appeared under a username only, that is
              the default — you do not have to show a full name. Ask a kaiwhakawā if you want a junior removed
              from public leaderboards entirely.
            </p>
          </div>
        </div>
      </section>

      {/* Guests */}
      <section className="section" style={sectionStyle}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Guests</SectionLabel>
          <h2 className="privacy-h2">IF YOU PLAYED <span style={{ color: 'var(--pink)' }}>WITHOUT AN ACCOUNT</span></h2>
          <div style={{ marginTop: '28px' }}>
            <p className="privacy-p">
              You can play AllSport without ever making an account. When you do, a kaiwhakawā writes down the
              name you give them so your scores can be ranked against everyone else&apos;s that session. That
              name and those scores are visible on the session leaderboard, the same as any other player.
            </p>
            <p className="privacy-p">
              We hold nothing else about you — no email, no phone number, no date of birth. Give us a first
              name or a nickname if you would rather. If you want your name taken off a past session, email us
              and we will remove it.
            </p>
          </div>
        </div>
      </section>

      {/* Third parties */}
      <section className="section" style={{ ...sectionStyle, background: '#0d0d0d' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Who Else Sees It</SectionLabel>
          <h2 className="privacy-h2">SERVICES WE <RainbowText>RELY ON</RainbowText></h2>
          <p className="privacy-p" style={{ marginTop: '16px', marginBottom: '28px' }}>
            We are a small charity and we do not run our own servers. These are the only companies your
            information reaches, and each is used strictly to run AllSport. We do not use advertising networks,
            analytics services, social media pixels or data brokers — there are none on this site.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {thirdParties.map(t => (
              <div key={t.name} className="privacy-card">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '0.04em', color: 'var(--white)' }}>{t.name}</span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--grey)' }}>{t.role}</span>
                </div>
                <div style={{ color: 'var(--grey-light)', fontSize: '15px', lineHeight: 1.7 }}>{t.detail}</div>
              </div>
            ))}
          </div>
          <p className="privacy-p" style={{ marginTop: '28px' }}>
            Because these companies are based overseas, your information is stored and processed outside
            New Zealand — our database sits in Sydney, Australia. We only use providers that are required
            to protect it to a standard comparable to the Privacy Act 2020.
          </p>
          <p className="privacy-p">
            We will also share information where we are legally required to, or where it is necessary to prevent
            a serious threat to someone&apos;s safety.
          </p>
        </div>
      </section>

      {/* Cookies */}
      <section className="section" style={sectionStyle}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Cookies</SectionLabel>
          <h2 className="privacy-h2">WHAT WE STORE <span style={{ color: 'var(--amber)' }}>ON YOUR DEVICE</span></h2>
          <p className="privacy-p" style={{ marginTop: '16px', marginBottom: '28px' }}>
            We use one cookie, and it exists only to keep you signed in. We do not use tracking or advertising
            cookies, which is why you have never seen a cookie banner here. Everything else below is stored
            locally in your own browser and never sent to us.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {storageRows.map(s => (
              <div key={s.name} className="privacy-row">
                <div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--white)', wordBreak: 'break-word', marginBottom: '6px' }}>{s.name}</div>
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--grey)' }}>{s.kind}</div>
                </div>
                <div className="privacy-row-body">
                  <div style={{ color: 'var(--grey-light)', fontSize: '15px', lineHeight: 1.65 }}>{s.purpose}</div>
                  <div className="privacy-row-who"><span style={{ color: '#555' }}>Kept for — </span>{s.life}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Retention */}
      <section className="section" style={{ ...sectionStyle, background: '#0d0d0d' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>How Long</SectionLabel>
          <h2 className="privacy-h2">WHAT WE <span style={{ color: 'var(--green)' }}>KEEP</span></h2>
          <div style={{ marginTop: '28px' }}>
            <p className="privacy-p">
              <strong style={{ color: 'var(--white)' }}>Your account and contact details</strong> — kept while your
              account is open. If you ask us to delete your account, or if you have not played for three years and
              do not respond when we check in, we delete them.
            </p>
            <p className="privacy-p">
              <strong style={{ color: 'var(--white)' }}>Your scores, placements and colours</strong> — kept
              indefinitely. Colours are a lifetime record and a competition history is not much use with holes in
              it. If you delete your account, these stay as part of the session record but are separated from
              your name and contact details.
            </p>
            <p className="privacy-p">
              <strong style={{ color: 'var(--white)' }}>Wellbeing check-in answers</strong> — kept for as long as
              you have an account, and deleted with it. Once answers are rolled into a group average for a funder
              report, that average cannot be traced back to you.
            </p>
            <p className="privacy-p">
              <strong style={{ color: 'var(--white)' }}>Koha records</strong> — kept for seven years, because
              charity financial records have to be.
            </p>
          </div>
        </div>
      </section>

      {/* Rights */}
      <section className="section" style={{ ...sectionStyle, borderTop: '3px solid var(--red)' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Your Rights</SectionLabel>
          <h2 className="privacy-h2">WHAT YOU <RainbowText>CAN ASK FOR</RainbowText></h2>
          <p className="privacy-p" style={{ marginTop: '16px', marginBottom: '28px' }}>
            The Privacy Act 2020 gives you these rights. We would honour them anyway — email{' '}
            <a className="privacy-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and ask.
            There is no charge.
          </p>
          <div className="privacy-grid-2">
            {rights.map(r => (
              <div key={r.title} className="privacy-card">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.04em', color: 'var(--white)', marginBottom: '8px' }}>{r.title}</div>
                <div style={{ color: 'var(--grey)', fontSize: '15px', lineHeight: 1.7 }}>{r.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="section" style={{ ...sectionStyle, background: '#0d0d0d' }}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Security</SectionLabel>
          <h2 className="privacy-h2">HOW WE <span style={{ color: 'var(--blue)' }}>PROTECT IT</span></h2>
          <div style={{ marginTop: '28px' }}>
            <p className="privacy-p">
              Everything travels over an encrypted connection. Passwords are hashed by our authentication
              provider and are never visible to us. Our database uses row-level security so that records such as
              your wellbeing answers, koha and referrals can only be read by the accounts entitled to see them.
              Administrator access is limited to kaiwhakawā, and today that is a single person.
            </p>
            <p className="privacy-p">
              No system is perfect. If we ever have a privacy breach that could cause you serious harm, we will
              tell you and notify the Office of the Privacy Commissioner, as the Privacy Act requires.
            </p>
          </div>
        </div>
      </section>

      {/* Changes + contact */}
      <section className="section" style={sectionStyle}>
        <div className="container">
          <SectionLabel style={{ marginBottom: 16 }}>Changes</SectionLabel>
          <h2 className="privacy-h2">IF THIS <span style={{ color: 'var(--amber)' }}>CHANGES</span></h2>
          <div style={{ marginTop: '28px' }}>
            <p className="privacy-p">
              We update this page when what we do changes. The date at the top always tells you when it was last
              reviewed. If we start collecting something meaningfully new, or use what we already hold for a new
              purpose, we will tell players directly rather than quietly editing this page.
            </p>
            <div className="privacy-card" style={{ marginTop: '32px', maxWidth: '560px', borderLeft: '4px solid var(--red)' }}>
              <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--grey)', marginBottom: '10px' }}>Contact</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.04em', color: 'var(--white)', marginBottom: '10px' }}>Te Kura ō ngā Koha/Allsport Aotearoa</div>
              <div style={{ color: 'var(--grey-light)', fontSize: '15px', lineHeight: 1.8 }}>
                26 Carbine Place, Sockburn<br />
                Ōtautahi Christchurch, Aotearoa New Zealand<br />
                <a className="privacy-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </div>
            </div>
            <p className="privacy-p" style={{ marginTop: '32px' }}>
              Not satisfied with how we handle it? The Office of the Privacy Commissioner can investigate.
              Visit <a className="privacy-link" href="https://www.privacy.org.nz" target="_blank" rel="noopener noreferrer">privacy.org.nz</a> or call 0800 803 909.
            </p>
            <div style={{ marginTop: '40px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/how-to-play" className="btn btn-outline">How To Play</Link>
              <Link href="/register" className="btn btn-primary">Join AllSport</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
