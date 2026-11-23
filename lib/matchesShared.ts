// The one shared read of every match, held for a minute in the browser
// (loadMatchesChecked in lib/loadGrades.ts says why). Its own tiny module so
// the screens that WRITE a match can drop it without importing the grading
// engine: after record_match, record_entry_match or settle_dispute, call
// forgetLoadedMatches() and the next rating read is fresh.

export type SharedEntry<T> = { at: number; pending: Promise<T> }

let entry: SharedEntry<unknown> | null = null

export const sharedMatches = {
  get: (): SharedEntry<unknown> | null => entry,
  set: (e: SharedEntry<unknown>) => { entry = e },
  /** Drop it only if it is still this entry (a newer read may have replaced it). */
  dropIf: (e: SharedEntry<unknown>) => { if (entry === e) entry = null },
}

/** Drop the shared matches, so the next read is fresh. Call after writing a match. */
export function forgetLoadedMatches(): void {
  entry = null
}
