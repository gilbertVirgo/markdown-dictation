import Anthropic from '@anthropic-ai/sdk'
import { REFINE_SYSTEM, buildRefineUser, type BlockType, type Placement } from '../../src/lib/refinePrompt'
import { requireAuth } from './_lib/session'

const BLOCKS: BlockType[] = ['h1', 'h2', 'h3', 'body', 'quote']
const PLACEMENTS: Placement[] = ['inline', 'block']
const OUTPUT_SCHEMA = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }
export default async (req: Request): Promise<Response> => {
  try {
    const denied = requireAuth(req)
    if (denied) return denied
    if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return Response.json({ error: 'bad json' }, { status: 400 })
    const { documentMarkdown, chunk, block, placement = 'block' } = body // old clients send no placement
    if (typeof documentMarkdown !== 'string' || typeof chunk !== 'string' || !chunk.trim() || chunk.length > 4000
      || !BLOCKS.includes(block as BlockType) || !PLACEMENTS.includes(placement as Placement)) {
      return Response.json({ error: 'bad request' }, { status: 400 })
    }
    let msg: Anthropic.Message
    try {
      // Haiku 5.5 rejects non-default sampling params (temperature) with 400; thinking off for latency.
      // JSON output: as plain text, Haiku sometimes narrated its "~" decisions into the document.
      msg = await new Anthropic().messages.create({
        model: 'claude-haiku-5-5',
        max_tokens: 1024,
        thinking: { type: 'disabled' },
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        system: REFINE_SYSTEM,
        messages: [{ role: 'user', content: buildRefineUser(documentMarkdown, chunk, block as BlockType, placement as Placement) }],
      })
    } catch (e) {
      console.error('refine: anthropic call failed', e)
      return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 502 })
    }
    if (msg.stop_reason === 'refusal') return Response.json({ error: 'refused' }, { status: 502 })
    if (msg.stop_reason === 'max_tokens') return Response.json({ error: 'truncated' }, { status: 502 }) // JSON would be cut off
    const { text } = JSON.parse(msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')) as { text: string }
    return Response.json({ text: text.replace(/^[ \t]+|[ \t]+$/g, '') }) // keep edge \n: "new paragraph" at a chunk end
  } catch (e) {
    console.error('refine: failed', e)
    return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}
