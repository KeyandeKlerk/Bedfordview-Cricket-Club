import { redirect } from 'next/navigation'

export default async function LiveRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/matches/${id}`)
}
