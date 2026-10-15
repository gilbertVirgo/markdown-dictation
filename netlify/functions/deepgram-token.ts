import { requireAuth } from './_lib/session'

// Short-lived JWT for browser WebSockets; the API key never leaves the server.
// ttl 300s: token only needs to be valid at handshake; each reconnect fetches a new one.
export default async (req: Request): Promise<Response> => {
  try {
    const denied = requireAuth(req)
    if (denied) return denied
    if (req.method !== 'GET') return Response.json({ error: 'method not allowed' }, { status: 405 })
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl_seconds: 300 }),
    })
    if (!res.ok) return Response.json({ error: `deepgram grant failed (${res.status})` }, { status: 502 })
    const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in?: number }
    return Response.json({ token: access_token, expiresIn: expires_in })
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}
