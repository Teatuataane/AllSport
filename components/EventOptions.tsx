// ─── Every event, grouped by domain, as <option>s ────────────────────────────
// For a native <select>: the log form's event picker, its not-fitted list and
// the kaiwhakawā's activity fitting all offer the same roster the same way.

import { EVENTS, DOMAIN_ORDER } from '@/lib/eventData'

export default function EventOptions() {
  return (
    <>
      {DOMAIN_ORDER.map((domain, i) => (
        <optgroup key={domain} label={domain}>
          {EVENTS.filter(e => e.domainNumber === i + 1).map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
        </optgroup>
      ))}
    </>
  )
}
