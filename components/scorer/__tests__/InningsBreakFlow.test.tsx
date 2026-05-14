import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import InningsBreakFlow from '../InningsBreakFlow'
import type { InningsState, MatchPlayer } from '@/lib/cricket/types'
import { dlsTarget } from '@/lib/cricket/dls'

// ── Supabase mock ─────────────────────────────────────────────────────────────

// Capture what data was passed to innings insert so we can assert on it.
let capturedInsert: Record<string, unknown> | null = null

vi.mock('@/lib/supabase/client', () => {
  // Returns a chain that is also thenable so `await chain` resolves successfully.
  function makeChain(resolveWith: unknown = { data: null, error: null }): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    const methods = ['update', 'select', 'eq']
    for (const m of methods) {
      chain[m] = vi.fn(() => chain)
    }
    // insert captures its argument then returns a fresh chain
    chain['insert'] = vi.fn((data: Record<string, unknown>) => {
      capturedInsert = data
      return makeChain({ data: { id: 'inn2-id' }, error: null })
    })
    // single() terminates the chain as a Promise
    chain['single'] = vi.fn(() => Promise.resolve({ data: { id: 'inn2-id' }, error: null }))
    // then() makes the chain itself awaitable
    chain['then'] = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolveWith).then(resolve)
    return chain
  }

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'ball_events') {
          // Penalty balls query — return empty array
          return makeChain({ data: [], error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    },
  }
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BATTING: MatchPlayer[] = [
  { id: 'b1', match_id: 'm1', player_id: 'p1', opposition_name: null, side: 'away', batting_position: 1, actual_batting_position: null, is_captain: false, is_keeper: false },
  { id: 'b2', match_id: 'm1', player_id: 'p2', opposition_name: null, side: 'away', batting_position: 2, actual_batting_position: null, is_captain: false, is_keeper: false },
  { id: 'b3', match_id: 'm1', player_id: 'p3', opposition_name: null, side: 'away', batting_position: 3, actual_batting_position: null, is_captain: false, is_keeper: false },
]

const BOWLING: MatchPlayer[] = [
  { id: 'bwl1', match_id: 'm1', player_id: 'p10', opposition_name: null, side: 'home', batting_position: null, actual_batting_position: null, is_captain: false, is_keeper: false },
]

function makeState(overrides: Partial<InningsState> = {}): InningsState {
  return {
    inningsId: 'inn1',
    inningsNumber: 1,
    battingSide: 'home',
    totalRuns: 150,
    wickets: 6,
    legalBalls: 120, // 20 overs = full innings
    oversDisplay: '20.0',
    extras: { wide: 0, no_ball: 0, bye: 0, leg_bye: 0, penalty: 0, total: 0 },
    batterStats: {},
    bowlerStats: {},
    currentStrikerId: null,
    currentNonStrikerId: null,
    currentBowlerId: null,
    currentOverBalls: [],
    currentOverLegalBalls: 6,
    completedOvers: [],
    fallOfWickets: [],
    currentPartnership: null,
    nextBallIsFreeHit: false,
    ...overrides,
  }
}

const NAME_MAP: Record<string, string> = { b1: 'Batter One', b2: 'Batter Two', b3: 'Batter Three', bwl1: 'Bowler One' }

function renderFlow(props: Partial<React.ComponentProps<typeof InningsBreakFlow>> = {}) {
  const onResumeScoring = vi.fn()
  const onMatchComplete = vi.fn()
  render(
    <InningsBreakFlow
      matchId="m1"
      completedInningsId="inn1"
      completedState={makeState()}
      innings2Id={null}
      innings2BattingSide="away"
      oversPerInnings={20}
      battingPlayers={BATTING}
      bowlingPlayers={BOWLING}
      playerName={id => NAME_MAP[id] ?? id}
      onResumeScoring={onResumeScoring}
      onMatchComplete={onMatchComplete}
      {...props}
    />
  )
  return { onResumeScoring, onMatchComplete }
}

beforeEach(() => {
  capturedInsert = null
})

// ── DLS toggle visibility ─────────────────────────────────────────────────────

describe('DLS toggle visibility', () => {
  it('does NOT show DLS checkbox when innings 1 used all scheduled overs', () => {
    // 20 overs × 6 = 120 legalBalls — full innings
    renderFlow({ completedState: makeState({ legalBalls: 120 }), oversPerInnings: 20 })
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Apply DLS method')).not.toBeInTheDocument()
  })

  it('shows DLS checkbox when innings 1 ended before the full allocation', () => {
    // 90 legalBalls = 15 overs out of 20 scheduled
    renderFlow({ completedState: makeState({ legalBalls: 90 }), oversPerInnings: 20 })
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByText('Apply DLS method')).toBeInTheDocument()
  })

  it('shows DLS checkbox even with just one ball bowled (1 < full allocation)', () => {
    renderFlow({ completedState: makeState({ legalBalls: 1 }), oversPerInnings: 20 })
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })
})

