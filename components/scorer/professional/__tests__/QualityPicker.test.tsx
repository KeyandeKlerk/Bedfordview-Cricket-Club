import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QualityPicker from '../QualityPicker'

const QUALITY_OPTIONS = ['poor', 'average', 'good', 'excellent']
const DELIVERY_OPTIONS = ['full toss', 'yorker', 'length', 'short']

function renderPicker(
  options: string[],
  selected: string | null,
  onChange = vi.fn(),
  label = 'Quality',
) {
  render(<QualityPicker label={label} options={options} selected={selected} onChange={onChange} />)
  return { onChange }
}

describe('QualityPicker — button rendering', () => {
  it('renders a button for each option', () => {
    renderPicker(QUALITY_OPTIONS, null)
    for (const opt of QUALITY_OPTIONS) {
      expect(screen.getByRole('button', { name: new RegExp(opt, 'i') })).toBeInTheDocument()
    }
  })

  it('renders the correct number of buttons', () => {
    renderPicker(QUALITY_OPTIONS, null)
    expect(screen.getAllByRole('button')).toHaveLength(QUALITY_OPTIONS.length)
  })

  it('renders the label text', () => {
    renderPicker(QUALITY_OPTIONS, null, vi.fn(), 'Ball Quality')
    expect(screen.getByText('Ball Quality')).toBeInTheDocument()
  })

  it('works with a different set of options', () => {
    renderPicker(DELIVERY_OPTIONS, null)
    for (const opt of DELIVERY_OPTIONS) {
      expect(screen.getByRole('button', { name: new RegExp(opt, 'i') })).toBeInTheDocument()
    }
  })

  it('renders with a single option', () => {
    renderPicker(['good'], null)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /good/i })).toBeInTheDocument()
  })
})

describe('QualityPicker — onChange on click', () => {
  it('calls onChange with the option value when a button is clicked (nothing selected)', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(QUALITY_OPTIONS, null)
    await user.click(screen.getByRole('button', { name: /good/i }))
    expect(onChange).toHaveBeenCalledWith('good')
  })

  it('calls onChange with a new value when a different option is already selected', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(QUALITY_OPTIONS, 'poor')
    await user.click(screen.getByRole('button', { name: /excellent/i }))
    expect(onChange).toHaveBeenCalledWith('excellent')
  })

  it('calls onChange with the correct value for each option', async () => {
    const user = userEvent.setup()
    for (const opt of QUALITY_OPTIONS) {
      const onChange = vi.fn()
      const { unmount } = render(
        <QualityPicker label="Quality" options={QUALITY_OPTIONS} selected={null} onChange={onChange} />,
      )
      await user.click(screen.getByRole('button', { name: new RegExp(`^${opt}$`, 'i') }))
      expect(onChange).toHaveBeenCalledWith(opt)
      unmount()
    }
  })
})

describe('QualityPicker — toggle-off (null) on re-click of selected', () => {
  it('calls onChange with null when the already-selected option is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(QUALITY_OPTIONS, 'good')
    await user.click(screen.getByRole('button', { name: /good/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with null for every option when it is the selected value', async () => {
    const user = userEvent.setup()
    for (const opt of QUALITY_OPTIONS) {
      const onChange = vi.fn()
      const { unmount } = render(
        <QualityPicker label="Quality" options={QUALITY_OPTIONS} selected={opt} onChange={onChange} />,
      )
      await user.click(screen.getByRole('button', { name: new RegExp(`^${opt}$`, 'i') }))
      expect(onChange).toHaveBeenCalledWith(null)
      unmount()
    }
  })

  it('does NOT call onChange with null when a different (non-selected) option is clicked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(QUALITY_OPTIONS, 'good')
    await user.click(screen.getByRole('button', { name: /poor/i }))
    expect(onChange).not.toHaveBeenCalledWith(null)
  })

  it('only calls onChange once per click', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker(QUALITY_OPTIONS, 'good')
    await user.click(screen.getByRole('button', { name: /good/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
