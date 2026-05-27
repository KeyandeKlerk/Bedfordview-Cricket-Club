import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import QualityPicker from '../QualityPicker'

const OPTIONS = ['poor', 'average', 'good', 'excellent']

describe('QualityPicker', () => {
  it('renders the label', () => {
    render(<QualityPicker label="Execution Quality" options={OPTIONS} selected={null} onChange={() => {}} />)
    expect(screen.getByText(/Execution Quality/i)).toBeInTheDocument()
  })

  it('renders all option buttons', () => {
    render(<QualityPicker label="Q" options={OPTIONS} selected={null} onChange={() => {}} />)
    OPTIONS.forEach(opt =>
      expect(screen.getByRole('button', { name: new RegExp(opt, 'i') })).toBeInTheDocument()
    )
  })

  it('calls onChange with the option on click', async () => {
    const onChange = vi.fn()
    render(<QualityPicker label="Q" options={OPTIONS} selected={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /good/i }))
    expect(onChange).toHaveBeenCalledWith('good')
  })

  it('toggles off when clicking the selected option', async () => {
    const onChange = vi.fn()
    render(<QualityPicker label="Q" options={OPTIONS} selected="good" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /good/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
