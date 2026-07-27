import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Hoist mock variables so they are available inside vi.mock() factories ──────

const { mockFrom, mockUpdate, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn().mockReturnValue(Promise.resolve({ error: null }))
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate })
  return { mockFrom, mockUpdate, mockEq }
})

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/offline/queue', () => ({
  isInBallQueue: vi.fn().mockResolvedValue(false),
  mergeAnnotationIntoBallQueue: vi.fn().mockResolvedValue(true),
  queueAnnotation: vi.fn().mockResolvedValue(undefined),
  flushAnnotations: vi.fn().mockResolvedValue({ flushed: 0, errors: 0 }),
  clearQueue: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

// ── Import mocked module for assertions ───────────────────────────────────────

import * as queueModule from '@/lib/offline/queue'
import BallAnnotationPanel from '../BallAnnotationPanel'

// ── Default props ──────────────────────────────────────────────────────────────

function makeProps(overrides: Partial<{
  ballId: string
  knownBowlingType: import('@/lib/cricket/types').BowlingType | null
  knownBatterHandedness: 'right' | 'left' | null
  onAnnotated: ReturnType<typeof vi.fn>
  onSkip: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    ballId: 'ball-test-1',
    knownBowlingType: null as import('@/lib/cricket/types').BowlingType | null,
    knownBatterHandedness: null as 'right' | 'left' | null,
    onAnnotated: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Restore resolved values cleared by clearAllMocks
  vi.mocked(queueModule.isInBallQueue).mockResolvedValue(false)
  vi.mocked(queueModule.mergeAnnotationIntoBallQueue).mockResolvedValue(true)
  vi.mocked(queueModule.queueAnnotation).mockResolvedValue(undefined)
  // Fix: mutate mockEq directly so the outer variable stays in sync with assertions
  mockEq.mockReturnValue(Promise.resolve({ error: null }))
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ update: mockUpdate })
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BallAnnotationPanel — renders all pickers', () => {
  it('renders wagon wheel SVG with label text', () => {
    render(<BallAnnotationPanel {...makeProps()} />)
    // WagonWheelPicker renders a label above the SVG — use that instead of an internal fill color
    expect(screen.getByText(/wagon wheel/i)).toBeInTheDocument()
  })

  it('renders pitch map with label text', () => {
    render(<BallAnnotationPanel {...makeProps()} />)
    expect(screen.getByText(/pitch map/i)).toBeInTheDocument()
  })

  it('renders shot type buttons', () => {
    render(<BallAnnotationPanel {...makeProps()} />)
    expect(screen.getByRole('button', { name: /^drive$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^cut$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^pull$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sweep$/i })).toBeInTheDocument()
  })

  it('renders bowling type picker grid when no knownBowlingType (changingBowlingType=true)', () => {
    render(<BallAnnotationPanel {...makeProps({ knownBowlingType: null })} />)
    expect(screen.getByRole('button', { name: /^RAP$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^OBS$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^SLA$/ })).toBeInTheDocument()
  })

  it('renders Execution and Decision quality pickers', () => {
    render(<BallAnnotationPanel {...makeProps()} />)
    expect(screen.getByText('Execution')).toBeInTheDocument()
    expect(screen.getByText('Decision')).toBeInTheDocument()
    // "excellent" only appears in Execution picker
    expect(screen.getByRole('button', { name: /^excellent$/i })).toBeInTheDocument()
    // "good" appears in both Execution and Decision pickers — use getAllByRole
    const goodButtons = screen.getAllByRole('button', { name: /^good$/i })
    expect(goodButtons).toHaveLength(2)
  })

  it('renders RHB and LHB toggle buttons', () => {
    render(<BallAnnotationPanel {...makeProps()} />)
    expect(screen.getByRole('button', { name: 'RHB' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LHB' })).toBeInTheDocument()
  })

  it('renders the header title', () => {
    render(<BallAnnotationPanel {...makeProps()} />)
    expect(screen.getByText(/annotate ball/i)).toBeInTheDocument()
  })
})

describe('BallAnnotationPanel — Skip button calls onSkip without calling onAnnotated', () => {
  it('footer Skip button calls onSkip and not onAnnotated', async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    const onAnnotated = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onSkip, onAnnotated })} />)

    // Footer skip button has class "btn btn-ghost"
    // There are multiple skip-related buttons: overlay click, header "Skip →", footer "Skip"
    // Find the footer one — it's the button with exact text "Skip"
    const allSkipButtons = screen.getAllByRole('button', { name: /^skip$/i })
    // There may be just one "Skip" (the footer) vs "Skip →" in header
    await user.click(allSkipButtons[0])

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onAnnotated).not.toHaveBeenCalled()
  })

  it('Skip button calls onSkip with current handedness (default right)', async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onSkip, knownBatterHandedness: null })} />)

    const allSkipButtons = screen.getAllByRole('button', { name: /^skip$/i })
    await user.click(allSkipButtons[0])

    expect(onSkip).toHaveBeenCalledWith('right')
  })

  it('header "Skip →" button also calls onSkip without onAnnotated', async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    const onAnnotated = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onSkip, onAnnotated })} />)

    const headerSkip = screen.getByRole('button', { name: /skip →/i })
    await user.click(headerSkip)

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onAnnotated).not.toHaveBeenCalled()
  })
})

