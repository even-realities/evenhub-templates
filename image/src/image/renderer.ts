// Image pipeline for the G2 display.
//
// The G2 panel is 576x288, 4-bit greyscale (16 shades of green on black).
// `bridge.updateImageRawData` accepts a `Uint8Array` of *encoded* image
// bytes (PNG / JPEG / etc.) — the SDK decodes, resizes and converts to
// 4-bit greyscale internally. If that conversion fails it returns
// `imageToGray4Failed`.
//
// ─────────────────────────────────────────────────────────────────────
// preprocessing is optional
// ─────────────────────────────────────────────────────────────────────
// You don't *need* to pre-grayscale or dither anything. For photos you'll
// usually get better results by pre-processing (contrast boost + Floyd–
// Steinberg dithering sharpens mid-tones on a 16-shade display), but line
// art, icons, and QR codes render fine raw. Try the naive path first; only
// add a dither pass if the output looks muddy on glass.
// ─────────────────────────────────────────────────────────────────────

// Generates a diagonal-gradient PNG without any bundled asset. Not used by
// default: main.ts loads `public/sample.png` through `loadImageBytes()`
// below. Call this instead if you want a generated test image.
export async function makeTestPattern(width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#000000')
  gradient.addColorStop(0.5, '#888888')
  gradient.addColorStop(1, '#ffffff')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('G2', width / 2, height / 2)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

// Reference path for loading a real asset. Drop an image into `public/`,
// fetch it here, and feed the bytes into `bridge.updateImageRawData`.
// The SDK handles decode + greyscale conversion; if it returns
// `imageToGray4Failed`, pre-process client-side (canvas + manual pack).
export async function loadImageBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${res.statusText}`)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}
