# Markdown Dictation — Design

Mobile-first web app for context-aware speech-to-text into markdown documents.
Replaces Apple Notes dictation: never stops on its own, understands document vocabulary, writes markdown.

## Stack
- Vite + React 19 + TypeScript, Tailwind v4, system sans font.
- Netlify Functions (TypeScript) under `netlify/functions/` for all server work; Netlify hosting.
- MongoDB (Atlas) via official `mongodb` driver.
- Editor: Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `tiptap-markdown`). Markdown is the stored source of truth; Tiptap renders it Notion-style (typing `# ` becomes an H1, marker disappears).
- Tests: Vitest (pure logic), Playwright (E2E against `netlify dev`).

## Secrets (`.env`, gitignored; `.env.example` committed)
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `MONGODB_URI`, `APP_PASSWORD`, `SESSION_SECRET`.

## Auth
Single user. `POST /api/login {password}` compares to `APP_PASSWORD`, sets HttpOnly SameSite=Lax cookie `session` = HMAC-SHA256(SESSION_SECRET, expiry).`expiry` (30 days). Every other function verifies the cookie; 401 otherwise. Client redirects to `/login` on 401. `POST /api/logout` clears it.

## Data
Collection `docs`: `{ _id: ObjectId, title: string, markdown: string, createdAt: Date, updatedAt: Date }`.
Title = first H1 or first line of markdown, derived on save (server side).

Endpoints (one function file `api.ts` with path routing, or one file per route — implementer's choice, keep it small):
- `GET /api/docs` → `[{id,title,updatedAt}]` sorted by updatedAt desc
- `POST /api/docs` → creates empty doc, returns `{id}`
- `GET /api/docs/:id` → `{id,title,markdown,updatedAt}`
- `PUT /api/docs/:id {markdown}` → `{updatedAt}`
- `DELETE /api/docs/:id`

## Autosave
Editor `onUpdate` → serialize markdown → debounce 800 ms → PUT. Also flush immediately on `visibilitychange` (hidden) and `pagehide` using `fetch(..., {keepalive:true})`. Status pill shows "Saved" / "Saving…" / "Offline — unsaved". No local persistence beyond that.

## Screens (mobile first, max-width ~720px centred on desktop)
1. `/login` — password field, submit.
2. `/` — list of docs (title, relative date), "+" button, swipe/long-press-free: a trash icon per row with confirm.
3. `/doc/:id` — editor.
   - Top bar: back, save status, menu (copy markdown, download .md, delete, logout).
   - Mode switch: **Voice** (default) / **Text**.
   - Text mode: Tiptap editor fully editable + inline toolbar: Bold, Italic, Link, H1, H2, H3, Quote, Bullet.
   - Voice mode: editor read-only-ish (still scrollable, shows live text) + bottom control panel with large touch targets:
     - Mic button (big, coral when live, grey/struck when muted). Tapping toggles mute. Recognition keeps running across muted periods; muted = audio ignored.
     - Row: `H1` `H2` `H3` `Body` `Quote` — **sticky-for-next-block**: tap sets pending block type; the next dictated chunk starts a new block of that type; then resets to Body.
     - Small settings sheet (gear): STT engine selector (Web Speech / OpenAI / Deepgram), "Refine with Claude" toggle (on by default; forced off for engine 3 experiment), language.
   - Dictated text inserts at document end (voice mode) — the cursor position is not used in voice mode.

## Dictation pipeline
`useTranscriber(engine, {onChunk(text, isFinal)})` — one hook, three engine implementations behind the same interface.
1. **webspeech** — `SpeechRecognition` continuous + interim; on `end`/`error` auto-restart unless user left voice mode. Chunk = each final result.
2. **openai** — `MediaRecorder` restarted every 8 s to produce standalone blobs (webm/opus on Chrome, mp4/aac on iOS Safari); each blob → `POST /api/transcribe/openai` (multipart) → OpenAI `gpt-4o-transcribe` with `prompt` = vocabulary hint (up to ~200 distinctive words from doc). Chunk = each response. `ponytail:` fixed 8 s segmentation can cut words at boundaries; upgrade path is silence-based segmentation.
3. **deepgram** — `GET /api/deepgram-token` mints a 60 s temporary key; browser opens `wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&interim_results=true&keyterm=...` (keyterms from doc vocab), streams `MediaRecorder` data every 250 ms. Chunk = each `is_final` transcript.

Mute: engine keeps running, hook drops chunks while muted.

Each final chunk is inserted into the editor immediately, wrapped in a `pending` mark (grey text) with a unique id, in a block of the currently pending type (`# `, `## `, `### `, `> `, or paragraph). If "Refine with Claude" is on, `POST /api/refine {documentMarkdown, chunk, blockType}` runs async; response replaces the marked range and clears the mark. On failure the mark is simply cleared (raw text stays).

## Claude refine
Model `claude-haiku-5-5`, max_tokens 1024, temperature 0. System prompt (built in `src/lib/refinePrompt.ts`, unit-tested):
- You correct raw speech-to-text output for a markdown document.
- Use the document for context: prefer names/terms already in the document when the raw text sounds like them (e.g. "knee higher" → "Nehemiah").
- Add natural punctuation and capitalisation.
- Convert spoken commands: "new line"/"new paragraph" → line breaks, "comma"/"full stop"/"period"/"question mark"/"exclamation mark"/"colon"/"open quote"/"close quote" → punctuation, "bullet point" → `- ` list item.
- Output only the corrected text for the chunk, as markdown, no commentary, no fences.
User message: `<document>…</document>\n<block_type>h2</block_type>\n<raw>…</raw>`.
Document context is capped at the last ~6000 characters plus the first 500 (title + opening).

## Visual
60/30/10: 60% background (white; black in dark mode via `prefers-color-scheme`), 30% neutral greys (surfaces, borders, secondary text), 10% primary coral `#F2543D` (live mic, active buttons, links, focus rings). Font: `font-sans` = system-ui stack. CSS variables for the three roles; Tailwind theme reads them.

## Tests
- Vitest: `refinePrompt` builder (context capping, block type), vocabulary extractor, title derivation, cookie sign/verify.
- Playwright: login → create doc → type `# Hello` becomes H1 → reload → persisted; inserting a chunk via exposed test hook renders pending then refined (refine mocked via route interception).

## Out of scope (YAGNI)
Multi-user, sharing, offline queue, images, tables, undo across sessions, PWA install manifest beyond a basic `theme-color`.
