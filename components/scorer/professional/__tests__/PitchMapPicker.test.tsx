import { render, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import PitchMapPicker from '../PitchMapPicker'

// PitchMapPicker layout constants (mirrors component source):
// PITCH_W=120, PITCH_H=280, CELL_W=40, CELL_H≈46.67, PAD_L=40, PAD_T=24
// VIEW_W = 40+120+8 = 168, VIEW_H = 24+280+8 = 312
// LENGTHS (top to bottom): bouncer, short, good_length, full, yorker, full_toss
// LINES (RHB, left to right): outside_off, middle, outside_leg

describe('PitchMapPicker', () => {
  it('renders an SVG without error when no selection', () => {
    const { container } = render(<PitchMapPicker length={null} line={null} onSelect={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without error with an existing selection', () => {
    const { container } = render(<PitchMapPicker length="good_length" line="middle" onSelect={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('calls onSelect with the exact length and line for the tapped cell', () => {
    const onSelect = vi.fn()
    const { container } = render(<PitchMapPicker length={null} line={null} onSelect={onSelect} />)
    const svg = container.querySelector('svg')!

    // Mock SVG bounding rect 1:1 with the viewBox (168×312)
    // so scaleX = VIEW_W/168 = 1, scaleY = VIEW_H/312 = 1
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 168, height: 312,
      right: 168, bottom: 312, x: 0, y: 0, toJSON: () => {},
    } as DOMRect)

    // Target cell: row=2 (good_length), col=1 (middle) in RHB order
    // svgX for col=1 centre: PAD_L + 1.5 * CELL_W = 40 + 60 = 100 → clientX=100
    // svgY for row=2 centre: PAD_T + 2.5 * CELL_H = 24 + (2.5 * 280/6) ≈ 24 + 116.67 ≈ 140.67 → clientY≈141
    const allRects = Array.from(container.querySelectorAll('rect'))
    const cellRects = allRects.filter(r => (r as HTMLElement).style.cursor === 'pointer')
    expect(cellRects.length).toBe(18) // 6 lengths × 3 lines

    // Cell rects are rendered row-major: index = row*3 + col
    // Row 2 (good_length), col 1 (middle) → index = 2*3+1 = 7
    const targetCell = cellRects[7] as SVGRectElement
    fireEvent.click(targetCell, { clientX: 100, clientY: 141 })

    expect(onSelect).toHaveBeenCalledTimes(1)
    const [length, line] = onSelect.mock.calls[0]
    expect(length).toBe('good_length')
    expect(line).toBe('middle')

    vi.restoreAllMocks()
  })

  it('calls onSelect with correct length and line for the first cell (bouncer / outside_off)', () => {
    const onSelect = vi.fn()
    const { container } = render(<PitchMapPicker length={null} line={null} onSelect={onSelect} />)

    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 168, height: 312,
      right: 168, bottom: 312, x: 0, y: 0, toJSON: () => {},
    } as DOMRect)

    const allRects = Array.from(container.querySelectorAll('rect'))
    const cellRects = allRects.filter(r => (r as HTMLElement).style.cursor === 'pointer')

    // Row 0 (bouncer), col 0 (outside_off) → index 0
    // svgX centre: PAD_L + 0.5*CELL_W = 40+20=60 → clientX=60
    // svgY centre: PAD_T + 0.5*CELL_H = 24 + 23.33 ≈ 47.33 → clientY≈47
    fireEvent.click(cellRects[0], { clientX: 60, clientY: 47 })

    expect(onSelect).toHaveBeenCalledTimes(1)
    const [length, line] = onSelect.mock.calls[0]
    expect(length).toBe('bouncer')
    expect(line).toBe('outside_off')

    vi.restoreAllMocks()
  })

  it('renders the selected cell with a distinct stroke, not the default cell stroke', () => {
    const { container } = render(
      <PitchMapPicker length="good_length" line="middle" onSelect={() => {}} />
    )
    const allRects = Array.from(container.querySelectorAll('rect'))
    const cellRects = allRects.filter(r => (r as HTMLElement).style.cursor === 'pointer')

    // The selected cell has stroke="#38bdf8"; all other cells have stroke="#334155"
    const highlightedCells = cellRects.filter(r => r.getAttribute('stroke') === '#38bdf8')
    const defaultCells = cellRects.filter(r => r.getAttribute('stroke') === '#334155')

    expect(highlightedCells).toHaveLength(1)
    expect(defaultCells).toHaveLength(17)

    // Confirm the highlighted cell also has the selection fill (not transparent)
    expect(highlightedCells[0].getAttribute('fill')).not.toBe('transparent')
  })
})
