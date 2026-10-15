import { sessionCookie } from './_lib/session'

export default async (req: Request): Promise<Response> =>
  req.method !== 'POST'
    ? new Response(null, { status: 405 })
    : Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0, req) } })
