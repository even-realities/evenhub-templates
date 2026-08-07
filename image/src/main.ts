import {
  waitForEvenAppBridge,
  TextContainerProperty,
  ImageContainerProperty,
  ImageRawDataUpdate,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { loadImageBytes } from './image/renderer'

const SAMPLE_URL = `${import.meta.env.BASE_URL}sample.png`

const bridge = await waitForEvenAppBridge()

// Event-capture text container sits behind the image and catches taps.
// Image containers can't set `isEventCapture`, so input needs a text layer.
const eventLayer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 0,
  paddingLength: 0,
  containerID: 1,
  containerName: 'eventLayer',
  content: ' ',
  isEventCapture: 1,
})

const statusLine = new TextContainerProperty({
  xPosition: 0,
  yPosition: 220,
  width: 576,
  height: 40,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 2,
  containerName: 'status',
  content: 'Loading…',
  isEventCapture: 0,
})

const IMG_W = 200
const IMG_H = 100
const image = new ImageContainerProperty({
  xPosition: (576 - IMG_W) / 2,
  yPosition: 40,
  width: IMG_W,
  height: IMG_H,
  containerID: 3,
  containerName: 'frame',
})

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [eventLayer, statusLine],
    imageObject: [image],
  }),
)
if (created !== 0) {
  console.error('createStartUpPageContainer failed:', created)
}

async function setStatus(text: string) {
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 2,
      containerName: 'status',
      content: text,
    }),
  )
}

// updateImageRawData must be serial — one in flight at a time.
let rendering: Promise<unknown> = Promise.resolve()
async function pushFrame(bytes: Uint8Array) {
  rendering = rendering.then(async () => {
    const result = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: 3,
        containerName: 'frame',
        imageData: bytes,
      }),
    )
    if (result !== 'success') {
      await setStatus(`Render: ${result}`)
      console.error('updateImageRawData:', result)
    }
  })
  await rendering
}

try {
  const bytes = await loadImageBytes(SAMPLE_URL)
  await pushFrame(bytes)
  await setStatus('Tap to reload · double-tap to exit')
} catch (err) {
  console.error(err)
  await setStatus(`Load failed: ${err instanceof Error ? err.message : String(err)}`)
}

let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  unsubscribe()
}

// Event routing, critical details:
//   • Protobuf omits zero-value fields on the wire, so CLICK_EVENT (0)
//     arrives as `undefined`. Always coalesce with `?? 0` before comparing.
//   • Taps/double-taps/lifecycle come through `event.sysEvent`.
//     Scroll gestures come through `event.textEvent`. Never mix them.
//   • Double-tap → `shutDownPageContainer(1)` is a root-level check: it
//     must fire no matter which envelope the event arrives in, so users
//     can always exit the app.
const unsubscribe = bridge.onEvenHubEvent(event => {
  // Coalesce to 0 only when the envelope itself is present: CLICK_EVENT (0)
  // is omitted on the wire, but a MISSING envelope must stay null — `?? 0`
  // on the optional chain would turn every non-sys event into a phantom tap.
  const sysType = event.sysEvent ? (event.sysEvent.eventType ?? 0) : null
  const textType = event.textEvent ? (event.textEvent.eventType ?? 0) : null

  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    bridge.shutDownPageContainer(1)
    return
  }

  if (sysType === OsEventTypeList.CLICK_EVENT) {
    loadImageBytes(SAMPLE_URL)
      .then(pushFrame)
      .catch(err => console.error(err))
    return
  }

  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    cleanup()
  }
})

window.addEventListener('beforeunload', cleanup)

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main style="margin:auto;padding:24px;max-width:640px;text-align:center;">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">Image Demo</h1>
    <p style="color:#919191;font-size:14px;margin:0;">
      Check the glasses — <code>public/sample.png</code> should render.
      Tap to reload, double-tap to exit. Drop a new PNG/JPG into
      <code>public/</code> and point <code>SAMPLE_URL</code> at it.
    </p>
  </main>
`
