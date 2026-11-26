# STT relay (keep your provider key out of the app)

Anything in a `VITE_*` variable is compiled into the bundle, and an `.ehpk` can be unpacked by anyone. If you put a provider key in `VITE_STT_API_KEY` and ship the app, every user gets your key.

This folder is an optional alternative: a small relay you run, which holds the key and forwards audio to any OpenAI-compatible `/audio/transcriptions` endpoint. The default `src/asr/stt.ts` stub is unchanged; nothing here picks a vendor for you.

## 1. Run the relay

Node 18 or newer, no dependencies:

```bash
# Groq
STT_BASE_URL=https://api.groq.com/openai/v1 STT_MODEL=whisper-large-v3-turbo STT_API_KEY=... node relay/server.mjs

# OpenAI
STT_BASE_URL=https://api.openai.com/v1 STT_MODEL=whisper-1 STT_API_KEY=... node relay/server.mjs

# Any self-hosted server that speaks the same API (no key)
STT_BASE_URL=http://localhost:8080/v1 STT_MODEL=whisper node relay/server.mjs
```

Set `ALLOWED_ORIGIN` to restrict CORS in production. Deploy it anywhere that serves HTTPS.

## 2. Point the app at it

In `.env.local`:

```bash
VITE_STT_RELAY_URL=http://localhost:8787   # your relay, not a key
```

`src/main.ts` uses the relay client (`src/asr/stt-relay.ts`) when `VITE_STT_RELAY_URL` is set, and falls back to the default `src/asr/stt.ts` otherwise.

## 3. Whitelist the relay

Add a `network` permission to `app.json` with your relay's origin, for example:

```json
{ "name": "network", "desc": "Sends microphone audio to our speech-to-text relay.", "whitelist": ["https://stt.example.com"] }
```

## How it behaves

- Audio is sent in ~3-second WAV segments (PCM s16le, 16 kHz, mono with a standard 44-byte header), one request at a time, in order.
- Each segment's text is appended to `finalText`; `interimText` stays empty. This suits dictation and commands; for word-by-word live captions, use a streaming provider in `stt.ts` instead.
- The relay rejects bodies that are not WAV or are larger than 5 MB, and returns `{ "text": "" }`-shaped JSON or an `{ "error": ... }` with a 4xx/5xx status.
