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

  it('renders differently for LHB vs RHB — arc sweep flag and label positions differ', () => {
    const { container: rhbContainer } = render(<WagonWheelPicker wagX={null} wagY={null} handedness="right" onChange={() => {}} />)
    const { container: lhbContainer } = render(<WagonWheelPicker wagX={null} wagY={null} handedness="left" onChange={() => {}} />)

    // RHB: off-side shading arc uses sweep-flag=1 (clockwise, right half)
    // LHB: off-side shading arc uses sweep-flag=0 (counter-clockwise, left half)
    const rhbPaths = Array.from(rhbContainer.querySelectorAll('path'))
    const lhbPaths = Array.from(lhbContainer.querySelectorAll('path'))
    const rhbShadingPath = rhbPaths.find(p => p.getAttribute('fill') === 'rgba(37,99,235,0.06)')!
    const lhbShadingPath = lhbPaths.find(p => p.getAttribute('fill') === 'rgba(37,99,235,0.06)')!
    expect(rhbShadingPath).toBeTruthy()
    expect(lhbShadingPath).toBeTruthy()
    // RHB arc has sweep-flag 1, LHB arc has sweep-flag 0
    expect(rhbShadingPath.getAttribute('d')).toContain('0 0 1')
    expect(lhbShadingPath.getAttribute('d')).toContain('0 0 0')

    // "off" label: RHB is right of centre (x > 150), LHB is left of centre (x < 150)
    const rhbTexts = Array.from(rhbContainer.querySelectorAll('text'))
    const lhbTexts = Array.from(lhbContainer.querySelectorAll('text'))
    const rhbOffLabel = rhbTexts.find(t => t.textContent === 'off')!
    const lhbOffLabel = lhbTexts.find(t => t.textContent === 'off')!
    expect(rhbOffLabel).toBeTruthy()
    expect(lhbOffLabel).toBeTruthy()
    const rhbOffX = parseFloat(rhbOffLabel.getAttribute('x')!)
    const lhbOffX = parseFloat(lhbOffLabel.getAttribute('x')!)
    expect(rhbOffX).toBeGreaterThan(150)  // RHB off side is on the right
    expect(lhbOffX).toBeLessThan(150)     // LHB off side is on the left
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

  it('negates wagon_x for LHB so stored value is always off=positive', () => {
    // SVG: CX=150, CY=150, R_BOUNDARY=130, viewBox 300x300
    // Click at (200, 150): svgX=200, svgY=150 → wx_raw = (200-150)/130 ≈ +0.385 (right of centre)
    // RHB: wx stored as +0.385 (off side right)
    // LHB: wx stored as -0.385 (negated — same physical hit is now off-left, which is still off=positive for LHB, but the stored convention is negated relative to visual position)

    const mockRect = () => ({
      left: 0, top: 0, width: 300, height: 300,
      right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {},
    })

    const onChangeRHB = vi.fn()
    const { container: rhbContainer } = render(
      <WagonWheelPicker wagX={null} wagY={null} handedness="right" onChange={onChangeRHB} />
    )
    const rhbSvg = rhbContainer.querySelector('svg')!
    rhbSvg.getBoundingClientRect = mockRect
    fireEvent.click(rhbSvg, { clientX: 200, clientY: 150 })
    expect(onChangeRHB).toHaveBeenCalledTimes(1)
    const [wxRHB] = onChangeRHB.mock.calls[0]

    const onChangeLHB = vi.fn()
    const { container: lhbContainer } = render(
      <WagonWheelPicker wagX={null} wagY={null} handedness="left" onChange={onChangeLHB} />
    )
    const lhbSvg = lhbContainer.querySelector('svg')!
    lhbSvg.getBoundingClientRect = mockRect
    fireEvent.click(lhbSvg, { clientX: 200, clientY: 150 })
    expect(onChangeLHB).toHaveBeenCalledTimes(1)
    const [wxLHB] = onChangeLHB.mock.calls[0]

    // Same click position → RHB gets positive wx (right of centre), LHB gets negative wx (negated)
    expect(wxRHB).toBeGreaterThan(0)
    expect(wxLHB).toBeLessThan(0)
    expect(wxRHB).toBeCloseTo(-wxLHB, 5)
  })
})
