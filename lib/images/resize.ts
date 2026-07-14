export function computeResizedDimensions(
  width: number,
  height: number,
  maxWidth: number
): { width: number; height: number } {
  if (width <= maxWidth) return { width, height }
  const scale = maxWidth / width
  return { width: maxWidth, height: Math.round(height * scale) }
}

export const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024

export class ImageTooLargeError extends Error {}

export function assertFileSize(file: File, maxBytes: number = MAX_SOURCE_FILE_BYTES): void {
  if (file.size > maxBytes) {
    throw new ImageTooLargeError(
      `Image is ${(file.size / 1024 / 1024).toFixed(1)}MB — max allowed is ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`
    )
  }
}

/**
 * Downscales/re-encodes an image file in the browser via <canvas>.
 * Not unit-testable (no real canvas 2d context in Node/jsdom) — exercised
 * by the Playwright e2e test in Task 14.
 */
export function resizeImageFile(
  file: File,
  opts: { maxWidth?: number; quality?: number } = {}
): Promise<Blob> {
  const maxWidth = opts.maxWidth ?? 1600
  const quality = opts.quality ?? 0.82

  return new Promise((resolve, reject) => {
    try {
      assertFileSize(file)
    } catch (err) {
      reject(err)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = computeResizedDimensions(img.width, img.height, maxWidth)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Image encoding failed')),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}
