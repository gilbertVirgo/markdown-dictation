import OpenAI from 'openai'
import { requireAuth } from './_lib/session'
import { langCode } from '../../src/voice/engines/langCode'

export default async (req: Request): Promise<Response> => {
  try {
    const denied = requireAuth(req)
    if (denied) return denied
    if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: 'file required' }, { status: 400 })
    const prompt = String(form.get('prompt') ?? '')
    const language = langCode(String(form.get('lang') ?? ''))
    try {
      const r = await new OpenAI().audio.transcriptions.create({
        file,
        model: 'gpt-4o-transcribe',
        ...(prompt && { prompt }),
        ...(language && { language }),
      })
      return Response.json({ text: r.text?.trim() ?? '' })
    } catch (e) {
      if (e instanceof OpenAI.APIError) return Response.json({ error: e.message }, { status: 502 })
      throw e
    }
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}
