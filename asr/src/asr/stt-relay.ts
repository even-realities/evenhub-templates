// Speech-to-text through your own relay server (no API key in the app bundle).
//
// Anything in a `VITE_*` variable is compiled into the bundle, and an `.ehpk`
// is a zip anyone can unpack. Putting a provider key in `VITE_STT_API_KEY`
// ships that key to every user. This client sends audio to a relay you run
// (see `asr/relay/`), and the relay holds the provider key server-side.
//
// It is a batch client: PCM is collected into short WAV segments and each
// segment is POSTed to `${relayUrl}/transcribe`. Each response is appended to
// `finalText`. `interimText` stays empty. Good for dictation and commands;
// for word-by-word live captions, use a streaming provider instead.
//
// Remember to add your relay's origin to the `network` whitelist in app.json.

import type { SttClient, SttSnapshot } from './stt'

const SAMPLE_RATE = 16000 // G2 mic: PCM s16le, 16 kHz, mono
const BYTES_PER_SECOND = SAMPLE_RATE * 2

export interface RelayOptions {
  /** Seconds of audio per request. Default 3. */
  segmentSeconds?: number
}

/** Wrap raw PCM s16le mono 16 kHz in a 44-byte RIFF/WAVE header. */
export function pcmToWav(pcm: Uint8Array): Uint8Array {
  const out = new Uint8Array(44 + pcm.length)
  const view = new DataView(out.buffer)
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) out[offset + i] = text.charCodeAt(i)
  }
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, BYTES_PER_SECOND, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(36, 'data')
  view.setUint32(40, pcm.length, true)
  out.set(pcm, 44)
  return out
}

export function startRelaySttStream(
  relayUrl: string,
  onSnapshot: (snap: SttSnapshot) => void,
  onError?: (err: unknown) => void,
  options: RelayOptions = {},
): SttClient {
  const segmentBytes = Math.round((options.segmentSeconds ?? 3) * BYTES_PER_SECOND)
  const endpoint = relayUrl.replace(/\/+$/, '') + '/transcribe'
  let chunks: Uint8Array[] = []
  let buffered = 0
  let finalText = ''
  let closed = false
  // Requests are chained so transcripts are appended in order.
  let queue: Promise<void> = Promise.resolve()

  const flush = (finished: boolean) => {
    const pcm = new Uint8Array(buffered)
    let offset = 0
    for (const c of chunks) {
      pcm.set(c, offset)
      offset += c.length
    }
    chunks = []
    buffered = 0

    queue = queue.then(async () => {
      if (pcm.length > 0) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'audio/wav' },
            // pcmToWav allocates an exact-size buffer, so .buffer is the whole WAV
            body: pcmToWav(pcm).buffer as ArrayBuffer,
          })
          if (!res.ok) throw new Error(`relay returned ${res.status}`)
          const { text } = (await res.json()) as { text?: string }
          const t = text?.trim()
          if (t) finalText = finalText ? `${finalText} ${t}` : t
        } catch (err) {
          onError?.(err)
        }
      }
      onSnapshot({ finalText, interimText: '', finished })
    })
  }

  return {
    sendPcm(chunk: Uint8Array) {
      if (closed) return
      chunks.push(chunk)
      buffered += chunk.length
      if (buffered >= segmentBytes) flush(false)
    },
    close() {
      if (closed) return
      closed = true
      flush(true)
    },
  }
}
