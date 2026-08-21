const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const { code } = await req.json()
    if (!code) {
      return new Response(JSON.stringify({ error: 'missing_code' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('DISCORD_CLIENT_ID') || Deno.env.get('VITE_DISCORD_CLIENT_ID') || '',
        client_secret: Deno.env.get('DISCORD_CLIENT_SECRET') || '',
        grant_type: 'authorization_code',
        code,
      }),
    })
    const json = await response.json()
    if (!json.access_token) {
      return new Response(JSON.stringify({ error: 'token_exchange_failed', detail: json }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ access_token: json.access_token }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
