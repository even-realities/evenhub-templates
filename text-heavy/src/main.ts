import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { paginate } from './paginate'
import { SAMPLE_TEXT } from './sample'

// Body container geometry. Inner box (width/height minus padding and border)
// is what pretext measures against, so keep these in sync if you resize.
const BODY_W = 576
const BODY_H = 240
const BODY_PAD = 4
const BODY_BORDER = 0
const INNER_W = BODY_W - 2 * (BODY_PAD + BODY_BORDER)
const INNER_H = BODY_H - 2 * (BODY_PAD + BODY_BORDER)

const pages = paginate(SAMPLE_TEXT, { width: INNER_W, height: INNER_H })
let currentPage = 0

const bridge = await waitForEvenAppBridge()

const body = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: BODY_W,
  height: BODY_H,
  borderWidth: BODY_BORDER,
  borderColor: 5,
  paddingLength: BODY_PAD,
  containerID: 1,
  containerName: 'body',
  content: pages[0] ?? '(empty)',
  isEventCapture: 1,
})

const pager = new TextContainerProperty({
  xPosition: 0,
  yPosition: 250,
  width: 576,
  height: 30,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 2,
  containerName: 'pager',
  content: pagerLabel(),
  isEventCapture: 0,
})

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({ containerTotalNum: 2, textObject: [body, pager] }),
)
if (created !== 0) console.error('createStartUpPageContainer failed:', created)

function pagerLabel() {
  return `${currentPage + 1} / ${pages.length}  ·  tap: next  ·  swipe up: prev  ·  double-tap: exit`
}

// Serialize bridge writes so a fast-tapping user can't queue overlapping upgrades.
let rendering: Promise<unknown> = Promise.resolve()
async function showPage(index: number) {
  if (index < 0 || index >= pages.length || index === currentPage) return
  currentPage = index
  rendering = rendering.then(async () => {
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'body',
        content: pages[index],
      }),
    )
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 2,
        containerName: 'pager',
        content: pagerLabel(),
      }),
    )
  })
  await rendering
  mirrorCompanion()
}

let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  unsubscribe()
}

// Reads the event type out of one envelope.
//
// CLICK_EVENT is 0, and protobuf omits zero-value fields on the wire, so a
// single tap arrives as an envelope whose `eventType` is `undefined`. The
// default has to be resolved INSIDE the envelope check. Writing
// `event.sysEvent?.eventType ?? OsEventTypeList.CLICK_EVENT` instead would
// read CLICK on events that carry no `sysEvent` at all, so every scroll,
// exit and audio frame would fire the tap handler.
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

// Event routing, critical details:
//   • Scroll gestures (SCROLL_TOP/SCROLL_BOTTOM) route through
//     `event.textEvent`. Taps/double-taps/lifecycle route through
//     `event.sysEvent`. Check each branch separately.
//   • Double-tap → `shutDownPageContainer(1)` is a root-level check: it
//     must fire no matter which envelope the event arrives in, so users
//     can always exit the app.
//   • Order matters: DOUBLE_CLICK and the scroll gestures carry explicit
//     non-zero type ids, so they must be matched before CLICK_EVENT, which
//     is the value an envelope falls back to when it carries no type at all.
const unsubscribe = bridge.onEvenHubEvent(event => {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)

  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    bridge.shutDownPageContainer(1)
    return
  }

  if (textType === OsEventTypeList.SCROLL_TOP_EVENT) {
    showPage(currentPage - 1).catch(err => console.error(err))
    return
  }
  if (textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    showPage(currentPage + 1).catch(err => console.error(err))
    return
  }

  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    showPage(currentPage + 1).catch(err => console.error(err))
    return
  }
  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    cleanup()
  }
})

window.addEventListener('beforeunload', cleanup)

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main style="margin:auto;padding:24px;max-width:680px;box-sizing:border-box;">
    <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h1 style="font-size:18px;font-weight:600;margin:0;">Text-Heavy Reader</h1>
      <span id="pageCount" style="font-size:12px;color:#919191;"></span>
    </header>
    <pre id="mirror" style="background:#2E2E2E;border:1px solid #3E3E3E;border-radius:12px;padding:20px;font-size:15px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:#E5E5E5;margin:0;"></pre>
    <footer style="font-size:12px;color:#7B7B7B;text-align:center;margin-top:16px;">
      Tap glasses: next page · swipe up: previous · double-tap: exit
    </footer>
  </main>
`

function mirrorCompanion() {
  const mirror = document.getElementById('mirror')
  const count = document.getElementById('pageCount')
  if (mirror) mirror.textContent = pages[currentPage] ?? ''
  if (count) count.textContent = `${currentPage + 1} / ${pages.length}`
}

mirrorCompanion()
