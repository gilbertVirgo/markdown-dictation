import { createHmac, timingSafeEqual } from 'node:crypto'

const mac = (expiry: string, secret: string) => createHmac('sha256', secret).update(expiry).digest('hex')

export function sign(expiryMs: number, secret: string): string {
  return `${expiryMs}.${mac(String(expiryMs), secret)}`
}

export function verify(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false
  const [expiry, hmac, ...rest] = token.split('.')
  if (!expiry || !hmac || rest.length) return false
  const a = Buffer.from(hmac)
  const b = Buffer.from(mac(expiry, secret))
  return a.length === b.length && timingSafeEqual(a, b) && Number(expiry) > now
}

export function requireAuth(req: Request): Response | null {
  const secret = process.env.SESSION_SECRET
  const token = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('session='))
    ?.slice(8)
  if (secret && verify(token, secret)) return null
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}

export function sessionCookie(token: string, maxAgeSec: number, req: Request): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
  return `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure}`
}
