#!/usr/bin/env bash
# One-time setup: prompt for API keys, generate app password + session secret,
# write .env, and push everything to the linked Netlify site.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] && { read -rp ".env exists. Overwrite? [y/N] " a; [[ $a == y* ]] || exit 1; }

read -rsp "ANTHROPIC_API_KEY: " ANTHROPIC_API_KEY; echo
read -rsp "OPENAI_API_KEY: " OPENAI_API_KEY; echo
read -rsp "DEEPGRAM_API_KEY: " DEEPGRAM_API_KEY; echo
read -rsp "MONGODB_URI: " MONGODB_URI; echo

APP_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
SESSION_SECRET=$(openssl rand -hex 32)

cat > .env <<ENV
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
OPENAI_API_KEY=$OPENAI_API_KEY
DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY
MONGODB_URI=$MONGODB_URI
APP_PASSWORD=$APP_PASSWORD
SESSION_SECRET=$SESSION_SECRET
ENV
chmod 600 .env
echo "Wrote .env"
echo
echo "Your login password (save it somewhere safe):"
echo "  $APP_PASSWORD"
echo

netlify status >/dev/null 2>&1 || netlify link
for k in ANTHROPIC_API_KEY OPENAI_API_KEY DEEPGRAM_API_KEY MONGODB_URI APP_PASSWORD SESSION_SECRET; do
  netlify env:set "$k" "${!k}" --secret >/dev/null && echo "netlify env: $k set"
done
