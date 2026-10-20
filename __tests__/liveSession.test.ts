import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { liveSessionTopic, RESULTS_CHANGED } from '@/lib/liveSession'

// Realtime postgres_changes drained the project's Disk IO budget (Oct 2026):
// see lib/liveSession.ts. Live updates go by Broadcast; this keeps
// postgres_changes from creeping back in.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('live game updates', () => {
  it('no browser code subscribes to postgres_changes', () => {
    const offenders = ['app', 'components', 'lib'].flatMap(sourceFiles)
      .filter(f => readFileSync(f, 'utf8').includes("'postgres_changes'"))
    expect(offenders).toEqual([])
  })

  it('every screen shares one topic per game', () => {
    expect(liveSessionTopic('abc')).toBe('session-live-abc')
    expect(RESULTS_CHANGED).toBe('results-changed')
  })

  it('the migration takes results and session_events out of the publication', () => {
    const sql = readFileSync('supabase/migrations/20261020212122_disk_io_broadcast_indexes.sql', 'utf8')
    expect(sql).toMatch(/alter publication supabase_realtime drop table public\.results/)
    expect(sql).toMatch(/alter publication supabase_realtime drop table public\.session_events/)
  })
})
