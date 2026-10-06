import { execFileSync } from "node:child_process"
import { desktopCapturer, nativeImage, screen, systemPreferences, type Display, type Rectangle } from "electron"

/**
 * A selection in **absolute screen coordinates**, in DIPs (the same units as
 * `screen.getCursorScreenPoint()` and `Display.bounds`). The overlay reports
 * `MouseEvent.screenX/screenY`, which are already in this space, so no
 * window-offset arithmetic is needed anywhere in the pipeline.
 */
export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CapturedRegion {
  png: Buffer
  width: number
  height: number
}

/**
 * Vision models resize on their side anyway, so doing it here cuts upload time
 * and token cost for free. The user's display is 2560x1600, where a half-screen
 * region is still ~1800x900 — comfortably over budget.
 */
const MAX_IMAGE_EDGE = 1568

export const MAX_CAPTURES_PER_HOLD = 5

/**
 * A click with no drag (or a stray twitch) should not produce a 1x1 image, so
 * anything under this is treated as "no selection".
 */
const MIN_SELECTION_PX = 8

export class ScreenCapturePermissionError extends Error {
  constructor() {
    super(
      "Screen Recording permission is not granted. Grant it in System Settings → " +
        "Privacy & Security → Screen Recording, then restart dummy.",
    )
    this.name = "ScreenCapturePermissionError"
  }
}

export class ScreenCaptureUnavailableError extends Error {
  constructor(detail: string) {
    super(`Could not capture that region of the screen: ${detail}`)
    this.name = "ScreenCaptureUnavailableError"
  }
}

/**
 * macOS gates `desktopCapturer` behind its own TCC permission, separate from the
 * microphone grant. Callers use this to skip capture *before* the user is
 * mid-dictation, so a missing capture permission never blocks the mic.
 */
/**
 * Last result of the live capture probe, if we have run one.
 *
 * `getMediaAccessStatus("screen")` reads TCC state, and TCC state is keyed on
 * the running code signature. Toggling Screen Recording while the app is open
 * does not always update what the live process sees, so the flag alone is not
 * trustworthy. The probe is the ground truth: it asks the OS for real sources.
 */
let probeResult: boolean | undefined

/**
 * The app bundle macOS actually blames for privacy prompts.
 *
 * TCC walks the process tree to find a "responsible process" and attributes
 * Screen Recording to it. An Electron app launched from `npm run dev` is a child
 * of the terminal, so the terminal is responsible — granting the permission to
 * "Electron" then has no effect whatsoever, because TCC never reads that row.
 * This is the single most common reason screen capture appears permanently
 * denied in development.
 */
export function responsibleProcess(): string {
  if (process.platform !== "darwin") return process.execPath
  const ps = (pid: number, flag: string): string => {
    try {
      return execFileSync("/bin/ps", ["-o", `${flag}=`, "-p", String(pid)], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()
    } catch {
      return ""
    }
  }
  let pid = process.pid
  for (let depth = 0; depth < 12 && pid > 1; depth += 1) {
    const comm = ps(pid, "comm")
    // The nearest ancestor that lives inside an .app bundle is the one Launch
    // Services would show in System Settings.
    if (/\.app\/Contents\/MacOS\//.test(comm)) return comm
    const parent = Number(ps(pid, "ppid"))
    if (!Number.isFinite(parent) || parent <= 1 || parent === pid) break
    pid = parent
  }
  return process.execPath
}

export function screenCaptureStatus(): string {
  if (process.platform !== "darwin") return "granted"
  return systemPreferences.getMediaAccessStatus("screen")
}

/**
 * Ask the OS whether we can actually capture. On macOS a denied app gets an
 * empty source list back rather than an error, which makes this a reliable
 * check — and unlike `getMediaAccessStatus` it reflects the live process.
 */
export async function probeScreenCapture(): Promise<boolean> {
  if (process.platform !== "darwin") return true
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      // Zero on both axes skips thumbnail generation, per the desktopCapturer
      // docs. A 1x1 thumbnail still makes Chromium pull screen pixels for every
      // display, which is the very operation Screen Recording gates — so the
      // probe was partly measuring the thing it was trying to test. We only
      // need to know whether sources can be enumerated, not what they look like.
      thumbnailSize: { width: 0, height: 0 },
    })
    return sources.length > 0
  } catch {
    return false
  }
}

export async function refreshScreenCapturePermission(): Promise<{
  granted: boolean
  status: string
  probed: boolean
}> {
  const status = screenCaptureStatus()
  if (status === "granted") {
    probeResult = true
    return { granted: true, status, probed: true }
  }
  // Only probe when TCC says no. Probing is what triggers the native prompt on
  // macOS 15+, so it is worth doing, but not on every single check.
  const probed = await probeScreenCapture()
  probeResult = probed
  return {
    granted: probed,
    status,
    probed: true,
  }
}

export function screenCaptureGranted(): boolean {
  if (process.platform !== "darwin") return true
  if (systemPreferences.getMediaAccessStatus("screen") === "granted") return true
  // A probe we already ran and that succeeded is stronger evidence than the
  // status flag, which can lag behind a permission granted mid-session.
  return probeResult === true
}

function displayById(displayId: number): Display {
  const display = screen.getAllDisplays().find((candidate) => candidate.id === displayId)
  if (!display) throw new ScreenCaptureUnavailableError(`display ${displayId} is gone`)
  return display
}

