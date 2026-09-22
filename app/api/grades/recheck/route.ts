// ─── POST /api/grades/recheck ────────────────────────────────────────────────
// A colour confers itself. The player's own screen asks the server to
// re-examine them; the server re-runs lib/grading.ts — the SAME module the
// browser runs — and writes what they have earned.
//
// docs/designs/auto-conferral-spec.md. The security argument, in one line:
// THE CLIENT ASSERTS NOTHING. It does not send a colour, a rung or a score. It
// sends "check me", and everything the answer rests on is read here, through
// the caller's own login, under RLS. There is nothing to forge.
//
// Reads use the caller's session (decision 1). Only the WRITE is elevated, and
// only after the engine has justified it.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient, hasServiceKey } from '@/lib/supabase-admin'
import { loadGradeState } from '@/lib/loadGrades'
import { awardsToConfer, awardsToWithdraw, type PendingAward, type WithdrawnAward } from '@/lib/autoConfer'

export const dynamic = 'force-dynamic'

type Body = { playerId?: unknown; force?: unknown; withdraw?: unknown }

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

export async function POST(req: Request) {
  const db = await createSupabaseServerClient()

  // getUser(), not getSession(): this IS a security boundary, so the token is
  // verified with the auth server rather than read from a cookie.
  const { data: { user } } = await db.auth.getUser()
  if (!user) return json({ error: 'not signed in' }, 401)

  let body: Body = {}
  try { body = (await req.json()) as Body } catch { /* an empty body means "me" */ }
  const playerId = typeof body.playerId === 'string' ? body.playerId : user.id
  const force = body.force === true
  const withdraw = parseWithdraw(body.withdraw)
  // A withdraw that does not parse is refused, never quietly run as a recheck.
  // Otherwise a kaiwhakawā who just deleted evidence would be told the colours
  // "still stand", when nothing was re-judged at all.
  if (body.withdraw !== undefined && !withdraw) return json({ error: 'withdraw needs a domain from 1 to 10' }, 400)

  // Own, child, or kaiwhakawā — the same predicate the workout tables use for
  // exactly the same question, rather than a second definition of "my player".
  if (playerId !== user.id) {
    const { data: allowed, error } = await db.rpc('can_log_for', { p_player_id: playerId })
    if (error) return json({ error: 'could not check access' }, 500)
    if (allowed !== true) return json({ error: 'not your player' }, 403)
  }

  if (withdraw) return withdrawIn(db, user.id, playerId, withdraw)

  // The cheap probe. `force` is for the moment a game closes, where the screen
  // knows something happened and the watermark may not have caught up yet.
  //
  // A missing function (PGRST202, before the migration) falls through to the
  // full run: doing the work needlessly is the safe direction, and skipping a
  // colour someone earned is the one that would never surface.
  if (!force) {
    const { data: dirty, error } = await db.rpc('grades_need_recheck', { p_player_id: playerId })
    if (!error && dirty === false) return json({ conferred: [], checked: false })
  }

  // Taken BEFORE the reads: the watermark must mean "everything up to here was
  // looked at". Stamping the time after the work would skip a score written
  // while the engine was running.
  const readFrom = new Date().toISOString()
  const state = await loadGradeState(db, playerId)
  if (!state) return json({ error: 'unknown player' }, 404)

  // An erased or retired profile is never conferred a colour. Erasure nulls
  // the date of birth, and a junior with no age grades as U14, a colour easier
  // than U16, while the login and a parent's access both survive. With nobody
  // releasing colours by hand, nothing else would stop that.
  if (state.active === false) return json({ conferred: [], inactive: true })
  // confer_grade refuses a guest; this path writes directly, so it must too.
  if (state.guest) return json({ conferred: [], guest: true })
  // A partial read looks like a player with less evidence. Conferring on it
  // could rest on a voided game (the voids read failed), so write nothing and
  // let the next recheck try again.
  // 500, not 503: the client reads 503 as "no service key", which is not this.
  if (state.complete === false) return json({ error: 'could not read all of this player\'s evidence' }, 500)

  const pending = awardsToConfer(playerId, state)

  // Deploying before the secret exists is a normal state: the page keeps
  // showing computed colours and simply confers nothing. Reported honestly so
  // it cannot be mistaken for "you have earned nothing".
  if (!hasServiceKey()) {
    return json({ conferred: [], pending: pending.map(summarise), writable: false }, 503)
  }

  const admin = createSupabaseAdminClient()
  let conferred: PendingAward[] = []
  if (pending.length > 0) {
    // ignoreDuplicates, because UNIQUE (player_id, domain_number, rung) is what
    // makes two screens rechecking at once harmless rather than an error.
    //
    // The select() matters: ON CONFLICT DO NOTHING returns only the rows it
    // actually inserted, so `conferred` is what is NEW. Reporting `pending`
    // instead would announce the same colour on both screens of a race, and
    // again on any recheck that raced a kaiwhakawā releasing it by hand.
    const { data, error } = await admin.from('grade_awards')
      .upsert(pending, { onConflict: 'player_id,domain_number,rung', ignoreDuplicates: true })
      .select('domain_number, rung, grade_name, events')
    if (error) return json({ error: error.message }, 500)
    const landed = new Set((data ?? []).map(r => `${r.domain_number}:${r.rung}`))
    conferred = pending.filter(a => landed.has(`${a.domain_number}:${a.rung}`))
  }

  // Last, and only on success: the watermark must never move past work that did
  // not happen, or the colour is withheld until the next thing changes.
  const checked = await stampChecked(admin, playerId, readFrom)
  return json({ conferred: conferred.map(summarise), checked })
}

