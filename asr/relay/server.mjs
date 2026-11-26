// Minimal speech-to-text relay for the asr template. Node 18+, no dependencies.
//
// The glasses app POSTs a WAV segment to /transcribe. This server forwards it
// to any OpenAI-compatible `/audio/transcriptions` endpoint and returns
// `{ "text": "..." }`. The provider key lives only here, never in the app.
//
//   STT_BASE_URL    e.g. https://api.groq.com/openai/v1, https://api.openai.com/v1,
//                   or a self-hosted whisper server that speaks the same API
//   STT_MODEL       e.g. whisper-large-v3-turbo (Groq), whisper-1 (OpenAI)
//   STT_API_KEY     provider key (omit for an unauthenticated local server)
//   ALLOWED_ORIGIN  origin allowed by CORS (default "*"; set it in production)
//   PORT            default 8787
//
// Run: STT_BASE_URL=... STT_MODEL=... STT_API_KEY=... node relay/server.mjs

import { createServer } from 'node:http'

const BASE = (process.env.STT_BASE_URL || '').replace(/\/+$/, '')
const MODEL = process.env.STT_MODEL || ''
const KEY = process.env.STT_API_KEY || ''
const ORIGIN = process.env.ALLOWED_ORIGIN || '*'
const PORT = Number(process.env.PORT || 8787)
const MAX_BYTES = 5 * 1024 * 1024 // ~2.7 minutes of 16 kHz mono PCM

if (!BASE || !MODEL) {
  console.error('Set STT_BASE_URL and STT_MODEL (see the comment at the top of this file).')
  process.exit(1)
}

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...cors })
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    return res.end()
  }
  if (req.method !== 'POST' || req.url !== '/transcribe') return send(res, 404, { error: 'not found' })

  const parts = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BYTES) return send(res, 413, { error: 'audio too large' })
    parts.push(chunk)
  }
  const wav = Buffer.concat(parts)
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF') return send(res, 400, { error: 'expected a WAV body' })

  const form = new FormData()
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav')
  form.append('model', MODEL)
  form.append('response_format', 'json')

  try {
    const upstream = await fetch(`${BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: KEY ? { Authorization: `Bearer ${KEY}` } : {},
      body: form,
    })
    if (!upstream.ok) return send(res, 502, { error: `provider returned ${upstream.status}` })
    const data = await upstream.json()
    return send(res, 200, { text: typeof data.text === 'string' ? data.text : '' })
  } catch {
    return send(res, 502, { error: 'provider unreachable' })
  }
}).listen(PORT, () => console.log(`STT relay on http://localhost:${PORT}/transcribe`))
