# image

Image rendering demo on G2. Shows `public/sample.png` in an `ImageContainerProperty`, with tap-to-reload and double-tap-to-exit wiring.

## Run

```bash
npm install
npm run dev
```

Then `npm run simulate` (desktop simulator) or `npx evenhub qr --url http://<your-ip>:5173` to test on real glasses.

## What's in here

| File | Purpose |
|---|---|
| `src/main.ts` | App entry. Creates a 200x100 image container, an event-capture text layer, a status line. Loads `public/sample.png`, reloads it on single tap, exits on double tap. |
| `src/image/renderer.ts` | Image pipeline helpers — `loadImageBytes` (fetches an image file; `main.ts` uses it) and `makeTestPattern` (zero-dependency gradient generator; not used by default). |
| `public/sample.png` | Sample image (288x144 PNG) that `main.ts` loads at startup and on each tap. |
| `index.html` | WebView host with zoom-locked viewport. |
| `app.json` | Manifest. No permissions needed — local rendering only. |

## Preprocessing is optional

G2 renders 4-bit greyscale (16 shades). You don't need to pre-dither or pre-grayscale anything:

- **Icons, line art, QR codes** → feed bytes straight in, the SDK handles it.
- **Photos and gradients** → may look muddy raw; contrast-boost or Floyd–Steinberg dithering sharpens mid-tones. Try naive first, reach for a dither pass only if needed.

The SDK returns `imageToGray4Failed` if its built-in conversion chokes on your bytes — that's your cue to preprocess.

## Swapping in a real asset

1. Drop an image into `public/` (e.g. `public/icon.png`).
2. In `main.ts`, replace:
   ```typescript
   const SAMPLE_URL = `${import.meta.env.BASE_URL}sample.png`
   ```
   with:
   ```typescript
   const SAMPLE_URL = `${import.meta.env.BASE_URL}icon.png`
   ```
3. If the SDK returns `imageToGray4Failed`, add a client-side conversion step (canvas `getImageData` + manual 4-bit packing, or server-side ImageMagick/Pillow pre-baking).

## G2 specifics

- Display: 576x288, 4-bit greyscale (16 shades of green).
- Image containers: 20–288 width, 20–144 height, max 4 per page.
- `updateImageRawData` calls must be **serial** — await each before the next. This template queues through a shared promise chain.
- Image containers can't capture events — use a full-screen text container as an event layer (see `main.ts`).
- BLE image transfer is slow (~0.5–2s per frame). Design turn-based, not animated.
- **Double-tap the temple** → `shutDownPageContainer(1)` → system exit confirmation.
