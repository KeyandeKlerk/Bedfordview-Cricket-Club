import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ShotTypePicker from '../ShotTypePicker'

describe('ShotTypePicker', () => {
  it('renders shot type buttons', () => {
    render(<ShotTypePicker selected={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /drive/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cut/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ramp/i })).toBeInTheDocument()
  })

  it('calls onChange with the shot type on click', async () => {
    const onChange = vi.fn()
    render(<ShotTypePicker selected={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /drive/i }))
    expect(onChange).toHaveBeenCalledWith('drive')
  })

  it('calls onChange with null when clicking the already-selected shot (toggle off)', async () => {
    const onChange = vi.fn()
    render(<ShotTypePicker selected="drive" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /drive/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
