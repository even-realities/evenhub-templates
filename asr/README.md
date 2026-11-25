# asr

Live speech-to-text demo on G2. Mic audio → your chosen STT provider → transcript rendered on the glasses and mirrored in the companion WebView. Includes double-tap-to-exit wiring.

**The STT client itself is a blank stub.** This template has zero vendor code baked in. You pick your own provider (Deepgram, AssemblyAI, Whisper, Soniox, self-hosted, etc.) and wire it up in `src/asr/stt.ts`.

## Run

```bash
cp .env.example .env.local   # paste your STT provider's API key into VITE_STT_API_KEY
npm install
npm run dev
```

Then `npm run simulate` (desktop simulator) or `npx evenhub qr --url http://<your-ip>:5173` to test on real glasses.

**`VITE_STT_API_KEY` is for local development only.** Vite inlines its value into the built JavaScript in `dist/`, and `npm run pack` packs `dist/` into the `.ehpk`. Before you ship a build, move the key behind a server you control and call that server from `src/asr/stt.ts`. See [App submission](https://hub.evenrealities.com/docs/ship/app-submission).

## First-run expectation

Until you implement `src/asr/stt.ts`, the companion WebView shows a red error chip: *"STT provider not implemented — open src/asr/stt.ts and wire up your chosen STT service."* That's by design — the scaffold compiles and runs, but the STT handoff throws on startup so you know exactly where to go.

## What's in here

| File | Purpose |
|---|---|
| `src/main.ts` | App entry. Creates the transcript container, starts the mic, routes PCM chunks to `stt.ts`, renders snapshots with a 120ms debounce, handles double-tap exit. |
| `src/asr/stt.ts` | **Blank stub.** Provider-agnostic `SttClient` interface + `startSttStream()` function. Implement your STT provider here. |
| `src/ui.ts` | Companion-app UI — status chip, live transcript mirror, dark theme. |
| `index.html` | WebView host with zoom-locked viewport. |
| `app.json` | Manifest with `g2-microphone` permission. **No `network` permission by default** — add yours when you pick a provider. |
| `.env.example` | `VITE_STT_API_KEY=` placeholder for your provider's key. |

## Wiring your STT provider

1. Open `src/asr/stt.ts`. Replace the `throw` inside `startSttStream` with your provider's logic:
   - Connect to the provider (WebSocket for streaming, HTTP for batch).
   - Send the authentication / session-start message.
   - On each inbound transcript message, build a `SttSnapshot { finalText, interimText, finished }` and call `onSnapshot()`.
   - Implement `sendPcm(chunk)` to forward each mic chunk. The input is PCM s16le @ 16 kHz, mono — most providers accept this directly; resample if yours doesn't.
   - Implement `close()` to signal end-of-stream.

2. Paste your API key into `.env.local` as `VITE_STT_API_KEY=...`. This is for local development only (see the note under [Run](#run)).

3. Add a `network` permission to `app.json` with your provider's hosts:

   ```json
   { "name": "network", "desc": "Stream audio to STT.", "whitelist": ["https://api.yourprovider.com", "wss://stream.yourprovider.com"] }
   ```

   `evenhub pack` rejects an empty whitelist, which is why this entry isn't in `app.json` by default.

## G2 specifics

- Mic format: PCM s16le, 16 kHz, mono. Delivered via `event.audioEvent.audioPcm` as `Uint8Array`.
- Glasses render is debounced to 120 ms — the BLE queue can't keep up with per-token writes.
- Transcript is trimmed to the last 240 characters to fit the 576x288 text container at default font.
- **Double-tap the temple** → `shutDownPageContainer(1)` → system exit confirmation dialog.
