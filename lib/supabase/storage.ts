type SupabaseLike = {
  storage: {
    from: (bucket: string) => {
      upload: (path: string, blob: Blob) => Promise<{ error: { message: string } | null }>
      getPublicUrl: (path: string) => { data: { publicUrl: string } }
    }
  }
}

export async function uploadNewsImage(
  supabaseClient: SupabaseLike,
  blob: Blob,
  userId: string,
  extension: string = 'jpg'
): Promise<{ url: string | null; error: string | null }> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
  const bucket = supabaseClient.storage.from('news-images')
  const { error } = await bucket.upload(path, blob)
  if (error) return { url: null, error: error.message }
  const { data } = bucket.getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
