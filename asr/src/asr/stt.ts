// Speech-to-text client for the G2 microphone.
//
// The G2 mic emits PCM s16le @ 16 kHz, mono via `bridge.audioControl(true)`.
// Each onEvenHubEvent callback with `audioEvent.audioPcm` delivers a chunk.
//
// ─────────────────────────────────────────────────────────────────────
// choose your own implementation here
// ─────────────────────────────────────────────────────────────────────
// Pick whichever STT provider you prefer — streaming or batch, hosted
// or self-hosted — and implement the three functions below. The rest
// of the scaffold (main.ts, ui.ts) already wires the mic into
// `sendPcm` and renders whatever `onSnapshot` emits.
//
// Treat each snapshot as a full transcript state, not a delta:
//   - finalText: text the provider is confident about
//   - interimText: unstable tail that may still change
//   - finished: true on the terminal message, after which no more
//     snapshots will be emitted
//
// Don't forget to add a `network` permission to app.json with your
// provider's hosts in the `whitelist` array once you wire this up.
// The default app.json omits the `network` entry because there are no
// provider hosts to list yet. Per the Even Hub networking docs, requests
// to hosts that are not in the whitelist are blocked.
// ─────────────────────────────────────────────────────────────────────

export interface SttSnapshot {
  finalText: string
  interimText: string
  finished: boolean
}

export interface SttClient {
  sendPcm(chunk: Uint8Array): void
  close(): void
}

export function startSttStream(
  _apiKey: string,
  _onSnapshot: (snap: SttSnapshot) => void,
  _onError?: (err: unknown) => void,
): SttClient {
  throw new Error(
    'STT provider not implemented — open src/asr/stt.ts and wire up your chosen STT service.',
  )
}
