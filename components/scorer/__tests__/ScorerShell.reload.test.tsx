/**
 * ScorerShell component tests — page reload scenarios.
 *
 * These tests verify that the scorer UI renders correctly after a page reload,
 * specifically that:
 *   1. Guard 2 ("Waiting for innings setup...") does NOT fire when a wicket was
 *      the last ball and opener1/opener2 are null (React state reset).
 *   2. The new-batter picker auto-shows on reload after a wicket.
 *   3. The new-bowler picker auto-shows on reload after an over ends.
 *   4. Normal reload (no pending action) reaches the scoring UI.
 *
 * External dependencies are mocked to prevent network calls.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import ScorerShell from '../ScorerShell'
import type { BallEvent } from '@/lib/cricket/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn(() => Promise.resolve({ data: [] })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  },
}))

vi.mock('@/lib/supabase/realtime', () => ({
  subscribeBallEvents: vi.fn(() => ({ unsubscribe: vi.fn() })),
}))

vi.mock('@/lib/offline/queue', () => ({
  getQueueCount: vi.fn(() => Promise.resolve(0)),
  getQueueMaxSequence: vi.fn(() => Promise.resolve(0)),
  flushQueue: vi.fn(() => Promise.resolve()),
  queueBall: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MATCH = {
  id: 'match-1',
  overs_per_innings: 20,
  free_hit_on_no_ball: true,
  our_team_side: 'home' as const,
  opponentName: 'Edenvale CC',
  initialTossWonBy: 'home' as const,
  initialTossDecision: 'bat' as const,
}

const INNINGS = {
  id: 'innings-1',
  innings_number: 1,
  batting_side: 'home' as const,
  status: 'in_progress',
  target: null,
  bonus_runs: 0,
}

function makeBall(seq: number, overNum: number, ballInOver: number, overrides: Partial<BallEvent> = {}): BallEvent {
  return {
    id: `ball-${seq}`,
    innings_id: 'innings-1',
    match_id: 'match-1',
    sequence_number: seq,
    over_number: overNum,
    ball_in_over: ballInOver,
    batter_id: 'mp1',
    non_striker_id: 'mp2',
    bowler_id: 'mp11',
    runs_off_bat: 0,
    extras_type: null,
    extras_runs: 0,
    is_boundary_four: false,
    is_boundary_six: false,
    dismissal_type: null,
    dismissed_player_id: null,
    fielder_id: null,
    fielder_substitute_name: null,
    penalty_reason: null,
    penalty_to_fielding: false,
    commentary: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// 6 dot balls in over 0 — one complete over
const OVER_ONE: BallEvent[] = Array.from({ length: 6 }, (_, i) =>
  makeBall(i + 1, 0, i)
)

// Wicket ball: mp1 bowled on ball 7 (start of over 1)
const WICKET_BALL: BallEvent = makeBall(7, 1, 0, {
  dismissal_type: 'bowled',
  dismissed_player_id: 'mp1',
})

// ── Test helper ───────────────────────────────────────────────────────────────

async function renderShell(balls: BallEvent[]) {
  await act(async () => {
    render(
      <ScorerShell
        match={MATCH}
        innings={INNINGS}
        initialBalls={balls}
        allPlayers={[]}          // empty — simulates transient RLS / reload with no matchPlayers
        availablePlayers={[]}
      />
    )
  })
}

// ── Reload after striker wicket ───────────────────────────────────────────────

describe('Reload mid-innings — last ball was a striker wicket', () => {
  beforeEach(async () => {
    await renderShell([...OVER_ONE, WICKET_BALL])
  })

  it('does NOT show "Waiting for innings setup..." guard message', () => {
    expect(screen.queryByText('Waiting for innings setup...')).not.toBeInTheDocument()
  })

  it('shows "Choose next batter" button because needsNewBatter=true', () => {
    // Zone D button — always visible when needsNewBatter=true (regardless of modal state)
    expect(screen.getByText(/Choose next batter/i)).toBeInTheDocument()
  })

  it('shows "Select Next Batter" modal automatically (mount-only effect)', () => {
    // Improvement 2: mount-only effect sets showNewBatter=true so modal auto-pops
    expect(screen.getByText('Select Next Batter')).toBeInTheDocument()
  })

  it('does not render any setup phase UI', () => {
    expect(screen.queryByText(/STEP \d+ \/ 5/i)).not.toBeInTheDocument()
  })
})

// ── Reload after over boundary ────────────────────────────────────────────────

describe('Reload mid-innings — last ball completed an over (needsNewBowler)', () => {
  beforeEach(async () => {
    // 6 balls = one complete over; legalBalls % 6 === 0 → needsNewBowler=true
    await renderShell(OVER_ONE)
  })

  it('does NOT show "Waiting for innings setup..." guard message', () => {
    expect(screen.queryByText('Waiting for innings setup...')).not.toBeInTheDocument()
  })

  it('shows "Select Bowler" modal automatically (mount-only effect)', () => {
    // Improvement 2: mount-only effect sets showChangeBowler=true so modal auto-pops
    expect(screen.getByText('Select Bowler')).toBeInTheDocument()
  })

  it('shows "Choose bowler" button in zone D because needsNewBowler=true', () => {
    expect(screen.getByText(/Choose bowler/i)).toBeInTheDocument()
  })
})

// ── Normal reload (mid-over, no wicket) ──────────────────────────────────────

describe('Reload mid-innings — normal ball as last delivery (mid-over, no wicket)', () => {
  beforeEach(async () => {
    // 3 balls into over 0: mid-over, needsNewBatter=false, needsNewBowler=false
    const balls = [makeBall(1, 0, 0), makeBall(2, 0, 1), makeBall(3, 0, 2)]
    await renderShell(balls)
  })

  it('does NOT show "Waiting for innings setup..." guard message', () => {
    expect(screen.queryByText('Waiting for innings setup...')).not.toBeInTheDocument()
  })

  it('does not auto-pop new-batter modal (no wicket)', () => {
    expect(screen.queryByText('Select Next Batter')).not.toBeInTheDocument()
  })

  it('does not auto-pop new-bowler modal (mid-over)', () => {
    expect(screen.queryByText('Select Bowler')).not.toBeInTheDocument()
  })

  it('shows the scoring Wicket button (normal scoring mode)', () => {
    expect(screen.getByText('WICKET')).toBeInTheDocument()
  })
})
