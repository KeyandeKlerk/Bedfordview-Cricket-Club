import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import WicketModal from '../WicketModal'
import type { MatchPlayer } from '@/lib/cricket/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIELDING_PLAYERS: MatchPlayer[] = [
  { id: 'f1', match_id: 'm1', player_id: 'p10', opposition_name: null, side: 'away', batting_position: null, actual_batting_position: null, is_captain: false, is_keeper: true },
  { id: 'f2', match_id: 'm1', player_id: 'p11', opposition_name: null, side: 'away', batting_position: null, actual_batting_position: null, is_captain: true, is_keeper: false },
  { id: 'f3', match_id: 'm1', player_id: 'p12', opposition_name: null, side: 'away', batting_position: null, actual_batting_position: null, is_captain: false, is_keeper: false },
]

const NAME_MAP: Record<string, string> = {
  mp1: 'Striker Name',
  mp2: 'Non-Striker Name',
  f1: 'Keeper Brown',
  f2: 'Captain Smith',
  f3: 'Extra Fielder',
}

const playerName = (id: string) => NAME_MAP[id] ?? id

// getBallsFaced returns 10 for striker (blocks timed_out) and 0 for others
const getBallsFaced = (id: string) => (id === 'mp1' ? 10 : 0)

function renderModal(overrides: Partial<React.ComponentProps<typeof WicketModal>> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <WicketModal
      strikerId="mp1"
      nonStrikerId="mp2"
      fieldingPlayers={FIELDING_PLAYERS}
      isFreeHit={false}
      playerName={playerName}
      getBallsFaced={getBallsFaced}
      onConfirm={onConfirm}
      onClose={onClose}
      {...overrides}
    />
  )
  return { onConfirm, onClose }
}

// ── Step 1: type selection ────────────────────────────────────────────────────

describe('Step 1 — type selection', () => {
  it('renders the "Wicket" heading', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: /Wicket/i })).toBeInTheDocument()
  })

  it('shows striker name button', () => {
    renderModal()
    expect(screen.getByText('Striker Name')).toBeInTheDocument()
  })

  it('shows non-striker name button', () => {
    renderModal()
    expect(screen.getByText('Non-Striker Name')).toBeInTheDocument()
  })

  it('shows standard dismissal type buttons when not on free hit', () => {
    renderModal()
    expect(screen.getByRole('button', { name: 'Bowled' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Caught' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LBW' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stumped' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hit Wicket' })).toBeInTheDocument()
  })

  it('filters timed_out when striker has faced balls (getBallsFaced > 0)', () => {
    // Striker mp1 has faced 10 balls → Timed Out should not appear for striker
    renderModal()
    // By default striker is selected — timed_out filtered
    expect(screen.queryByRole('button', { name: 'Timed Out' })).not.toBeInTheDocument()
  })

  it('shows Timed Out when the non-striker (0 balls faced) is selected as dismissed', () => {
    renderModal()
    // Select non-striker
    fireEvent.click(screen.getByText('Non-Striker Name'))
    // Non-striker has 0 balls faced → timed_out should be available
    expect(screen.getByRole('button', { name: 'Timed Out' })).toBeInTheDocument()
  })

  it('on free hit: only Run Out button is shown', () => {
    renderModal({ isFreeHit: true })
    expect(screen.getByRole('button', { name: 'Run Out' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bowled' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Caught' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'LBW' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stumped' })).not.toBeInTheDocument()
  })

  it('shows free hit banner when isFreeHit=true', () => {
    renderModal({ isFreeHit: true })
    expect(screen.getByText(/FREE HIT/i)).toBeInTheDocument()
    expect(screen.getByText(/run-out is allowed/i)).toBeInTheDocument()
  })

  it('Cancel button calls onClose', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking non-striker button makes non-striker the dismissed player on confirm', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByText('Non-Striker Name'))
    fireEvent.click(screen.getByRole('button', { name: 'Bowled' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ dismissedPlayerId: 'mp2' }))
  })
})

// ── Dismissals that confirm immediately (no fielder needed) ───────────────────

describe('Dismissals that confirm immediately (no fielder step)', () => {
  it('Bowled: calls onConfirm with correct args and onClose', () => {
    const { onConfirm, onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Bowled' }))
    expect(onConfirm).toHaveBeenCalledWith({
      dismissalType: 'bowled',
      dismissedPlayerId: 'mp1',
      fielderId: null,
      fielderSubstituteName: null,
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('LBW: calls onConfirm with dismissalType="lbw"', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'LBW' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ dismissalType: 'lbw' }))
  })

  it('Hit Wicket: calls onConfirm with dismissalType="hit_wicket"', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Hit Wicket' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ dismissalType: 'hit_wicket' }))
  })

  it('Handled Ball: calls onConfirm immediately', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Handled Ball' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ dismissalType: 'handled_ball' }))
  })

  it('Obstructing: calls onConfirm immediately', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Obstructing' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ dismissalType: 'obstructing_field' }))
  })

  it('Retired Hurt: calls onConfirm immediately', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Retired Hurt' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ dismissalType: 'retired_hurt' }))
  })

  it('does NOT advance to fielder step for Bowled', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Bowled' }))
    // Step 2 heading should not appear
    expect(screen.queryByText(/Caught by|Stumped by|Run out by/i)).not.toBeInTheDocument()
  })
})

