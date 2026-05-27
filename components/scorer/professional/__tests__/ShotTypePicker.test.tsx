import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShotTypePicker from '../ShotTypePicker'
import type { ShotType } from '@/lib/cricket/types'

const ALL_SHOTS: ShotType[] = ['drive', 'cut', 'pull', 'sweep', 'glance', 'block', 'leave', 'slog', 'ramp']

function renderPicker(selected: ShotType | null, onChange = vi.fn()) {
  render(<ShotTypePicker selected={selected} onChange={onChange} />)
  return { onChange }
}

describe('ShotTypePicker — button rendering', () => {
  it('renders a button for every shot type', () => {
    renderPicker(null)
    for (const shot of ALL_SHOTS) {
      expect(screen.getByRole('button', { name: new RegExp(shot, 'i') })).toBeInTheDocument()
    }
  })

  it('renders 9 buttons in total', () => {
    renderPicker(null)
    expect(screen.getAllByRole('button')).toHaveLength(9)
  })

  it('renders the "Shot Type" label', () => {
    renderPicker(null)
    expect(screen.getByText('Shot Type')).toBeInTheDocument()
  })
})

describe('ShotTypePicker — onChange on click', () => {
  it('calls onChange with the shot value when a button is clicked (nothing selected)', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(null)
    await user.click(screen.getByRole('button', { name: /drive/i }))
    expect(onChange).toHaveBeenCalledWith('drive')
  })

  it('calls onChange with the clicked value when a different shot is already selected', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker('drive')
    await user.click(screen.getByRole('button', { name: /cut/i }))
    expect(onChange).toHaveBeenCalledWith('cut')
  })

  it('calls onChange for each distinct shot type', async () => {
    const user = userEvent.setup()
    for (const shot of ALL_SHOTS) {
      const onChange = vi.fn()
      const { unmount } = render(<ShotTypePicker selected={null} onChange={onChange} />)
      await user.click(screen.getByRole('button', { name: new RegExp(`^${shot}$`, 'i') }))
      expect(onChange).toHaveBeenCalledWith(shot)
      unmount()
    }
  })
})

describe('ShotTypePicker — toggle-off (null) on re-click of selected', () => {
  it('calls onChange with null when the already-selected shot is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker('drive')
    await user.click(screen.getByRole('button', { name: /drive/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with null for every shot type when it is the selected value', async () => {
    const user = userEvent.setup()
    for (const shot of ALL_SHOTS) {
      const onChange = vi.fn()
      const { unmount } = render(<ShotTypePicker selected={shot} onChange={onChange} />)
      await user.click(screen.getByRole('button', { name: new RegExp(`^${shot}$`, 'i') }))
      expect(onChange).toHaveBeenCalledWith(null)
      unmount()
    }
  })

  it('does NOT call onChange with null when a different (non-selected) shot is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker('drive')
    await user.click(screen.getByRole('button', { name: /cut/i }))
    expect(onChange).not.toHaveBeenCalledWith(null)
  })
})
