# Dictate

Mobile-first markdown dictation. Speak into a document; text lands as pending chunks, optionally cleaned up by Claude, and saves to MongoDB. Single-user, password-gated.

## Setup

```sh
npm install
cp .env.example .env   # fill in keys, or:
./scripts/setup-env.sh # prompts for keys, generates APP_PASSWORD + SESSION_SECRET, writes .env, pushes to Netlify
```

## Run

```sh
npx netlify dev        # http://localhost:8888 (Vite + functions)
```

## Tests

```sh
npm test               # vitest unit tests
npm run e2e            # Playwright; full flow needs APP_PASSWORD + MONGODB_URI in .env, otherwise it skips
```

First E2E run: `npx playwright install chromium`.

## Deploy

Connect the repo to Netlify (Git-connected), or `netlify deploy --prod`. Set env vars with the setup script or in the Netlify UI.

## Engines

- **Web Speech** (default): free, Chrome and Safari.
- **OpenAI gpt-4o-transcribe**: transcribes 8 s segments.
- **Deepgram nova-3**: streaming; keyterms are taken from the document.
- **Refine with Claude** toggle: Haiku cleans each chunk using the document as context.

## iOS

- Web Speech needs Safari 14.5+ and microphone permission.
- HTTPS is required for the mic and `crypto.randomUUID` (localhost is exempt).
- Add to Home Screen works.
