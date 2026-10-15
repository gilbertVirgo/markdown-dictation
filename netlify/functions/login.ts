import { timingSafeEqual } from 'node:crypto'
import { sessionCookie, sign } from './_lib/session'

const DAY = 86400

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  const secret = process.env.SESSION_SECRET
  const expected = process.env.APP_PASSWORD
  if (!secret || !expected) return Response.json({ error: 'server misconfigured' }, { status: 500 })
  const { password } = ((await req.json().catch(() => null)) ?? {}) as { password?: unknown }
  const given = Buffer.from(typeof password === 'string' ? password : '')
  const want = Buffer.from(expected)
  const len = Math.max(given.length, want.length)
  const pad = (b: Buffer) => Buffer.concat([b, Buffer.alloc(len - b.length)])
  if (!timingSafeEqual(pad(given), pad(want)) || given.length !== want.length)
    return Response.json({ error: 'wrong password' }, { status: 401 })
  return Response.json(
    { ok: true },
    { headers: { 'set-cookie': sessionCookie(sign(Date.now() + 30 * DAY * 1000, secret), 30 * DAY, req) } },
  )
}