/**
 * Clamps one axis of a rect into `[min, max]`.
 *
 * Both endpoints are clamped independently and only then compared, which is what
 * makes the result correct for a drag made right-to-left (a negative width) and
 * for a selection that runs off the edge of the display. Clamping `x` and
 * `x + width` as though they were ordered would collapse every rect to zero
 * width the moment `width` was positive.
 */
function clampAxis(a: number, b: number, min: number, max: number) {
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  return {
    start: Math.max(min, Math.min(low, max)),
    end: Math.max(min, Math.min(high, max)),
  }
}

/** Clamps a rect to a box, and normalizes any negative width/height. */
function clampRect(rect: CaptureRect, box: Rectangle): Rectangle | null {
  const xs = clampAxis(rect.x, rect.x + rect.width, box.x, box.x + box.width)
  const ys = clampAxis(rect.y, rect.y + rect.height, box.y, box.y + box.height)

  const width = Math.round(xs.end - xs.start)
  const height = Math.round(ys.end - ys.start)
  if (width < MIN_SELECTION_PX || height < MIN_SELECTION_PX) return null

  return { x: Math.round(xs.start), y: Math.round(ys.start), width, height }
}

/**
 * Picks the capture source for a display.
 *
 * `DesktopSource.display_id` is documented as *"an empty string if not
 * available"*, so it cannot be the only strategy: a machine that omits it would
 * otherwise fail every capture. Falling back to "there is only one screen, so it
 * has to be this one" covers the common single-display case honestly, and a
 * genuinely ambiguous multi-display machine gets a clear error rather than a
 * screenshot of the wrong monitor.
 */
function pickSource(
  sources: Electron.DesktopCapturerSource[],
  display: Display,
): Electron.DesktopCapturerSource {
  const byDisplayId = sources.find((source) => source.display_id === String(display.id))
  if (byDisplayId) return byDisplayId

  const only = sources.length === 1 ? sources[0] : undefined
  if (only) return only

  const described = sources
    .map((source) => `${source.name} (display_id="${source.display_id}")`)
    .join(", ")
  throw new ScreenCaptureUnavailableError(
    `could not identify the display for capture. Sources: ${described || "none"}`,
  )
}

/**
 * Scales a long edge down to `MAX_IMAGE_EDGE`, leaving smaller images alone.
 *
 * Exported because the browser window produces images on a different path than
 * the screen capture, and both have to respect the same ceiling — an image
 * larger than this is what makes a request fail on some providers and merely
 * slow on others.
 */
export function downscale(png: Buffer): CapturedRegion {
  const image = nativeImage.createFromBuffer(png)
  const { width, height } = image.getSize()
  const longEdge = Math.max(width, height)
  if (longEdge <= MAX_IMAGE_EDGE) return { png, width, height }

  const scale = MAX_IMAGE_EDGE / longEdge
  return {
    png: image.resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      quality: "good",
    }).toPNG(),
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Screenshots one region of one display and returns PNG bytes capped at
 * `MAX_IMAGE_EDGE` on the long side.
 *
 * `overlay` is hidden by the caller *before* this runs, because a
 * `desktopCapturer` frame would otherwise contain the selection overlay itself.
 */
export async function captureRegion(
  displayId: number,
  rect: CaptureRect,
): Promise<CapturedRegion> {
  if (!screenCaptureGranted()) throw new ScreenCapturePermissionError()

  const display = displayById(displayId)
  const clamped = clampRect(rect, display.bounds)
  if (!clamped) throw new ScreenCaptureUnavailableError("the selection was too small")

  // Ask for the display's full pixel size rather than DIPs, otherwise a Retina
  // capture comes back at half the detail it should have.
  const { scaleFactor } = display
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(display.bounds.width * scaleFactor),
      height: Math.round(display.bounds.height * scaleFactor),
    },
    fetchWindowIcons: false,
  })

  if (sources.length === 0) throw new ScreenCapturePermissionError()
  const source = pickSource(sources, display)

  // macOS hands back an empty thumbnail instead of erroring when Screen
  // Recording has not been granted, so this is the permission check that
  // actually bites.
  if (source.thumbnail.isEmpty()) throw new ScreenCapturePermissionError()

  // Electron fits the requested thumbnail inside the requested box while
  // preserving aspect ratio, so the image may be smaller than asked for.
  // Deriving the scale from what we actually got is what keeps the crop aligned
  // on every display rather than assuming a 1:1 or 2:1 relationship.
  const image = source.thumbnail.getSize()
  const scaleX = image.width / display.bounds.width
  const scaleY = image.height / display.bounds.height

  // Clamped again in pixels: `scaleX`/`scaleY` are derived from what the OS
  // actually returned, and a rounding step at the edge can still push a crop one
  // pixel past the frame, which `crop()` rejects rather than clamping.
  const crop: Rectangle = {
    x: Math.min(Math.max(0, Math.round((clamped.x - display.bounds.x) * scaleX)), image.width - 1),
    y: Math.min(Math.max(0, Math.round((clamped.y - display.bounds.y) * scaleY)), image.height - 1),
    width: 0,
    height: 0,
  }
  crop.width = Math.max(1, Math.min(Math.round(clamped.width * scaleX), image.width - crop.x))
  crop.height = Math.max(1, Math.min(Math.round(clamped.height * scaleY), image.height - crop.y))

  return downscale(source.thumbnail.crop(crop).toPNG())
}
