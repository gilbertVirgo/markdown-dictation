import { sessionCookie } from './_lib/session'

export default async (req: Request): Promise<Response> =>
  Response.json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0, req) } })
