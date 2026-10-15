import { ObjectId } from 'mongodb'
import { deriveTitle } from '../../src/lib/markdown'
import { docs } from './_lib/mongo'
import { requireAuth } from './_lib/session'

export const config = { path: ['/api/docs', '/api/docs/:id'] }

const noMethod = () => Response.json({ error: 'method not allowed' }, { status: 405 })

export default async (req: Request): Promise<Response> => {
  try {
    return await handle(req)
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}

async function handle(req: Request): Promise<Response> {
  const denied = requireAuth(req)
  if (denied) return denied
  const seg = new URL(req.url).pathname.split('/').filter(Boolean)
  const idStr = seg[2]
  if (idStr && !/^[0-9a-f]{24}$/.test(idStr)) return Response.json({ error: "bad id" }, { status: 400 })
  const col = await docs()

  if (!idStr) {
    if (req.method === 'GET') {
      const rows = await col.find({}, { projection: { title: 1, updatedAt: 1 } }).sort({ updatedAt: -1 }).toArray()
      return Response.json({ docs: rows.map((r) => ({ id: String(r._id), title: r.title, updatedAt: r.updatedAt })) })
    }
    if (req.method === 'POST') {
      const { insertedId } = await col.insertOne({ title: 'Untitled', markdown: '', createdAt: new Date(), updatedAt: new Date() } as never)
      return Response.json({ id: String(insertedId) })
    }
    return noMethod()
  }

  const _id = new ObjectId(idStr)

  if (req.method === 'GET') {
    const r = await col.findOne({ _id })
    return r
      ? Response.json({ id: idStr, title: r.title, markdown: r.markdown, updatedAt: r.updatedAt })
      : Response.json({ error: 'not found' }, { status: 404 })
  }
  if (req.method === 'PUT') {
    const { markdown } = (await req.json().catch(() => ({}))) as { markdown?: unknown }
    if (typeof markdown !== 'string') return Response.json({ error: 'markdown required' }, { status: 400 })
    const title = deriveTitle(markdown)
    const updatedAt = new Date()
    const { matchedCount } = await col.updateOne({ _id }, { $set: { markdown, title, updatedAt } })
    return matchedCount ? Response.json({ updatedAt, title }) : Response.json({ error: 'not found' }, { status: 404 })
  }
  if (req.method === 'DELETE') {
    await col.deleteOne({ _id })
    return Response.json({ ok: true })
  }
  return noMethod()
}
