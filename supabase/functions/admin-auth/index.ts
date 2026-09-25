// Supabase Edge Function: admin-auth
//
// Checks the submitted PIN against the ADMIN_PIN secret and, on success,
// inserts a row into admin_sessions using the service-role key (bypassing
// RLS) and returns the token. The token is a plain UUID — its only power is
// that a corresponding, unexpired row exists in admin_sessions, which the
// organizer_* Postgres functions check on every call. Sessions last 4 hours.
//
// Deploy: supabase functions deploy admin-auth
// Secrets: supabase secrets set ADMIN_PIN=1234

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SESSION_HOURS = 4

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { pin } = await req.json()
    const expectedPin = Deno.env.get('ADMIN_PIN')

    if (!expectedPin) {
      return new Response(JSON.stringify({ error: 'ADMIN_PIN secret not configured' }), { status: 500 })
    }
    if (!pin || String(pin) !== String(expectedPin)) {
      // Deliberately vague — do not reveal whether a PIN was "close".
      return new Response(JSON.stringify({ error: 'Incorrect PIN' }), { status: 401 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabaseAdmin
      .from('admin_sessions')
      .insert({ expires_at: expiresAt })
      .select('token')
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ token: data.token, expires_at: expiresAt }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
  }
})
