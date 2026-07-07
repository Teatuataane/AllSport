// Next session from the fixed weekly schedule — Tue & Thu 4:30pm, Sat 9:00am, NZ time.
// Works on NZ wall-clock minutes via Intl so it's correct wherever the device is.
// (Across a DST transition the countdown can be off by up to an hour — acceptable
// for a "in {n} hours" display.)

const SLOTS = [
  { dow: 2, mins: 16 * 60 + 30, label: 'Tuesday 4:30pm' },
  { dow: 4, mins: 16 * 60 + 30, label: 'Thursday 4:30pm' },
  { dow: 6, mins: 9 * 60, label: 'Saturday 9:00am' },
]

export function nextScheduledSession(now = new Date()): { label: string; relative: string } {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
  const dowIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const nowMins = parseInt(get('hour')) * 60 + parseInt(get('minute'))
  let best = { label: SLOTS[0].label, delta: Infinity }
  for (const s of SLOTS) {
    let delta = ((s.dow - dowIdx + 7) % 7) * 1440 + (s.mins - nowMins)
    if (delta <= 0) delta += 7 * 1440
    if (delta < best.delta) best = { label: s.label, delta }
  }
  const hrs = Math.round(best.delta / 60)
  const relative = best.delta < 60
    ? `in ${best.delta} minute${best.delta === 1 ? '' : 's'}`
    : best.delta < 48 * 60
      ? `in ${hrs} hour${hrs === 1 ? '' : 's'}`
      : `in ${Math.round(best.delta / 1440)} days`
  return { label: best.label, relative }
}
