# Markdown Dictation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile-first web app that dictates into markdown documents, with Claude Haiku using the document as context to fix misheard words.

**Architecture:** Vite/React SPA + Netlify Functions (all secrets server-side) + MongoDB. Tiptap renders markdown Notion-style; markdown string is the stored source of truth. One `useTranscriber` hook with three swappable engines (Web Speech, OpenAI, Deepgram); each final chunk is inserted as grey "pending" text and asynchronously replaced by Haiku's refined version.

**Tech Stack:** Vite 6, React 19, TypeScript 5, Tailwind v4 (`@tailwindcss/vite`), react-router v7, Tiptap 2 + `tiptap-markdown`, `mongodb` 6, `@anthropic-ai/sdk`, `openai`, Netlify Functions v2 (`export default async (req: Request) => Response`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-markdown-dictation-design.md`

## Global Constraints
- Node 24, npm. Netlify CLI 27 already installed (`netlify dev` serves SPA + functions on :8888).
- Secrets only in `.env` (gitignored). Commit `.env.example`. Never log secrets.
- Font: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` only.
- Colours via CSS variables on `:root` and `@media (prefers-color-scheme: dark)`: `--bg`, `--fg`, `--surface`, `--border`, `--muted`, `--primary: #F2543D`. 60% bg, 30% neutrals, 10% primary.
- Mobile first: layout must work at 375px wide; touch targets in voice panel ≥ 56px tall.
- Every function responds JSON; non-auth routes return 401 `{error:"unauthorized"}` when cookie invalid.
- Ponytail: smallest working code. No abstraction with one implementation (the transcriber interface has three, so it is allowed).
- Commit after each task with Conventional Commits. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File Structure
```
netlify.toml
netlify/functions/
  _lib/session.ts       sign/verify cookie, requireAuth(req)
  _lib/mongo.ts         cached MongoClient, docs collection
  login.ts  logout.ts
  docs.ts               /api/docs and /api/docs/:id (all verbs)
  refine.ts             Haiku refinement
  transcribe-openai.ts  multipart audio -> text
  deepgram-token.ts     temporary key
src/
  main.tsx  App.tsx (routes)  index.css (theme vars + tailwind)
  lib/api.ts            fetch wrapper, 401 -> /login
  lib/markdown.ts       deriveTitle, extractVocabulary
  lib/refinePrompt.ts   buildRefineMessages (shared with function via relative import)
  pages/Login.tsx  pages/DocList.tsx  pages/DocPage.tsx
  editor/Editor.tsx     Tiptap wrapper, exposes insertChunk/replacePending
  editor/PendingMark.ts Tiptap mark extension
  editor/Toolbar.tsx    text-mode inline toolbar
  voice/VoicePanel.tsx  mic + block buttons + settings
  voice/useTranscriber.ts  hook + engine switch
  voice/engines/webspeech.ts openai.ts deepgram.ts
  hooks/useAutosave.ts
tests/unit/*.test.ts    vitest
tests/e2e/*.spec.ts     playwright
```

---

### Task 1: Scaffold
**Files:** `package.json`, `vite.config.ts`, `netlify.toml`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.env.example`, `.gitignore`, `vitest.config.ts`, `tsconfig*.json`.
**Produces:** running `netlify dev` at http://localhost:8888 shows placeholder routes `/login`, `/`, `/doc/:id`; `npm test` runs vitest; functions dir wired.

- [ ] `npm create vite@latest . -- --template react-ts` (into existing dir; keep `.git`, `.claude`, `docs`).
- [ ] Install: `npm i react-router tailwindcss @tailwindcss/vite` ; dev: `npm i -D vitest @netlify/functions`.
- [ ] `vite.config.ts`: plugins `react()`, `tailwindcss()`.
- [ ] `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
[dev]
  command = "npm run dev"
  targetPort = 5173
  port = 8888
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
- [ ] `src/index.css`: `@import "tailwindcss";` then `@theme { --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --color-bg: var(--bg); --color-fg: var(--fg); --color-surface: var(--surface); --color-border: var(--border); --color-muted: var(--muted); --color-primary: #F2543D; }` and `:root { --bg:#fff; --fg:#111; --surface:#f4f4f4; --border:#e2e2e2; --muted:#777 } @media (prefers-color-scheme: dark){ :root { --bg:#000; --fg:#f2f2f2; --surface:#161616; --border:#2a2a2a; --muted:#9a9a9a } }` and `body { background: var(--bg); color: var(--fg); font-family: var(--font-sans) }`.
- [ ] `index.html`: viewport `width=device-width, initial-scale=1, viewport-fit=cover`, `<meta name="theme-color" content="#F2543D">`, title "Dictate".
- [ ] `src/App.tsx`: `BrowserRouter` with routes `/login`, `/`, `/doc/:id` rendering placeholder components.
- [ ] `.env.example` with the six keys, empty values. `.gitignore` includes `.env`, `.netlify`, `dist`, `node_modules`, `test-results`.
- [ ] `vitest.config.ts` with `test.include = ['tests/unit/**/*.test.ts']`. Add scripts: `dev`, `build`, `test: vitest run`, `e2e: playwright test`.
- [ ] Verify: `npm run build` passes; `npx netlify dev` responds 200 on `/`. Commit `chore: scaffold vite react tailwind netlify`.

### Task 2: Auth
**Files:** `netlify/functions/_lib/session.ts`, `netlify/functions/login.ts`, `netlify/functions/logout.ts`, `src/lib/api.ts`, `src/pages/Login.tsx`, `tests/unit/session.test.ts`.
**Produces:**
```ts
// _lib/session.ts
export function sign(expiryMs: number, secret: string): string // `${expiry}.${hex hmac}`
export function verify(token: string | undefined, secret: string, now = Date.now()): boolean
export function requireAuth(req: Request): Response | null // null = ok, else 401 Response
export function sessionCookie(token: string, maxAgeSec: number): string // Set-Cookie value, HttpOnly; SameSite=Lax; Path=/; Secure only when URL is https
// src/lib/api.ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> // JSON; on 401 -> location.replace('/login'); throws on !ok
```
- [ ] Test first (`tests/unit/session.test.ts`): sign→verify true; tampered token false; expired false; undefined false. Run, expect fail.
- [ ] Implement with `node:crypto` `createHmac('sha256')`, `timingSafeEqual`. Cookie parse by splitting `req.headers.get('cookie')`.
- [ ] `login.ts`: POST only; body `{password}`; compare with `timingSafeEqual` to `process.env.APP_PASSWORD` (pad to equal length); on match set cookie 30 days, return `{ok:true}`; else 401.
- [ ] `logout.ts`: clears cookie (`Max-Age=0`).
- [ ] `Login.tsx`: centred form, password input, primary button, error line. On success `navigate('/')`.
- [ ] Route guard: in `App.tsx`, for `/` and `/doc/:id` wrap in component that calls `GET /api/docs` lazily — simpler: rely on `api()` 401 redirect. No separate guard.
- [ ] Verify tests pass, manual login works via `netlify dev` with `.env` present (if `.env` absent, note it and move on). Commit `feat: password login with signed cookie`.

### Task 3: Docs API + list screen
**Files:** `netlify/functions/_lib/mongo.ts`, `netlify/functions/docs.ts`, `src/lib/markdown.ts`, `src/pages/DocList.tsx`, `tests/unit/markdown.test.ts`.
**Produces:**
```ts
// src/lib/markdown.ts
export function deriveTitle(markdown: string): string // first '# ' heading text, else first non-empty line stripped of md markers, else 'Untitled'; max 80 chars
export function extractVocabulary(markdown: string, max = 200): string[] // unique words ≥4 chars that are Capitalised or contain non-ascii or appear ≤2 times... keep simple: unique Capitalised words not at sentence start + any word with apostrophe/hyphen; dedupe; cap max
// docs.ts routes (Request-based, path from new URL(req.url).pathname)
GET    /api/docs          -> {docs:[{id,title,updatedAt}]}
POST   /api/docs          -> {id}
GET    /api/docs/:id      -> {id,title,markdown,updatedAt}
PUT    /api/docs/:id      body {markdown} -> {updatedAt,title}
DELETE /api/docs/:id      -> {ok:true}
```
- [ ] Tests for `deriveTitle` (h1, plain first line, empty) and `extractVocabulary` (picks "Nehemiah", skips "The" at sentence start, caps). Run, fail, implement, pass.
- [ ] `mongo.ts`: module-level `let client: MongoClient | undefined`; `export async function docs() { … return client.db().collection<DocRow>('docs') }`. DB name from URI default.
- [ ] `docs.ts`: `requireAuth` first. Parse `:id` with `ObjectId.isValid`. PUT sets `title = deriveTitle(markdown)` server-side. 
- [ ] `DocList.tsx`: fetch list on mount; rows (title, relative time via `Intl.RelativeTimeFormat`), trash icon with `confirm()`; floating "+" button bottom-right (primary) → POST → navigate `/doc/:id`. Empty state text.
- [ ] Commit `feat: docs CRUD and list screen`.

### Task 4: Editor, text mode, autosave, export
**Files:** `src/editor/Editor.tsx`, `src/editor/Toolbar.tsx`, `src/hooks/useAutosave.ts`, `src/pages/DocPage.tsx`.
**Deps:** `npm i @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link tiptap-markdown`.
**Produces:**
```ts
// Editor.tsx
export type EditorHandle = { getMarkdown(): string; insertChunk(text: string, block: BlockType, pendingId: string): void; replacePending(pendingId: string, text: string): void; clearPending(pendingId: string): void }
export type BlockType = 'h1'|'h2'|'h3'|'body'|'quote'
export const Editor = forwardRef<EditorHandle, { initial: string; editable: boolean; onChange(md: string): void }>
// useAutosave.ts
export function useAutosave(id: string, getMarkdown: () => string): { status: 'saved'|'saving'|'error'; markDirty(): void }
```
- [ ] `Editor.tsx`: `useEditor` with `StarterKit` (heading levels 1-3, blockquote, bulletList, bold, italic), `Link`, `Markdown` (from tiptap-markdown, `transformPastedText: true`). `getMarkdown()` = `editor.storage.markdown.getMarkdown()`. `insertChunk/replacePending/clearPending` implemented in Task 5 — stub as `insertChunk` appending a paragraph for now. Typography: `prose`-like CSS written by hand in index.css (h1 2rem bold, h2 1.5rem, h3 1.25rem, blockquote left border `--primary`, p 1.05rem/1.6).
- [ ] `Toolbar.tsx`: buttons B, I, Link (prompt URL), H1 H2 H3, Quote, Bullet using `editor.chain().focus().toggleX().run()`; `isActive` styling with `--primary`. Sticky at bottom in text mode, above keyboard-safe area (`pb-[env(safe-area-inset-bottom)]`).
- [ ] `useAutosave.ts`: `markDirty()` sets status 'saving' and debounces 800 ms → `PUT /api/docs/:id`. Also `visibilitychange`(hidden)/`pagehide` listeners → immediate `fetch(..., {method:'PUT', keepalive:true})` if dirty. Status 'error' on failure, retried on next markDirty.
- [ ] `DocPage.tsx`: loads doc; top bar: back `←`, status pill, menu (`<details>` dropdown: Copy markdown → `navigator.clipboard.writeText`; Download .md → blob anchor named `${title}.md`; Delete → confirm → DELETE → `/`; Logout). Mode segmented control Voice | Text (default Voice; Voice panel placeholder until Task 6). In Text mode editor `editable`.
- [ ] Verify manually: typing `# Hello` turns into H1 with no `#`; reload keeps content. Commit `feat: tiptap markdown editor with autosave and export`.

### Task 5: Claude refine + pending mark
**Files:** `src/lib/refinePrompt.ts`, `netlify/functions/refine.ts`, `src/editor/PendingMark.ts`, `src/editor/Editor.tsx` (fill stubs), `tests/unit/refinePrompt.test.ts`.
**Deps:** `npm i @anthropic-ai/sdk`. Implementer MUST load the `claude-api` skill before writing `refine.ts`.
**Produces:**
```ts
// refinePrompt.ts
export const REFINE_SYSTEM: string
export function buildRefineUser(documentMarkdown: string, chunk: string, block: BlockType): string // <document>…</document>\n<block_type>…</block_type>\n<raw>…</raw>; document capped: first 500 chars + "\n…\n" + last 6000 chars when longer than 6500
// refine.ts: POST {documentMarkdown, chunk, block} -> {text}
```
- [ ] Tests: cap behaviour (short doc unchanged; long doc has head, ellipsis, tail); block tag present; system prompt mentions "Nehemiah"-style instruction (assert includes 'prefer'). Fail → implement → pass.
- [ ] `REFINE_SYSTEM` content per spec: correct STT output; prefer terms already in document when raw sounds like them (give the knee higher→Nehemiah example); punctuation+capitalisation; spoken commands list (new line/new paragraph, comma, full stop/period, question mark, exclamation mark, colon, open/close quote, bullet point → `- `); output only corrected markdown text, no commentary, no fences, no block prefix (the app adds `#`/`>`).
- [ ] `refine.ts`: `requireAuth`; `new Anthropic()`; `messages.create({model:'claude-haiku-5-5', max_tokens:1024, temperature:0, system: REFINE_SYSTEM, messages:[{role:'user', content: buildRefineUser(...)}]})`; return trimmed text. On SDK error return 502 `{error}`.
- [ ] `PendingMark.ts`: `Mark.create({ name:'pending', addAttributes: ()=>({ id:{default:null} }), parseHTML/renderHTML: `<span data-pending="id">` with class `text-muted` })`. Exclude from markdown output: tiptap-markdown ignores unknown marks' serialisation by default — verify `getMarkdown()` output has no span; if it leaks, add `addStorage(){ return { markdown: { serialize: { open:'', close:'' } } } }`.
- [ ] `Editor.tsx` real implementations: `insertChunk` → focus end, `insertContent` of a node `{type: block==='body'?'paragraph':block==='quote'?'blockquote':'heading', attrs:{level}, content:[{type:'text', text, marks:[{type:'pending', attrs:{id}}]}]}` (quote wraps a paragraph). `replacePending(id, text)` → walk `editor.state.doc.descendants` to find text nodes with mark id, compute from/to, `tr.insertText(text, from, to)` then `removeMark`. `clearPending(id)` → `removeMark` only. Trigger `onChange` after.
- [ ] Commit `feat: claude haiku refine endpoint and pending marks`.

### Task 6: Web Speech engine + voice panel
**Files:** `src/voice/useTranscriber.ts`, `src/voice/engines/webspeech.ts`, `src/voice/VoicePanel.tsx`, `src/pages/DocPage.tsx` (wire).
**Produces:**
```ts
// engines/*.ts share:
export type Engine = { start(opts: EngineOpts): Promise<void>; stop(): void }
export type EngineOpts = { lang: string; vocabulary: string[]; onFinal(text: string): void; onInterim(text: string): void; onError(msg: string): void }
// useTranscriber.ts
export type EngineName = 'webspeech'|'openai'|'deepgram'
export function useTranscriber(opts: { engine: EngineName; lang: string; vocabulary: () => string[]; onFinal(text: string): void }): { live: boolean; muted: boolean; interim: string; error: string|null; start(): void; stop(): void; toggleMute(): void }
```
- [ ] `webspeech.ts`: `const SR = window.SpeechRecognition || window.webkitSpeechRecognition`; continuous=true, interimResults=true; on `result` emit final/interim; on `end` restart if not stopped (guard with `stopped` flag, small 250 ms delay); on `error` with `not-allowed` → onError and stop, other errors → restart. Export `isSupported()`.
- [ ] `useTranscriber.ts`: holds `mutedRef`; `onFinal` dropped while muted; `start` on mount of voice mode, `stop` on unmount/engine change. Engine registry `{webspeech, openai, deepgram}` — openai/deepgram stubs throwing "not implemented" until Tasks 7/8.
- [ ] `VoicePanel.tsx`: props `{ onChunk(text, block), vocabulary, settings, setSettings }`. State `pendingBlock: BlockType='body'`. Layout: interim text line (muted, italic) → big round mic button (72px, primary bg when live & unmuted, surface bg + mic-off icon when muted) → row of 5 block buttons (`H1 H2 H3 Body Quote`, min-h 56px, selected = primary outline) → gear button opens `<dialog>` settings: engine `<select>`, `Refine with Claude` checkbox, language input (default `en-GB`). Settings persisted in `localStorage['dictate.settings']`.
- [ ] `DocPage.tsx` wiring: on final chunk → `id = crypto.randomUUID()`; `editor.insertChunk(text, pendingBlock, id)`; `markDirty()`; if refine on → `api('/api/refine', …)` then `replacePending(id, text)` else `clearPending(id)`; on error `clearPending`. Reset pendingBlock to 'body' after use.
- [ ] Verify in Chrome desktop: speak, grey text appears, turns normal after refine. Commit `feat: web speech dictation with voice panel`.

### Task 7: OpenAI engine (parallel with 8)
**Files:** `netlify/functions/transcribe-openai.ts`, `src/voice/engines/openai.ts`.
**Deps:** `npm i openai`.
- [ ] `openai.ts` engine: `getUserMedia({audio:true})`; pick mime `audio/webm;codecs=opus` if `MediaRecorder.isTypeSupported` else `audio/mp4`; loop: new `MediaRecorder(stream, {mimeType})`, `start()`, after 8000 ms `stop()`; `ondataavailable` blob (skip if < 2 KB) → `FormData` {file, prompt: vocabulary.join(', ')} → `POST /api/transcribe/openai` → `onFinal(text)`. Loop restarts immediately so no gap. `// ponytail: fixed 8s segments can split words; upgrade: silence-based segmentation`.
- [ ] Function: `requireAuth`; `req.formData()`; `openai.audio.transcriptions.create({ file, model:'gpt-4o-transcribe', prompt, language? })`; return `{text}`.
- [ ] Add redirect in `netlify.toml`? Not needed — `/api/transcribe/openai` → function `transcribe-openai`? No: `/api/*` maps to `/.netlify/functions/:splat` so path must be `/api/transcribe-openai`. Use that.
- [ ] Commit `feat: openai transcription engine`.

### Task 8: Deepgram engine (parallel with 7)
**Files:** `netlify/functions/deepgram-token.ts`, `src/voice/engines/deepgram.ts`.
- [ ] Function: `requireAuth`; `POST https://api.deepgram.com/v1/auth/grant` with `Authorization: Token ${DEEPGRAM_API_KEY}` body `{ttl_seconds:60}` → return `{access_token}` (if that endpoint is unavailable, fallback: `POST /v1/projects/{id}/keys` with `time_to_live_in_seconds:60` — check Deepgram docs via WebFetch; implementer verifies which is current).
- [ ] Engine: fetch token; `new WebSocket(`wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&interim_results=true&language=${lang}${vocab.map(k=>`&keyterm=${encodeURIComponent(k)}`).join('')}`, ['bearer', token])` (or `['token', key]` if using legacy keys); on open start `MediaRecorder` with `timeslice=250` and `ws.send(blob)`; on message parse JSON, `channel.alternatives[0].transcript`, `is_final` → onFinal else onInterim (skip empty). Send `{type:'KeepAlive'}` every 5 s. On close while not stopped → reconnect. Keyterm count capped at 50.
- [ ] Commit `feat: deepgram streaming engine`.

### Task 9: Playwright E2E
**Files:** `playwright.config.ts`, `tests/e2e/app.spec.ts`.
**Deps:** `npm i -D @playwright/test && npx playwright install chromium`.
- [ ] Config: `webServer: { command: 'npx netlify dev', url: 'http://localhost:8888', reuseExistingServer: true, timeout: 120000 }`, `use.baseURL`, mobile viewport `devices['iPhone 13']` but chromium.
- [ ] Spec: login with `process.env.APP_PASSWORD`; click +; in Text mode type `# Hello world` → expect `h1` text "Hello world"; wait for "Saved"; reload → h1 persists; route-intercept `**/api/refine` → `{text:'Nehemiah rebuilt the wall.'}`; use `window.__dictate.insertChunk('knee higher rebuilt the wall', 'body')` test hook exposed by DocPage when `import.meta.env.DEV`; expect refined text appears; delete doc via menu.
- [ ] Run with `.env` present; if Mongo not configured, mark test skipped with reason. Commit `test: playwright e2e`.

### Task 10: README + deploy notes
- [ ] `README.md`: setup (`cp .env.example .env`), `netlify dev`, tests, deploy (`netlify deploy --prod` or Git-connected site; set env vars in Netlify UI), iOS note: Web Speech requires Safari 14.5+, mic permission; add to Home Screen works.
- [ ] Commit `docs: readme`.