describe('BallAnnotationPanel — Confirm button calls onAnnotated with annotation values', () => {
  it('Save Annotation button is disabled when nothing is selected (hasAny=false)', () => {
    render(<BallAnnotationPanel {...makeProps()} />)
    expect(screen.getByRole('button', { name: /save annotation/i })).toBeDisabled()
  })

  it('Save Annotation button becomes enabled after selecting a shot type', async () => {
    const user = userEvent.setup()
    render(<BallAnnotationPanel {...makeProps()} />)

    await user.click(screen.getByRole('button', { name: /^drive$/i }))

    expect(screen.getByRole('button', { name: /save annotation/i })).not.toBeDisabled()
  })

  it('calls onAnnotated once with annotation containing shot_type after save', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^drive$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))
    const [annotation, handedness] = onAnnotated.mock.calls[0] as [Record<string, unknown>, string]
    expect(annotation.shot_type).toBe('drive')
    expect(handedness).toBe('right')
  })

  it('annotation object has all expected keys with correct values', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^cut$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))
    const [annotation] = onAnnotated.mock.calls[0] as [Record<string, unknown>]
    // wagon wheel was not tapped — coordinates should be null
    expect(annotation).toHaveProperty('wagon_x', null)
    expect(annotation).toHaveProperty('wagon_y', null)
    expect(annotation).toHaveProperty('pitch_length', null)
    expect(annotation).toHaveProperty('pitch_line', null)
    // shot type was explicitly selected
    expect(annotation).toHaveProperty('shot_type', 'cut')
    expect(annotation).toHaveProperty('bowling_type')
    expect(annotation).toHaveProperty('execution_quality')
    expect(annotation).toHaveProperty('decision_quality')
  })

  it('calls onAnnotated with execution_quality when quality picker is selected', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^excellent$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))
    const [annotation] = onAnnotated.mock.calls[0] as [Record<string, unknown>]
    expect(annotation.execution_quality).toBe('excellent')
  })

  it('passes the correct handedness to onAnnotated when LHB is selected', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onAnnotated })} />)

    // Switch to LHB
    await user.click(screen.getByRole('button', { name: 'LHB' }))
    // Select something to enable save
    await user.click(screen.getByRole('button', { name: /^drive$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))
    const [, handedness] = onAnnotated.mock.calls[0] as [unknown, string]
    expect(handedness).toBe('left')
  })

  it('calls Supabase update with correct table and ballId when online and ball not queued', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    // isInBallQueue returns false (default from beforeEach) — ball is not in offline queue
    // navigator.onLine is true in jsdom by default
    render(<BallAnnotationPanel {...makeProps({ ballId: 'ball-abc-123', onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^cut$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))

    expect(mockFrom).toHaveBeenCalledWith('ball_events')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ shot_type: 'cut' })
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'ball-abc-123')
  })

  it('calls mergeAnnotationIntoBallQueue when ball is still in the offline queue', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    // Override for this test: ball IS in the queue
    vi.mocked(queueModule.isInBallQueue).mockResolvedValueOnce(true)

    render(<BallAnnotationPanel {...makeProps({ ballId: 'ball-queued-1', onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^drive$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))

    expect(queueModule.mergeAnnotationIntoBallQueue).toHaveBeenCalledWith(
      'ball-queued-1',
      expect.objectContaining({ shot_type: 'drive' })
    )
    // Supabase should NOT have been called since the offline queue path was taken
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('BallAnnotationPanel — race condition: ball flushed between isInBallQueue check and merge', () => {
  it('falls back to a direct Supabase update when mergeAnnotationIntoBallQueue reports the ball was not found', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    // isInBallQueue said "still queued", but by the time merge runs, flushQueue()
    // has already removed it (and synced it) — merge reports "not found".
    vi.mocked(queueModule.isInBallQueue).mockResolvedValueOnce(true)
    vi.mocked(queueModule.mergeAnnotationIntoBallQueue).mockResolvedValueOnce(false)

    render(<BallAnnotationPanel {...makeProps({ ballId: 'ball-race-1', onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^drive$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))

    expect(queueModule.mergeAnnotationIntoBallQueue).toHaveBeenCalledWith(
      'ball-race-1',
      expect.objectContaining({ shot_type: 'drive' })
    )
    // The annotation must not be lost — it should have been applied via a
    // direct Supabase update since the ball is (by now) already synced.
    expect(mockFrom).toHaveBeenCalledWith('ball_events')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ shot_type: 'drive' }))
    expect(mockEq).toHaveBeenCalledWith('id', 'ball-race-1')
  })
})

describe('BallAnnotationPanel — online update failure falls back to queueAnnotation', () => {
  it('queues the annotation for later retry when the direct Supabase update returns an error', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    mockEq.mockReturnValueOnce(Promise.resolve({ error: { message: 'network error' } }))

    render(<BallAnnotationPanel {...makeProps({ ballId: 'ball-fail-1', onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^drive$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))

    expect(queueModule.queueAnnotation).toHaveBeenCalledWith(
      'ball-fail-1',
      expect.objectContaining({ shot_type: 'drive' })
    )
  })

  it('queues the annotation for later retry when the direct Supabase update throws', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    // Use a lazy implementation (rather than a pre-built rejected Promise) so the
    // rejection is only created once the component awaits it — avoids a spurious
    // "unhandled rejection" warning from the promise existing before anything awaits it.
    mockEq.mockImplementationOnce(() => Promise.reject(new Error('network down')))

    render(<BallAnnotationPanel {...makeProps({ ballId: 'ball-fail-2', onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^drive$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    await waitFor(() => expect(onAnnotated).toHaveBeenCalledTimes(1))

    expect(queueModule.queueAnnotation).toHaveBeenCalledWith(
      'ball-fail-2',
      expect.objectContaining({ shot_type: 'drive' })
    )
  })
})

describe('BallAnnotationPanel — panel does not auto-submit on render', () => {
  it('neither onSkip nor onAnnotated is called on initial render', () => {
    const onSkip = vi.fn()
    const onAnnotated = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onSkip, onAnnotated })} />)
    expect(onSkip).not.toHaveBeenCalled()
    expect(onAnnotated).not.toHaveBeenCalled()
  })
})

describe('BallAnnotationPanel — knownBowlingType prop pre-fills the bowling type picker', () => {
  it('shows compact display (not full picker grid) when knownBowlingType is set', () => {
    render(<BallAnnotationPanel {...makeProps({ knownBowlingType: 'right_arm_off_spin' })} />)
    // Compact view shows full label text and a Change button
    expect(screen.getByText('Off spin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^change$/i })).toBeInTheDocument()
  })

  it('does not show the bowling type grid buttons when knownBowlingType is set', () => {
    render(<BallAnnotationPanel {...makeProps({ knownBowlingType: 'right_arm_fast' })} />)
    // Grid button RAP should not be present
    expect(screen.queryByRole('button', { name: /^RAP$/ })).not.toBeInTheDocument()
  })

  it('clicking Change reveals the full BowlingTypePicker grid', async () => {
    const user = userEvent.setup()
    render(<BallAnnotationPanel {...makeProps({ knownBowlingType: 'right_arm_off_spin' })} />)

    await user.click(screen.getByRole('button', { name: /^change$/i }))

    expect(screen.getByRole('button', { name: /^RAP$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^OBS$/ })).toBeInTheDocument()
  })

  it('shows "Right arm fast" label for right_arm_fast knownBowlingType', () => {
    render(<BallAnnotationPanel {...makeProps({ knownBowlingType: 'right_arm_fast' })} />)
    expect(screen.getByText('Right arm fast')).toBeInTheDocument()
  })

  it('initialises handedness to left when knownBatterHandedness is left', async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ knownBatterHandedness: 'left', onSkip })} />)

    const allSkipButtons = screen.getAllByRole('button', { name: /^skip$/i })
    await user.click(allSkipButtons[0])

    expect(onSkip).toHaveBeenCalledWith('left')
  })
})
