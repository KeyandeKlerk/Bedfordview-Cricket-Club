import { render, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import PitchMapPicker from '../PitchMapPicker'

describe('PitchMapPicker', () => {
  it('renders an SVG without error when no selection', () => {
    const { container } = render(<PitchMapPicker length={null} line={null} onSelect={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without error with an existing selection', () => {
    const { container } = render(<PitchMapPicker length="good_length" line="middle" onSelect={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('calls onSelect with valid length and line strings when a pitch cell is tapped', () => {
    const onSelect = vi.fn()
    const { container } = render(<PitchMapPicker length={null} line={null} onSelect={onSelect} />)
    const svg = container.querySelector('svg')!

    // PitchMapPicker SVG viewBox: VIEW_W=168, VIEW_H=312
    // Set getBoundingClientRect to match SVG units 1:1
    svg.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 168, height: 312,
      right: 168, bottom: 312, x: 0, y: 0, toJSON: () => {},
    })

    // The onClick handler is on individual <rect> grid cells (not the SVG root).
    // querySelectorAll('rect') returns: pitch background, then 18 cell rects (6 rows × 3 cols),
    // then pitch border. The cell rects have style="cursor: pointer" and have onClick.
    // Click the first cell rect that has an onClick (index may vary — find via style).
    const allRects = Array.from(container.querySelectorAll('rect'))
    // Cell rects have cursor:pointer set inline
    const cellRects = allRects.filter(r => (r as HTMLElement).style.cursor === 'pointer')
    expect(cellRects.length).toBe(18) // 6 lengths × 3 lines

    const firstCell = cellRects[0] as SVGRectElement
    // The cell's closest('svg') call needs getBoundingClientRect mocked on the SVG
    fireEvent.click(firstCell, { clientX: 80, clientY: 50 })

    expect(onSelect).toHaveBeenCalledTimes(1)
    const [length, line] = onSelect.mock.calls[0]
    expect(typeof length).toBe('string')
    expect(typeof line).toBe('string')
  })

  it('renders the selected cell highlighted', () => {
    const { container } = render(
      <PitchMapPicker length="good_length" line="middle" onSelect={() => {}} />
    )
    const allRects = Array.from(container.querySelectorAll('rect'))
    const selectedCell = allRects.find(r => r.getAttribute('fill') === 'rgba(37,99,235,0.45)')
    expect(selectedCell).toBeTruthy()
  })
})
