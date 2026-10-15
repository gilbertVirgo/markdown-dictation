import Anthropic from '@anthropic-ai/sdk'
import { REFINE_SYSTEM, buildRefineUser, type BlockType } from '../../src/lib/refinePrompt'
import { requireAuth } from './_lib/session'

const BLOCKS: BlockType[] = ['h1', 'h2', 'h3', 'body', 'quote']
export default async (req: Request): Promise<Response> => {
  try {
    const denied = requireAuth(req)
    if (denied) return denied
    if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return Response.json({ error: 'bad json' }, { status: 400 })
    const { documentMarkdown, chunk, block } = body
    if (typeof documentMarkdown !== 'string' || typeof chunk !== 'string' || !chunk.trim() || chunk.length > 4000
      || !BLOCKS.includes(block as BlockType)) {
      return Response.json({ error: 'bad request' }, { status: 400 })
    }
    let msg: Anthropic.Message
    try {
      // Haiku 5.5 rejects non-default sampling params (temperature) with 400; thinking off for latency
      msg = await new Anthropic().messages.create({
        model: 'claude-haiku-5-5',
        max_tokens: 1024,
        thinking: { type: 'disabled' },
        system: REFINE_SYSTEM,
        messages: [{ role: 'user', content: buildRefineUser(documentMarkdown, chunk, block as BlockType) }],
      })
    } catch (e) {
      return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 502 })
    }
    if (msg.stop_reason === 'refusal') return Response.json({ error: 'refused' }, { status: 502 })
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').replace(/^[ \t]+|[ \t]+$/g, '') // keep edge \n: "new paragraph" at a chunk end
    return Response.json(msg.stop_reason === 'max_tokens' ? { text, truncated: true } : { text })
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}
