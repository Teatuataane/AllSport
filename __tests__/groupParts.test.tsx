// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { GroupBoardList, GroupMemberList } from '@/components/GroupParts'

afterEach(cleanup)

describe('GroupBoardList', () => {
  it('ranks groups with active members and games, never a player name', () => {
    render(<GroupBoardList rows={[
      { group_id: 'a', name: 'Te Kura A', kind: 'school', active_members: 2, games: 7, improvement: 1.38, place: 1 },
      { group_id: 'b', name: 'Hornby Club', kind: 'club', active_members: 0, games: 0, improvement: null, place: null },
    ]} />)
    const rows = screen.getAllByTestId('group-row')
    expect(rows[0].textContent).toContain('1st')
    expect(rows[0].textContent).toContain('School · 2 active · 7 games')
    expect(rows[0].textContent).toContain('+1.4 colours')
    expect(rows[1].textContent).toContain('Not yet active')
    expect(rows[0].getAttribute('href')).toBe('/hapu/a')
  })
  it('says so when there are none', () => {
    render(<GroupBoardList rows={[]} />)
    expect(screen.getByText('No hapū yet.')).toBeTruthy()
  })
})

describe('GroupMemberList', () => {
  const rows = [
    { player_id: '1', name: 'Aroha S.', status: 'member' as const, games: 4, improvement: 2 },
    { player_id: '2', name: 'Big', status: 'pending' as const, games: 0, improvement: null },
  ]
  it('lists members only, with their games and improvement', () => {
    render(<GroupMemberList rows={rows} />)
    const m = screen.getAllByTestId('group-member')
    expect(m).toHaveLength(1)
    expect(m[0].textContent).toContain('Aroha S.')
    expect(m[0].textContent).toContain('4 games this season')
    expect(m[0].textContent).toContain('+2.0 colours')
    expect(screen.queryByText('Remove')).toBeNull()
  })
  it('gives the leader a remove button', () => {
    const onRemove = vi.fn()
    render(<GroupMemberList rows={rows} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Aroha S.' }))
    expect(onRemove).toHaveBeenCalledWith('1')
  })
})
