import { describe, it, expect } from 'vitest'
import { computeResizedDimensions } from '../resize'

describe('computeResizedDimensions', () => {
  it('leaves dimensions unchanged when already under maxWidth', () => {
    expect(computeResizedDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('downscales width to maxWidth and preserves aspect ratio', () => {
    expect(computeResizedDimensions(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 })
  })

  it('downscales a portrait image by width, preserving aspect ratio', () => {
    // 2000x4000 -> maxWidth 1600 -> scale 0.8 -> height 3200
    expect(computeResizedDimensions(2000, 4000, 1600)).toEqual({ width: 1600, height: 3200 })
  })

  it('treats a width exactly at maxWidth as already fitting', () => {
    expect(computeResizedDimensions(1600, 900, 1600)).toEqual({ width: 1600, height: 900 })
  })

  it('rounds fractional heights to the nearest integer', () => {
    // 1000x333 -> maxWidth 700 -> scale 0.7 -> height 233.1 -> 233
    expect(computeResizedDimensions(1000, 333, 700)).toEqual({ width: 700, height: 233 })
  })
})

describe('assertFileSize', () => {
  it('does not throw for a file under the limit', async () => {
    const { assertFileSize } = await import('../resize')
    expect(() => assertFileSize({ size: 5 * 1024 * 1024 } as File)).not.toThrow()
  })

  it('throws ImageTooLargeError for a file over the default 15MB limit', async () => {
    const { assertFileSize, ImageTooLargeError } = await import('../resize')
    expect(() => assertFileSize({ size: 20 * 1024 * 1024 } as File)).toThrow(ImageTooLargeError)
  })

  it('respects a custom max size', async () => {
    const { assertFileSize, ImageTooLargeError } = await import('../resize')
    expect(() => assertFileSize({ size: 2 * 1024 * 1024 } as File, 1 * 1024 * 1024)).toThrow(ImageTooLargeError)
  })
})
