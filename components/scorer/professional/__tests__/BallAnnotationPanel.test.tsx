import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Hoist mock variables so they are available inside vi.mock() factories ──────

const { mockFrom, mockUpdate, mockEq } = vi.hoisted(() => {
  const mockEq = vi.fn().mockReturnValue({ then: vi.fn() })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate })
  return { mockFrom, mockUpdate, mockEq }
})

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/offline/queue', () => ({
  isInBallQueue: vi.fn().mockResolvedValue(false),
  mergeAnnotationIntoBallQueue: vi.fn().mockResolvedValue(undefined),
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
  vi.mocked(queueModule.mergeAnnotationIntoBallQueue).mockResolvedValue(undefined)
  vi.mocked(queueModule.queueAnnotation).mockResolvedValue(undefined)
  const newMockEq = vi.fn().mockReturnValue({ then: vi.fn() })
  mockUpdate.mockReturnValue({ eq: newMockEq })
  mockFrom.mockReturnValue({ update: mockUpdate })
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BallAnnotationPanel — renders all pickers', () => {
  it('renders wagon wheel SVG with outfield circle', () => {
    const { container } = render(<BallAnnotationPanel {...makeProps()} />)
    // WagonWheelPicker renders an SVG; outfield circle has fill="#0f2a1a"
    const outfieldCircle = container.querySelector('circle[fill="#0f2a1a"]')
    expect(outfieldCircle).toBeInTheDocument()
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

    expect(onAnnotated).toHaveBeenCalledTimes(1)
    const [annotation, handedness] = onAnnotated.mock.calls[0] as [Record<string, unknown>, string]
    expect(annotation.shot_type).toBe('drive')
    expect(handedness).toBe('right')
  })

  it('annotation object has all expected keys', async () => {
    const user = userEvent.setup()
    const onAnnotated = vi.fn()
    render(<BallAnnotationPanel {...makeProps({ onAnnotated })} />)

    await user.click(screen.getByRole('button', { name: /^cut$/i }))
    await user.click(screen.getByRole('button', { name: /save annotation/i }))

    const [annotation] = onAnnotated.mock.calls[0] as [Record<string, unknown>]
    expect(annotation).toHaveProperty('wagon_x')
    expect(annotation).toHaveProperty('wagon_y')
    expect(annotation).toHaveProperty('pitch_length')
    expect(annotation).toHaveProperty('pitch_line')
    expect(annotation).toHaveProperty('shot_type')
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

    expect(onAnnotated).toHaveBeenCalledTimes(1)
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

    const [, handedness] = onAnnotated.mock.calls[0] as [unknown, string]
    expect(handedness).toBe('left')
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
