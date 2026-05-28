import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BowlingTypePicker from '../BowlingTypePicker'
import type { BowlingType } from '@/lib/cricket/types'

const ENTRIES: { value: BowlingType; label: string; fullLabel: string }[] = [
  { value: 'right_arm_fast',     label: 'RAP', fullLabel: 'Right Arm Pace' },
  { value: 'right_arm_medium',   label: 'RAM', fullLabel: 'Right Arm Medium' },
  { value: 'left_arm_fast',      label: 'LAP', fullLabel: 'Left Arm Pace' },
  { value: 'left_arm_medium',    label: 'LAM', fullLabel: 'Left Arm Medium' },
  { value: 'right_arm_off_spin', label: 'OBS', fullLabel: 'Off Spin' },
  { value: 'right_arm_leg_spin', label: 'LBS', fullLabel: 'Leg Spin' },
  { value: 'left_arm_orthodox',  label: 'SLA', fullLabel: 'Left Arm Orthodox' },
  { value: 'left_arm_chinaman',  label: 'CHN', fullLabel: 'Chinaman' },
]

function renderPicker(selected: BowlingType | null, onChange = vi.fn()) {
  render(<BowlingTypePicker selected={selected} onChange={onChange} />)
  return { onChange }
}

describe('BowlingTypePicker — button rendering', () => {
  it('renders a button for every bowling type (by abbreviated label)', () => {
    renderPicker(null)
    for (const { label } of ENTRIES) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('renders 8 buttons in total', () => {
    renderPicker(null)
    expect(screen.getAllByRole('button')).toHaveLength(8)
  })

  it('renders the "Bowling Type" label', () => {
    renderPicker(null)
    expect(screen.getByText(/Bowling Type/i)).toBeInTheDocument()
  })

  it('buttons carry the full-label title attribute', () => {
    renderPicker(null)
    for (const { label, fullLabel } of ENTRIES) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('title', fullLabel)
    }
  })

  it('shows the full label inline when a type is selected', () => {
    renderPicker('right_arm_fast')
    // The full label is rendered inside a <span> alongside "— ", so use regex match
    expect(screen.getByText(/Right Arm Pace/)).toBeInTheDocument()
  })

  it('does NOT show a full label inline when nothing is selected', () => {
    renderPicker(null)
    for (const { fullLabel } of ENTRIES) {
      expect(screen.queryByText(new RegExp(fullLabel))).not.toBeInTheDocument()
    }
  })
})

describe('BowlingTypePicker — onChange on click', () => {
  it('calls onChange with the value when a button is clicked (nothing selected)', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(null)
    await user.click(screen.getByRole('button', { name: 'RAP' }))
    expect(onChange).toHaveBeenCalledWith('right_arm_fast')
  })

  it('calls onChange with a new value when a different type is already selected', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker('right_arm_fast')
    await user.click(screen.getByRole('button', { name: 'LAP' }))
    expect(onChange).toHaveBeenCalledWith('left_arm_fast')
  })

  it('calls onChange with the correct value for each button', async () => {
    const user = userEvent.setup()
    for (const { value, label } of ENTRIES) {
      const onChange = vi.fn()
      const { unmount } = render(<BowlingTypePicker selected={null} onChange={onChange} />)
      await user.click(screen.getByRole('button', { name: label }))
      expect(onChange).toHaveBeenCalledWith(value)
      unmount()
    }
  })
})

describe('BowlingTypePicker — toggle-off (null) on re-click of selected', () => {
  it('calls onChange with null when the already-selected type is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker('right_arm_fast')
    await user.click(screen.getByRole('button', { name: 'RAP' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with null for every type when it is the selected value', async () => {
    const user = userEvent.setup()
    for (const { value, label } of ENTRIES) {
      const onChange = vi.fn()
      const { unmount } = render(<BowlingTypePicker selected={value} onChange={onChange} />)
      await user.click(screen.getByRole('button', { name: label }))
      expect(onChange).toHaveBeenCalledWith(null)
      unmount()
    }
  })

  it('does NOT call onChange with null when a different (non-selected) type is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker('right_arm_fast')
    await user.click(screen.getByRole('button', { name: 'LAP' }))
    expect(onChange).not.toHaveBeenCalledWith(null)
  })
})
