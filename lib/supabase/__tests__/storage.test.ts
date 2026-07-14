import { describe, it, expect, vi } from 'vitest'
import { uploadNewsImage } from '../storage'

function makeSuccessSupabase() {
  return {
    storage: {
      from: () => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/news-images/${path}` } }),
      }),
    },
  } as any
}

function makeErrorSupabase() {
  return {
    storage: {
      from: () => ({
        upload: vi.fn(() => Promise.resolve({ error: { message: 'upload failed' } })),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  } as any
}

describe('uploadNewsImage', () => {
  const blob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' })

  it('returns a public URL on success', async () => {
    const result = await uploadNewsImage(makeSuccessSupabase(), blob, 'user-1')
    expect(result.error).toBeNull()
    expect(result.url).toContain('https://x.supabase.co/news-images/user-1/')
    expect(result.url).toMatch(/\.jpg$/)
  })

  it('uses the given extension', async () => {
    const result = await uploadNewsImage(makeSuccessSupabase(), blob, 'user-1', 'png')
    expect(result.url).toMatch(/\.png$/)
  })

  it('returns an error and no URL when upload fails', async () => {
    const result = await uploadNewsImage(makeErrorSupabase(), blob, 'user-1')
    expect(result.url).toBeNull()
    expect(result.error).toBe('upload failed')
  })
})
