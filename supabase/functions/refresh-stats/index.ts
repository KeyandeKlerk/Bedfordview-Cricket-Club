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
  const origin = req.headers.get('origin') ?? '*'

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
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
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }
  const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin']).limit(1)
  if (!roles || roles.length === 0) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  // Refresh all four materialized views CONCURRENTLY
  const views = [
    'season_batting_stats',
    'season_bowling_stats',
    'career_batting_stats',
    'career_bowling_stats',
  ]

  const errors: string[] = []
  for (const view of views) {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`
    })
    if (error) errors.push(`${view}: ${error.message}`)
  }

  if (errors.length > 0) {
    return new Response(JSON.stringify({ ok: false, errors }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, refreshed: views }), {
    status: 200,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
})
