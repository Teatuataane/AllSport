// ─── The top loading bar's state ─────────────────────────────────────────────
// A counter, not a flag: a page change and a page's own data read can overlap,
// and the bar must stay up until the last of them is done. Each start() hands
// back its own done(), which only counts once however often it is called, so
// an effect cleanup that runs twice can never pull the bar down for someone
// else's work.
//
// No React and no Supabase here: the bar (components/LoadingBar.tsx) and the
// hook pages use (lib/useLoadingBar.ts) subscribe to it.

let active = 0
const listeners = new Set<(busy: boolean) => void>()

function emit() {
  const busy = active > 0
  for (const l of listeners) l(busy)
}

export function startLoading(): () => void {
  let done = false
  active += 1
  if (active === 1) emit()
  return () => {
    if (done) return
    done = true
    active = Math.max(0, active - 1)
    if (active === 0) emit()
  }
}

export function isLoading(): boolean {
  return active > 0
}

export function subscribeLoading(listener: (busy: boolean) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Whether a click on this link starts a page change the bar should show: a
 * plain left click on a same-site link to a different page. A link that only
 * changes the query or the #hash stays on the page (tabs, anchors), opens
 * elsewhere (new tab, download), or leaves the site, is not one.
 */
export function isPageChangeClick(
  e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean },
  link: { href: string; target: string; hasDownload: boolean },
  here: { origin: string; pathname: string },
): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  if (link.hasDownload || (link.target && link.target !== '_self')) return false
  let url: URL
  try {
    url = new URL(link.href, here.origin)
  } catch {
    return false
  }
  if (url.origin !== here.origin) return false
  return url.pathname !== here.pathname
}
