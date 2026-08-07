import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()

const mainText = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: 'Hello from G2!\nDouble-tap to exit.',
  isEventCapture: 1,
})

const result = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [mainText],
  }),
)

console.log('Page created:', result === 0 ? 'success' : `failed (${result})`)

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

  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    unsubscribe()
  }
})
