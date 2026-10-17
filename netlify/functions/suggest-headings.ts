import Anthropic from '@anthropic-ai/sdk'
import { HEADINGS_SYSTEM, MAX_BLOCKS, buildHeadingsUser, validSuggestions, type HeadingBlock } from '../../src/lib/headingsPrompt'
import { requireAuth } from './_lib/session'

const TYPES = ['h1', 'h2', 'h3', 'p', 'blank', 'list', 'quote', 'other']
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    headings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { before: { type: 'integer' }, level: { type: 'integer', enum: [2, 3] }, text: { type: 'string' } },
        required: ['before', 'level', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['headings'],
  additionalProperties: false,
}

export default async (req: Request): Promise<Response> => {
  try {
    const denied = requireAuth(req)
    if (denied) return denied
    if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
    const body = (await req.json().catch(() => null)) as { blocks?: unknown } | null
    const blocks = body?.blocks
    if (!Array.isArray(blocks) || !blocks.length || blocks.length > MAX_BLOCKS
      || !blocks.every((b) => b && typeof b.text === 'string' && TYPES.includes(b.type))) {
      return Response.json({ error: 'bad request' }, { status: 400 })
    }
    let msg: Anthropic.Message
    try {
      // same setup as refine: Haiku 5.5, no sampling params, thinking off for latency, JSON schema output
      msg = await new Anthropic().messages.create({
        model: 'claude-haiku-5-5',
        max_tokens: 4096,
        thinking: { type: 'disabled' },
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        system: HEADINGS_SYSTEM,
        messages: [{ role: 'user', content: buildHeadingsUser(blocks as HeadingBlock[]) }],
      })
    } catch (e) {
      console.error('suggest-headings: anthropic call failed', e)
      return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 502 })
    }
    if (msg.stop_reason === 'refusal') return Response.json({ error: 'refused' }, { status: 502 })
    if (msg.stop_reason === 'max_tokens') return Response.json({ error: 'truncated' }, { status: 502 })
    const raw = JSON.parse(msg.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))
    return Response.json({ headings: validSuggestions(raw, blocks as HeadingBlock[]) })
  } catch (e) {
    console.error('suggest-headings: failed', e)
    return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}