// ── DLS toggle off (default) ──────────────────────────────────────────────────

describe('DLS unchecked (default state)', () => {
  it('shows standard "Target to win" label when DLS is off', () => {
    renderFlow({ completedState: makeState({ legalBalls: 90, totalRuns: 150 }), oversPerInnings: 20 })
    expect(screen.getByText('Target to win')).toBeInTheDocument()
    // DLS checkbox exists but is unchecked
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    // Overs input should be hidden
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('displays totalRuns + 1 as the target when DLS is off', () => {
    renderFlow({ completedState: makeState({ legalBalls: 90, totalRuns: 150 }), oversPerInnings: 20 })
    // Target = 150 + 1 = 151
    expect(screen.getByText('151')).toBeInTheDocument()
  })
})

// ── DLS toggle on ─────────────────────────────────────────────────────────────

describe('DLS checked', () => {
  it('reveals the overs input when DLS checkbox is checked', () => {
    renderFlow({ completedState: makeState({ legalBalls: 90, totalRuns: 150 }), oversPerInnings: 20 })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('shows "DLS target to win" label when DLS is on', () => {
    renderFlow({ completedState: makeState({ legalBalls: 90, totalRuns: 150 }), oversPerInnings: 20 })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('DLS target to win')).toBeInTheDocument()
  })

  it('defaults team 2 overs to the number of overs team 1 faced', () => {
    // 90 legalBalls = 15 overs
    renderFlow({ completedState: makeState({ legalBalls: 90 }), oversPerInnings: 20 })
    fireEvent.click(screen.getByRole('checkbox'))
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('15')
  })

  it('shows the DLS-computed target (not score+1) when DLS is on', () => {
    renderFlow({ completedState: makeState({ legalBalls: 90, totalRuns: 150 }), oversPerInnings: 20 })
    fireEvent.click(screen.getByRole('checkbox'))
    // team1 faced 15 overs, team2 gets 15 overs (default) → same resources → target = 151
    const expectedTarget = dlsTarget(150, 15, 15)
    expect(screen.getAllByText(String(expectedTarget)).length).toBeGreaterThan(0)
  })

  it('updates the DLS target live when team 2 overs input changes', () => {
    renderFlow({ completedState: makeState({ legalBalls: 90, totalRuns: 150 }), oversPerInnings: 20 })
    fireEvent.click(screen.getByRole('checkbox'))
    const input = screen.getByRole('spinbutton')
    // Change to 10 overs — target should drop below 151
    fireEvent.change(input, { target: { value: '10' } })
    const expectedTarget = dlsTarget(150, 15, 10)
    expect(screen.getAllByText(String(expectedTarget)).length).toBeGreaterThan(0)
    expect(expectedTarget).toBeLessThan(151)
  })

  it('unchecking DLS reverts the target display to score + 1', () => {
    renderFlow({ completedState: makeState({ legalBalls: 90, totalRuns: 150 }), oversPerInnings: 20 })
    fireEvent.click(screen.getByRole('checkbox')) // check
    fireEvent.click(screen.getByRole('checkbox')) // uncheck
    expect(screen.getByText('Target to win')).toBeInTheDocument()
    expect(screen.getByText('151')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})

// ── Set Up Innings 2 inserts correct target ───────────────────────────────────

describe('Set Up Innings 2 — target written to DB', () => {
  it('inserts standard target (score + 1) when DLS is off', async () => {
    renderFlow({ completedState: makeState({ legalBalls: 120, totalRuns: 150 }), oversPerInnings: 20 })
    await act(async () => {
      fireEvent.click(screen.getByText('Set Up Innings 2 →'))
    })
    expect(capturedInsert).not.toBeNull()
    expect(capturedInsert!.target).toBe(151)
  })

  it('inserts DLS target when DLS is on and team 2 gets fewer overs', async () => {
    renderFlow({ completedState: makeState({ legalBalls: 90, totalRuns: 150 }), oversPerInnings: 20 })
    // Enable DLS
    fireEvent.click(screen.getByRole('checkbox'))
    // Change team 2 overs to 10
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } })

    await act(async () => {
      fireEvent.click(screen.getByText('Set Up Innings 2 →'))
    })

    const expectedTarget = dlsTarget(150, 15, 10)
    expect(capturedInsert).not.toBeNull()
    expect(capturedInsert!.target).toBe(expectedTarget)
    expect(expectedTarget).toBeLessThan(151)
  })

  it('inserts standard target when innings 1 was full and DLS is unavailable', async () => {
    renderFlow({ completedState: makeState({ legalBalls: 120, totalRuns: 200 }), oversPerInnings: 20 })
    await act(async () => {
      fireEvent.click(screen.getByText('Set Up Innings 2 →'))
    })
    expect(capturedInsert!.target).toBe(201)
  })
})

// ── Pre-match phase (innings2Id already exists) ───────────────────────────────

describe('Pre-match phase (innings2Id pre-set)', () => {
  it('renders opener and bowler selection buttons', () => {
    renderFlow({ innings2Id: 'inn2-id' })
    expect(screen.getByText('Select Opening Batter 1…')).toBeInTheDocument()
    expect(screen.getByText('Select Opening Batter 2…')).toBeInTheDocument()
    expect(screen.getByText('Select Opening Bowler…')).toBeInTheDocument()
  })

  it('Start Scoring button is disabled until all three are selected', () => {
    renderFlow({ innings2Id: 'inn2-id' })
    expect(screen.getByRole('button', { name: /Start Scoring/i })).toBeDisabled()
  })
})

// ── onResumeScoring callback ──────────────────────────────────────────────────

describe('onResumeScoring callback arguments', () => {
  it('passes team1Score = completedState.totalRuns when DLS is off (full innings)', async () => {
    const { onResumeScoring } = renderFlow({
      innings2Id: 'inn2-id',
      completedState: makeState({ legalBalls: 120, totalRuns: 180 }),
      oversPerInnings: 20,
    })

    // Select opener 1
    fireEvent.click(screen.getByText('Select Opening Batter 1…'))
    await waitFor(() => screen.getByText('Batter One'))
    fireEvent.click(screen.getByText('Batter One'))

    // Select opener 2
    fireEvent.click(screen.getByText('Select Opening Batter 2…'))
    await waitFor(() => screen.getByText('Batter Two'))
    fireEvent.click(screen.getByText('Batter Two'))

    // Select bowler
    fireEvent.click(screen.getByText('Select Opening Bowler…'))
    await waitFor(() => screen.getByText('Bowler One'))
    fireEvent.click(screen.getByText('Bowler One'))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start Scoring/i }))
    })

    expect(onResumeScoring).toHaveBeenCalledOnce()
    const args = onResumeScoring.mock.calls[0]
    // args: (inn2Id, opener1, opener2, bowler, target, bonusRuns, team1Score, team1OversAllocated)
    expect(args[6]).toBe(180)   // team1Score
    expect(args[7]).toBe(20)    // team1OversAllocated = oversPerInnings when DLS off
    expect(args[4]).toBe(181)   // target = 180 + 1
  })
})
