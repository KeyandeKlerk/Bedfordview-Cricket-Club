import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import BowlingTypePicker from '../BowlingTypePicker'

describe('BowlingTypePicker', () => {
  it('renders bowling type buttons', () => {
    render(<BowlingTypePicker selected={null} onChange={() => {}} />)
    // Labels are abbreviations: RAP, RAM, LAP, LAM, OBS, LBS, SLA, CHN
    expect(screen.getByRole('button', { name: 'RAP' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CHN' })).toBeInTheDocument()
  })

  it('calls onChange with bowling type on click', async () => {
    const onChange = vi.fn()
    render(<BowlingTypePicker selected={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'RAP' }))
    expect(onChange).toHaveBeenCalledWith('right_arm_fast')
  })

  it('toggles off when clicking the selected type', async () => {
    const onChange = vi.fn()
    render(<BowlingTypePicker selected="right_arm_fast" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'RAP' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