/** What the screen needs to say "New colour — Kākāriki in Power". */
const summarise = (a: PendingAward) => ({
  domainNumber: a.domain_number, rung: a.rung, name: a.grade_name, events: a.events.length,
})

/** The same for a colour taken back. */
const summariseWithdrawn = (a: WithdrawnAward) => ({ domainNumber: a.domain_number, rung: a.rung, name: a.grade_name })

/** Move the watermark, and say whether it moved: `checked` claims nothing it did not do. */
async function stampChecked(admin: ReturnType<typeof createSupabaseAdminClient>, playerId: string, at: string) {
  const { error } = await admin.from('players').update({ grades_checked_at: at }).eq('id', playerId)
  return !error
}

// ─── Taking a colour back ────────────────────────────────────────────────────
// Spec decision 5. Reached ONLY from the audit panel, immediately after a
// kaiwhakawā deletes a logged entry, and only for that entry's domain. An
// ordinary recheck never comes here, which is what stops a revised standards
// sheet from demoting anyone.

type WithdrawRequest = { domain: number; reason: string | null }

function parseWithdraw(v: unknown): WithdrawRequest | null {
  if (!v || typeof v !== 'object') return null
  const { domain, reason } = v as { domain?: unknown; reason?: unknown }
  if (typeof domain !== 'number' || !Number.isInteger(domain) || domain < 1 || domain > 10) return null
  return { domain, reason: typeof reason === 'string' ? reason.slice(0, 200) : null }
}

async function withdrawIn(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  callerId: string,
  playerId: string,
  req: WithdrawRequest,
) {
  // A kaiwhakawā only. A player tidying their own log keeps the colour they
  // earned with it; only someone moderating can take one away. is_judge() is
  // asked AS THE CALLER, so it reads their own role, not one they claimed.
  const { data: judge, error: judgeError } = await db.rpc('is_judge')
  if (judgeError) return json({ error: 'could not check access' }, 500)
  if (judge !== true) return json({ error: 'only a kaiwhakawā can take a colour back' }, 403)

  const state = await loadGradeState(db, playerId)
  if (!state) return json({ error: 'unknown player' }, 404)
  // Never on a partial read. A failed results read looked like no scores at
  // all, and every colour in the domain would have been taken back and the
  // player told so.
  if (state.complete === false) return json({ error: 'could not read all of this player\'s evidence' }, 500)
  const out = awardsToWithdraw(state, req.domain)
  if (out.length === 0) return json({ withdrawn: [] })

  if (!hasServiceKey()) {
    return json({ withdrawn: [], pending: out.map(summariseWithdrawn), writable: false }, 503)
  }
  const admin = createSupabaseAdminClient()

  // The award goes first: it is the thing that actually changes what the
  // player holds. The log is what tells them; if it fails (PGRST205, before
  // its migration) the colour is still correctly gone, and we say it was not
  // logged rather than pretend.
  //
  // select() returns only the rows THIS request deleted. Two kaiwhakawā deleting
  // at once, or an award already gone, must not be reported (and logged, and
  // announced to the player) twice.
  const { data: gone, error: delError } = await admin.from('grade_awards')
    .delete().in('id', out.map(a => a.id)).select('id')
  if (delError) return json({ error: delError.message }, 500)
  const deleted = new Set((gone ?? []).map(r => r.id))
  const taken = out.filter(a => deleted.has(a.id))

  let logged = true
  if (taken.length > 0) {
    const { error: logError } = await admin.from('grade_withdrawals').insert(taken.map(a => ({
      player_id: playerId, domain_number: a.domain_number, rung: a.rung, grade_name: a.grade_name,
      conferred_at: a.conferred_at, withdrawn_by: callerId, reason: req.reason,
    })))
    logged = !logError
  }

  // The watermark is NOT moved here. This path re-judged one domain and ran no
  // conferral pass, so stamping it would mark evidence in every other domain
  // as examined when nothing looked at it, and the next ordinary recheck would
  // skip a colour the player had earned.
  return json({ withdrawn: taken.map(summariseWithdrawn), logged })
}
