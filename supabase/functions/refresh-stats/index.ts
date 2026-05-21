import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

serve(async (req) => {
  const ALLOWED_ORIGINS = [
    'https://bedfordviewcc.co.za',
    'https://www.bedfordviewcc.co.za',
    'http://localhost:3000',
  ]
  const requestOrigin = req.headers.get('origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(allowedOrigin) })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(allowedOrigin), 'Content-Type': 'application/json' },
    })
  }

  // Use service role for materialized view refresh
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify caller is admin
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { authorization: authHeader } } }
  )
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(allowedOrigin), 'Content-Type': 'application/json' },
    })
  }
  const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin']).limit(1)
  if (!roles || roles.length === 0) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders(allowedOrigin), 'Content-Type': 'application/json' },
    })
  }

  // Refresh all materialized views via dedicated DB function
  const { error: refreshError } = await supabase.rpc('refresh_stats_views')
  if (refreshError) {
    return new Response(JSON.stringify({ ok: false, error: refreshError.message }), {
      status: 500,
      headers: { ...corsHeaders(allowedOrigin), 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders(allowedOrigin), 'Content-Type': 'application/json' },
  })
})