// ── Step 2: fielder selection ─────────────────────────────────────────────────

describe('Step 2 — fielder selection (caught/stumped/run_out)', () => {
  it('Caught: advances to fielder step with "Caught by" heading', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    expect(screen.getByText('Caught by')).toBeInTheDocument()
    // Type step buttons should be gone
    expect(screen.queryByRole('button', { name: 'Bowled' })).not.toBeInTheDocument()
  })

  it('Stumped: advances to fielder step with "Stumped by" heading', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Stumped' }))
    expect(screen.getByText('Stumped by')).toBeInTheDocument()
  })

  it('Run Out: advances to fielder step with "Run out by" heading', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Run Out' }))
    expect(screen.getByText('Run out by')).toBeInTheDocument()
  })

  it('all 3 fielding players are listed in step 2', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    expect(screen.getByText('Keeper Brown')).toBeInTheDocument()
    expect(screen.getByText('Captain Smith')).toBeInTheDocument()
    expect(screen.getByText('Extra Fielder')).toBeInTheDocument()
  })

  it('keeper player shows dagger (†) symbol', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    // The † is rendered as a separate span inside the keeper's button
    const keeperBtn = screen.getByText('Keeper Brown').closest('button')!
    expect(within(keeperBtn).getByText('†')).toBeInTheDocument()
  })

  it('captain player shows (C) label', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    const captainBtn = screen.getByText('Captain Smith').closest('button')!
    expect(within(captainBtn).getByText('(C)')).toBeInTheDocument()
  })

  it('Confirm Wicket is disabled before a fielder is selected', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    const confirm = screen.getByRole('button', { name: 'Confirm Wicket' })
    expect(confirm).toBeDisabled()
  })

  it('selecting a fielder enables Confirm Wicket', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    fireEvent.click(screen.getByText('Extra Fielder'))
    const confirm = screen.getByRole('button', { name: 'Confirm Wicket' })
    expect(confirm).not.toBeDisabled()
  })

  it('Confirm Wicket calls onConfirm with correct fielderId', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    fireEvent.click(screen.getByText('Extra Fielder'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Wicket' }))
    expect(onConfirm).toHaveBeenCalledWith({
      dismissalType: 'caught',
      dismissedPlayerId: 'mp1',
      fielderId: 'f3',
      fielderSubstituteName: null,
    })
  })

  it('Stumped: pre-selects the keeper (fielderId set to keeper id)', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Stumped' }))
    // Keeper should be pre-selected: Confirm Wicket is enabled immediately
    const confirm = screen.getByRole('button', { name: 'Confirm Wicket' })
    expect(confirm).not.toBeDisabled()
    // Confirming without selecting another fielder uses the keeper
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ fielderId: 'f1' }))
  })

  it('Back button returns to type step', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    expect(screen.getByText('Caught by')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    // Step 1 content should be visible again
    expect(screen.getByRole('button', { name: 'Bowled' })).toBeInTheDocument()
    expect(screen.queryByText('Caught by')).not.toBeInTheDocument()
  })

  it('Back button clears fielderId (Confirm Wicket is disabled again after re-entering step 2)', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    fireEvent.click(screen.getByText('Extra Fielder')) // select fielder
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    // fielderId was cleared by Back — confirm should be disabled again
    expect(screen.getByRole('button', { name: 'Confirm Wicket' })).toBeDisabled()
  })
})

// ── Substitute fielder mode ───────────────────────────────────────────────────

describe('Substitute fielder mode', () => {
  it('checking substitute checkbox shows text input', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByPlaceholderText('Substitute fielder name')).toBeInTheDocument()
    // Fielder list should be hidden
    expect(screen.queryByText('Keeper Brown')).not.toBeInTheDocument()
  })

  it('Confirm Wicket calls onConfirm with fielderSubstituteName and fielderId=null', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByPlaceholderText('Substitute fielder name'), { target: { value: 'John Sub' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Wicket' }))
    expect(onConfirm).toHaveBeenCalledWith({
      dismissalType: 'caught',
      dismissedPlayerId: 'mp1',
      fielderId: null,
      fielderSubstituteName: 'John Sub',
    })
  })

  it('whitespace-only substitute name results in fielderSubstituteName=null', () => {
    const { onConfirm } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Caught' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByPlaceholderText('Substitute fielder name'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Wicket' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ fielderSubstituteName: null }))
  })
})

// ── Overlay interaction ───────────────────────────────────────────────────────

describe('Overlay interaction', () => {
  it('clicking the overlay calls onClose', () => {
    const { onClose } = renderModal()
    const overlay = document.querySelector('.wicket-overlay')!
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking inside the panel does NOT call onClose (stopPropagation)', () => {
    const { onClose } = renderModal()
    const panel = document.querySelector('.wicket-panel')!
    fireEvent.click(panel)
    expect(onClose).not.toHaveBeenCalled()
  })
})
