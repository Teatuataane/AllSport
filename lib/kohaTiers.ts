// The koha thank-you ladder, shared by the public /koha page and a player's
// /my-koha progress so the two can never promise different things.
//
// Pure data, no React or Supabase, so a server component can import it.
//
// Reviewed 14 Oct 2026: cut from nine tiers to five, every reward something we
// can hand over within a week. Personal coaching left the ladder: it is now its
// own offer on /koha with a recommended koha per session. The referral path is
// off (`referralsNeeded: null`) until players can actually share an invite link
// (`/join/[code]` in TODOS.md); a referral that cannot be made should not be
// promised.
export interface KohaTier {
  tier: number
  reward: string
  desc: string
  color: string
  donationMin: number
  referralsNeeded: number | null
}

export const KOHA_TIERS: KohaTier[] = [
  { tier: 1, reward: 'Supporters Wall', desc: 'Your name on the supporters wall. Every gift counts.', color: '#888888', donationMin: 0, referralsNeeded: null },
  { tier: 2, reward: 'Sticker Pack', desc: 'AllSport stickers and a handwritten thank you.', color: '#4DB26E', donationMin: 100, referralsNeeded: null },
  { tier: 3, reward: 'Colours Tee', desc: 'A tee in your highest colour this year.', color: '#2371BB', donationMin: 250, referralsNeeded: null },
  { tier: 4, reward: 'Colours Hoodie', desc: 'A hoodie in your highest colour this year.', color: '#B87DB5', donationMin: 500, referralsNeeded: null },
  { tier: 5, reward: 'AllSport Comes To You', desc: 'We run a game at your workplace, school or community.', color: '#F9B051', donationMin: 2000, referralsNeeded: null },
]

// Bank details for koha. Public on purpose: this is the charity's account.
export const KOHA_BANK = {
  name: 'AllSport Aotearoa',
  account: '02-1268-0168239-000',
}

export const KOHA_EMAIL = 'kiaora@allsport.nz'
