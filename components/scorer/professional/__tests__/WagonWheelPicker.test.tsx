import { render, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import WagonWheelPicker from '../WagonWheelPicker'

describe('WagonWheelPicker', () => {
  it('renders an SVG without error when no value set', () => {
    const { container } = render(<WagonWheelPicker wagX={null} wagY={null} onChange={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without error when a value is already set', () => {
    const { container } = render(<WagonWheelPicker wagX={0.3} wagY={0.5} onChange={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders differently for LHB vs RHB', () => {
    const { container: rhb } = render(<WagonWheelPicker wagX={null} wagY={null} handedness="right" onChange={() => {}} />)
    const { container: lhb } = render(<WagonWheelPicker wagX={null} wagY={null} handedness="left" onChange={() => {}} />)
    expect(rhb.innerHTML).not.toEqual(lhb.innerHTML)
  })

  it('calls onChange when tapping inside the boundary circle', () => {
    const onChange = vi.fn()
    const { container } = render(<WagonWheelPicker wagX={null} wagY={null} onChange={onChange} />)
    const svg = container.querySelector('svg')!

    // SVG is 300x300 units; boundary circle is centred at (150,150) with radius 130
    // Mock getBoundingClientRect so the coordinate math works
    svg.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 300, height: 300,
      right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {},
    })

    // Click at centre (well inside boundary)
    fireEvent.click(svg, { clientX: 150, clientY: 150 })
    expect(onChange).toHaveBeenCalledTimes(1)
    const [wx, wy] = onChange.mock.calls[0]
    expect(wx).toBeCloseTo(0, 1)
    expect(wy).toBeCloseTo(0, 1)
  })

  it('does NOT call onChange when tapping outside the boundary circle', () => {
    const onChange = vi.fn()
    const { container } = render(<WagonWheelPicker wagX={null} wagY={null} onChange={onChange} />)
    const svg = container.querySelector('svg')!
    svg.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 300, height: 300,
      right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {},
    })

    // Click at corner — far outside boundary circle centred at (150,150) with r=130
    fireEvent.click(svg, { clientX: 0, clientY: 0 })
    expect(onChange).not.toHaveBeenCalled()
  })
})
