# evenhub-templates

Starter templates for [Even Realities G2](https://www.evenrealities.com/) smart glasses apps.

Four fully working scaffolds you can clone and run:

| Template | What it shows |
|---|---|
| [`minimal/`](./minimal) | Bare base: Vite + TypeScript + Even Hub SDK + simulator. Tap counts, double-tap exits. |
| [`asr/`](./asr) | Live mic → speech-to-text pipeline with companion UI. Tap pauses capture, double-tap exits. STT provider is a blank stub — plug in your own. |
| [`image/`](./image) | Image container rendering, tap to reload. Preprocessing/dithering is optional; the SDK handles grayscale conversion. |
| [`text-heavy/`](./text-heavy) | Long-form text with tap-to-advance pagination. Demonstrates the 2000-char `textContainerUpgrade` path. |

## Get a template

Using [`degit`](https://github.com/Rich-Harris/degit) (recommended — no git history, fast):

```bash
npx degit even-realities/evenhub-templates/minimal my-app
cd my-app
npm install
npm run dev
```

Substitute `minimal` with `asr`, `image`, or `text-heavy` for the other templates.

Or clone the whole repo and copy the folder you want:

```bash
git clone https://github.com/even-realities/evenhub-templates.git
cp -r evenhub-templates/asr my-app
cd my-app && npm install
```

## Prerequisites

- Node.js v18+
- The Even Hub companion app installed on a phone, or the `evenhub-simulator` on desktop
- (ASR template only) An STT provider of your choice — Deepgram, AssemblyAI, Whisper, Soniox, self-hosted, etc.

## Test on real glasses

```bash
npm run dev
npx evenhub qr --url http://<your-ip>:5173
```

Scan the QR code with the Even Hub companion app on a phone paired with your G2.

## Test in the simulator

```bash
npm run dev
npx evenhub-simulator http://localhost:5173
```

## Pack for distribution

```bash
npx evenhub pack
```

Produces an `.ehpk` you can upload through the Even Hub dev portal.

## Handling input

Read this before writing your own event handler — it is the single easiest thing
to get wrong.

`OsEventTypeList.CLICK_EVENT` is `0`, and protobuf omits zero-value fields on the
wire. A single tap therefore arrives as an envelope with **no `eventType` field
at all**:

```jsonc
// what a single tap actually looks like
{ "sysEvent": { "eventSource": 1 } }        // note: no eventType
// vs. a double-tap, which carries a non-zero id
{ "sysEvent": { "eventType": 3, "eventSource": 1 } }
```

So `event.sysEvent?.eventType` is `undefined` on a tap, and comparing it to
`CLICK_EVENT` fails. Resolve the default **inside** the envelope check:

```ts
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

const sysType = eventTypeOf(event.sysEvent)
const textType = eventTypeOf(event.textEvent)
```

Do **not** flatten it to `event.sysEvent?.eventType ?? OsEventTypeList.CLICK_EVENT`.
That reads `CLICK_EVENT` on events that carry no `sysEvent` at all, so every
scroll, lifecycle event and audio frame fires your tap handler.

Two more rules that follow from this:

- Match the explicit ids first. `DOUBLE_CLICK_EVENT` (3), `SCROLL_TOP_EVENT` (1)
  and `SCROLL_BOTTOM_EVENT` (2) carry real values; `CLICK_EVENT` is the fallback
  an envelope lands on when it carries no type, so it must be checked last.
- Taps, double-taps and lifecycle events arrive on `sysEvent`; scroll gestures
  arrive on `textEvent`; PCM arrives on `audioEvent`. Check each separately.

All four templates implement this pattern — copy the handler from
[`minimal/src/main.ts`](./minimal/src/main.ts).

## Hardware quick reference

| Property | Value |
|---|---|
| Display | 576 x 288 px, 4-bit greyscale (16 shades of green) |
| Microphone | On the glasses, PCM s16le @ 16 kHz mono |
| Camera | None |
| Speaker | None |
| Input | Touchpad on the temple, optional R1 ring |

## Resources

- [Even Hub Docs](https://hub.evenrealities.com/docs/getting-started/overview)
- [Even Hub SDK (npm)](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [Even Hub CLI (npm)](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
- [Simulator (npm)](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Community Discord](https://discord.gg/Y4jHMCU4sv)

## License

MIT
