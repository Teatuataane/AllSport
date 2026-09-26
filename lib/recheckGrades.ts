// ─── Asking the server to re-examine you ─────────────────────────────────────
// The client half of auto-conferral, and it is deliberately thin: it sends no
// colour, no rung and no score, because the server re-derives all of it. See
// app/api/grades/recheck/route.ts.
//
// It NEVER throws. A recheck that does not happen costs a player nothing
// visible — the colours on screen are computed locally either way, and the next
// page open tries again. A kaiwhakawā withdrawing a colour is different: they
// just deleted evidence and need to know whether it took, so withdrawColours
// reports `ok` and `logged` rather than staying quiet.

export type ConferredColour = { domainNumber: number; rung: number; name: string; events: number }

export type RecheckResult = {
  conferred: ConferredColour[]
  /** False when the server has no service key yet, so nothing can be written. */
  writable: boolean
  /** False when the question got no real answer. Players' screens ignore it; the panel does not. */
  ok: boolean
}

export type WithdrawnColour = { domainNumber: number; rung: number; name: string }

type Posted = { status: number; body: Record<string, unknown> } | null

/** The one POST both helpers make. Null when the request never completed. */
async function post(payload: Record<string, unknown>): Promise<Posted> {
  try {
    const res = await fetch('/api/grades/recheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    return { status: res.status, body }
  } catch {
    return null
  }
}

const ok2xx = (r: Posted): r is NonNullable<Posted> => !!r && r.status >= 200 && r.status < 300

export async function recheckGrades(opts: { playerId?: string; force?: boolean } = {}): Promise<RecheckResult> {
  const r = await post({ playerId: opts.playerId, force: opts.force === true })
  // 503 is the route saying the key is not set: nothing was written.
  if (r?.status === 503) return { conferred: [], writable: false, ok: true }
  if (!ok2xx(r)) return { conferred: [], writable: true, ok: false }
  return { conferred: (r.body.conferred as ConferredColour[] | undefined) ?? [], writable: true, ok: true }
}

/**
 * After a kaiwhakawā deletes a logged score, ask the server to re-judge that
 * ONE domain and take back anything the remaining evidence no longer supports.
 * The server refuses anyone but a kaiwhakawā.
 *
 * `ok: false` means the question did not get a real answer — including a 2xx
 * with no `withdrawn` list, which is not a withdrawal response at all.
 * `logged: false` means a colour was taken back but the player's notice could
 * not be recorded, so the panel must not say "they will be told".
 */
export async function withdrawColours(playerId: string, domain: number, reason?: string): Promise<{
  withdrawn: WithdrawnColour[]; writable: boolean; ok: boolean; logged: boolean
  /** The colour the remaining evidence still gives, conferred straight back after a jump was taken. */
  reconferred: string | null
}> {
  const r = await post({ playerId, withdraw: { domain, reason } })
  if (r?.status === 503) return { withdrawn: [], writable: false, ok: true, logged: true, reconferred: null }
  if (!ok2xx(r) || !Array.isArray(r.body.withdrawn)) return { withdrawn: [], writable: true, ok: false, logged: true, reconferred: null }
  return {
    withdrawn: r.body.withdrawn as WithdrawnColour[],
    writable: true,
    ok: true,
    logged: r.body.logged !== false,
    reconferred: typeof r.body.reconferred === 'string' ? r.body.reconferred : null,
  }
}
