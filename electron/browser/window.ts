/**
 * Owns the embedded browser view and the CDP session driving it.
 *
 * The page lives in a `WebContentsView` laid over the chat window rather than in
 * a window of its own, so browsing is a panel the user can collapse and come
 * back to. The renderer owns where that panel sits and sends its rectangle; this
 * module owns the page inside it.
 *
 * Deliberately a **singleton**: there is exactly one browser, ever. Two chat
 * sessions racing on one page would invalidate each other's element refs — a
 * click computed against a stale box lands on whatever moved into that space.
 * Every operation therefore runs through a mutex.
 *
 * Isolation, which is the reason this is an embedded browser rather than the
 * user's real Chrome:
 *   - its own `persist:dummy-browser` partition, so logins are per-app
 *   - `contextIsolation`, `sandbox`, no `nodeIntegration`, **no preload**
 *   - non-http(s) schemes are blocked, or a model-supplied URL could read
 *     local files via `file://`
 *   - permissions are denied rather than prompted, so a page cannot ask for the
 *     camera and the user is not trained to click "Allow" on our behalf
 *   - no preload, so the page has no bridge into the app or its renderer
 *
 * The cost is one login per site. The benefit is that a mis-click by the model
 * cannot touch a real signed-in profile.
 */
import { BrowserWindow, WebContentsView, app, session as electronSession, type Rectangle } from "electron"
import { writeFile } from "node:fs/promises"
import path from "node:path"

import { CdpSession, type PageInfo, type ReadResult, type Snapshot } from "./cdp.js"

const PARTITION = "persist:dummy-browser"

/**
 * Only web pages are loadable. Blocks `file:`, `javascript:`, `data:`, and friends.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

/**
 * The one `about:` URL that is allowed, because it is how a page is evicted from
 * memory rather than content the model can reach.
 *
 * Spelling out the exact URL matters: `about:` as a *protocol* would also admit
 * `about:srcdoc`, which carries markup the model controls and is therefore a way
 * to smuggle content past the http/https restriction.
 */
const ALLOWED_ABOUT_URL = "about:blank"

export type BrowserUnavailableReason = "no-window" | "no-page"

export class BrowserNotReadyError extends Error {
  constructor(public readonly reason: BrowserUnavailableReason) {
    super(reason === "no-window" ? "The browser page is not open yet" : "No page is loaded in the browser")
    this.name = "BrowserNotReadyError"
  }
}

export interface BrowserStatus {
  page: PageInfo | null
  open: boolean
}

/**
 * Serializes work so two tool calls never interleave on the page.
 *
 * A plain promise chain rather than a lock library: the critical sections are
 * short CDP calls, and ordering is all that is needed.
 */
class Mutex {
  #tail: Promise<unknown> = Promise.resolve()

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(fn)
    this.#tail = result.catch(() => undefined)
    return result
  }
}

let view: WebContentsView | null = null
/** The window the view is currently parented into, if any. */
let hostedBy: BrowserWindow | null = null
/** Where the renderer says the panel is, in the host window's DIPs. */
let bounds: Rectangle | null = null
/** What the user asked for, independent of whether we can honour it yet. */
let wantedVisible = false
let cdp: CdpSession | null = null
/**
 * Resolves once the view holds its first document.
 *
 * `debugger.attach` on a view with no document loaded never settles — it does
 * not reject, it just hangs — so the very first CDP call after startup would
 * wait forever. Giving the view a document immediately removes that state.
 */
let viewReady: Promise<void> = Promise.resolve()
const mutex = new Mutex()

let statusListener: ((status: BrowserStatus) => void) | null = null

export function setStatusListener(listener: ((status: BrowserStatus) => void) | null) {
  statusListener = listener
}

function emitStatus(page: PageInfo | null) {
  statusListener?.({ page, open: isOpen() })
}

export function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return ALLOWED_PROTOCOLS.has(url.protocol) || url.href === ALLOWED_ABOUT_URL
  } catch {
    return false
  }
}

/**
 * Parents the view into `host`, or detaches it when `host` is null.
 *
 * The chat window is the host, so this has to survive that window closing and a
 * new one opening: the page keeps its logins in the partition either way.
 */
export function setHostWindow(host: BrowserWindow | null): void {
  if (hostedBy && hostedBy === host) return
  const previous = hostedBy
  if (previous && !previous.isDestroyed() && view) {
    previous.contentView.removeChildView(view)
  }
  hostedBy = host && !host.isDestroyed() ? host : null
  if (hostedBy && view) attach()
}

/** Adds the view to the host window and applies whatever state we already have. */
function attach() {
  if (!hostedBy || !view) return
  hostedBy.contentView.addChildView(view)
  view.setBounds(bounds ?? { x: 0, y: 0, width: 0, height: 0 })
  // A panel that has never been placed has no rectangle to occupy, so it starts
  // hidden even if the user asked for it; `setBounds` reveals it.
  view.setVisible(wantedVisible && bounds !== null)
}

/**
 * Moves and resizes the embedded page to match the renderer's panel.
 *
 * `null` means the panel is collapsed: the view is hidden but *not* torn down,
 * which is the whole point of a collapsible panel — the page keeps running and
 * the user comes back to it exactly where they left off.
 */
export function setBounds(next: Rectangle | null): void {
  bounds = next
  if (!next) {
    view?.setVisible(false)
    return
  }
  const target = ensureView()
  if (!hostedBy) return
  if (!hostedBy.contentView.children.includes(target)) attach()
  target.setBounds(next)
  target.setVisible(wantedVisible)
}

/** Shows the page in the panel, once the panel has a place to be shown in. */
export function show() {
  wantedVisible = true
  if (!bounds) return
  const target = ensureView()
  if (hostedBy && !hostedBy.contentView.children.includes(target)) attach()
  target.setVisible(true)
}

/** Hides the page without unloading it. Backs the collapsed panel. */
export function hide() {
  wantedVisible = false
  view?.setVisible(false)
}

/**
 * Closes the browser: hides the page and unloads the document.
 *
 * The view itself is kept, because tearing it down and building another on the
 * next navigate is churn for no gain — an idle `about:blank` view costs
 * nothing, and logins live in the partition either way. `about:blank` also
 * releases the page's memory, so this is the same eviction the idle timer does.
 */
export function close() {
  wantedVisible = false
  const target = view
  if (!target) return
  bounds = null
  target.setVisible(false)
  refs.clear()
  void target.webContents.loadURL(ALLOWED_ABOUT_URL).catch(() => undefined)
  emitStatus(null)
}

/**
 * Creates the view if needed. One view for the app's life — recreating per turn
 * would leak renderers, and on 8 GB that is expensive.
 */
/**
 * Drops a view whose contents Electron has already torn down.
 *
 * The view object outlives its renderer in a couple of cases — closing another
 * window in the app while the panel is up has been observed to take the page
 * with it — and `view.webContents` then reads back as null. Left alone, that
 * surfaces as a bare `TypeError` from deep inside a click handler instead of
 * the typed not-ready error the renderer knows how to report.
 */
function dropDeadView(): void {
  if (!view) return
  if (view.webContents && !view.webContents.isDestroyed()) return
  cdp?.detach()
  cdp = null
  view = null
  emitStatus(null)
}

function ensureView(): WebContentsView {
  dropDeadView()
  if (view) return view

  const browserSession = electronSession.fromPartition(PARTITION)

  // Every capability gets a flat no. Written as an unconditional `false` rather
  // than an allowlist test so a capability Electron adds later is denied by
  // default — an unknown permission is not one we have decided is safe.
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false)
  })
  browserSession.setPermissionCheckHandler(() => false)

  view = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // No preload: the page gets no bridge into the app at all.
      webSecurity: true,
      // Load-bearing. A view that is hidden or behind the panel counts as
      // occluded, and Chromium throttles timers and rendering in occluded
      // pages — which turned every wait into seconds and made clicks land on a
      // page that had not finished loading. The model drives this page while
      // the user reads the transcript, so it must keep running.
      backgroundThrottling: false,
    },
  })
  view.setVisible(false)

  // A popup becomes a navigation in this view instead of a second window:
  // the model asked to go somewhere, and it needs to see the result on the page
  // its next snapshot will describe. Opening it externally would leave the
  // browser showing the pre-popup page while the answer lives somewhere the
  // model cannot read.
  const browser = view
  browser.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedUrl(url)) return { action: "deny" }
    void browser.webContents.loadURL(url).catch(() => {})
    return { action: "deny" }
  })

  browser.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedUrl(url)) event.preventDefault()
  })

  // Any document change invalidates every ref: they are only valid for the
  // document they were captured from.
  const invalidateRefs = () => refs.clear()
  browser.webContents.on("did-navigate", () => {
    invalidateRefs()
    emitStatus(currentPage())
  })
  browser.webContents.on("did-navigate-in-page", () => {
    invalidateRefs()
    emitStatus(currentPage())
  })
  browser.webContents.on("page-title-updated", () => emitStatus(currentPage()))
  browser.webContents.on("destroyed", () => {
    cdp?.detach()
    cdp = null
    if (view === browser) view = null
    emitStatus(null)
  })

  // Give it a document up front: `debugger.attach` hangs forever otherwise, and
  // the view is created on the sidebar click that precedes the first tool call,
  // so without this the first `browser_navigate` would never return.
  // A failure here is not fatal — `open()` loads a real page right after.
  viewReady = browser
    .webContents.loadURL(ALLOWED_ABOUT_URL)
    .then(() => undefined)
    .catch(() => undefined)

  if (hostedBy) attach()

  return view
}

/** The page the user is looking at, or null for a blank/absent view. */
function currentPage(): PageInfo | null {
  if (!view) return null
  const url = view.webContents.getURL()
  if (!url || url === ALLOWED_ABOUT_URL) return null
  return { url, title: view.webContents.getTitle() }
}

/** Attached session for the current view, throwing a typed error if there is none. */
async function activeSession(): Promise<CdpSession> {
  dropDeadView()
  if (!view) throw new BrowserNotReadyError("no-window")
  await viewReady
  if (!cdp || cdp.destroyed || !cdp.attached) cdp = new CdpSession(view.webContents)
  await cdp.attach()
  return cdp
}

function requirePage(): PageInfo {
  const page = currentPage()
  if (!page) throw new BrowserNotReadyError("no-page")
  return page
}

/**
 * Refs from the most recent snapshot, keyed to the page they came from.
 *
 * Storing them per-document is what makes a stale click impossible: any
 * navigation drops the map, so a `ref` from the previous page resolves to
 * nothing rather than to whatever now occupies those coordinates.
 */
const refs = {
  map: new Map<number, number>(),

  record(snapshot: Snapshot) {
    this.map.clear()
    for (const node of snapshot.nodes) {
      if (typeof node.backendNodeId === "number") this.map.set(node.ref, node.backendNodeId)
    }
  },

  resolve(ref: number): number {
    const backendNodeId = this.map.get(ref)
    if (!backendNodeId) {
      throw new Error(
        `No element ${ref} in the current snapshot. Take a fresh snapshot first — refs are invalidated by navigation.`,
      )
    }
    return backendNodeId
  },

  clear() {
    this.map.clear()
  },
}

/** Waits for the document to settle, up to the session's budget. */
async function settle(session: CdpSession, timeoutMs = 10_000) {
  await session.waitFor(async () => {
    const ready = await session.evaluate<string>("document.readyState")
    return ready === "complete" || ready === "interactive"
  }, timeoutMs)
}

/**
 * Waits for a navigation that an action kicked off — and only if it started one.
 *
 * Most clicks and typed submissions do not navigate: they open a menu, expand a
 * panel, submit an XHR. Waiting out the full navigation budget for those means
 * paying seconds per call for a wait that was never going to succeed, and a
 * model working through a form pays it on every keystroke-submit.
 *
 * So: give the action a short grace period to start a navigation, and return as
 * soon as it is clear none is coming. When one *is* coming, it then gets the full
 * budget, because a real navigation must be waited out before the page can be
 * read.
 */
const NAVIGATION_GRACE_MS = 300

async function settleAfterAction(session: CdpSession, beforeUrl: string): Promise<void> {
  if (!view) return
  const contents = view.webContents
  let started = false
  const onStart = () => {
    started = true
  }
  // `did-start-navigation` covers real document loads; `did-navigate-in-page`
  // covers SPA route changes, which do not change the document but do change the
  // URL and the visible content.
  contents.on("did-start-navigation", onStart)
  contents.on("did-navigate-in-page", onStart)

  try {
    const navigated = await session.waitFor(
      async () => started || (await session.pageInfo()).url !== beforeUrl,
      NAVIGATION_GRACE_MS,
      50,
    )
    if (!navigated) return
    await session.waitFor(async () => (await session.pageInfo()).url !== beforeUrl, 10_000)
    await settle(session)
  } finally {
    contents.off("did-start-navigation", onStart)
    contents.off("did-navigate-in-page", onStart)
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/** Navigates and reveals the panel. Backs `browser_navigate`. */
export async function open(rawUrl: string): Promise<PageInfo> {
  let url: string
  try {
    const parsed = new URL(rawUrl)
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) throw new Error("bad protocol")
    url = parsed.toString()
  } catch {
    throw new Error(`Cannot open "${rawUrl}" — only http and https addresses are allowed`)
  }

  const target = ensureView()
  const session = await activeSession()
  refs.clear()
  await target.webContents.loadURL(url)
  await settle(session)
  // The model just opened something, so the panel is revealed rather than left
  // hiding it. `show()` is a no-op while the user has it collapsed and no
  // rectangle has arrived yet, so it never fights the UI.
  show()
  return requirePage()
}

export function pageInfo(): PageInfo {
  return requirePage()
}

export function status(): BrowserStatus {
  return { page: currentPage(), open: isOpen() }
}

/** True once a page exists, whether or not the panel is showing it. */
export function isOpen(): boolean {
  return view !== null
}

export function snapshotPage(options: { includeOffscreen?: boolean } = {}): Promise<Snapshot> {
  return mutex.run(async () => {
    const session = await activeSession()
    const snapshot = await session.snapshot(options)
    refs.record(snapshot)
    return snapshot
  })
}

export function readPage(maxChars?: number): Promise<ReadResult> {
  return mutex.run(async () => {
    const session = await activeSession()
    return session.readText(maxChars)
  })
}

export function takeScreenshot(): Promise<Buffer> {
  return mutex.run(async () => {
    const session = await activeSession()
    return session.screenshot()
  })
}

/** Clicks a snapshot ref, scrolling it into view first so the box is real. */
export function clickRef(ref: number): Promise<PageInfo> {
  return mutex.run(async () => {
    const session = await activeSession()
    const before = (await session.pageInfo()).url
    const box = await session.scrollIntoView(refs.resolve(ref))
    await session.clickAt(box)
    // A click often navigates, but usually does not. Wait only if it does.
    await settleAfterAction(session, before)
    return requirePage()
  })
}

/** Focuses a snapshot ref and types into it, optionally submitting with Enter. */
export function typeRef(ref: number, text: string, submit = false): Promise<PageInfo> {
  return mutex.run(async () => {
    const session = await activeSession()
    const before = (await session.pageInfo()).url
    await session.typeText(refs.resolve(ref), text, submit)
    // Submitting usually navigates; typing without submit never does.
    if (submit) await settleAfterAction(session, before)
    return requirePage()
  })
}

export function go(direction: "back" | "forward" | "reload"): Promise<PageInfo> {
  return mutex.run(async () => {
    if (!view) throw new BrowserNotReadyError("no-window")
    const session = await activeSession()
    const before = (await session.pageInfo()).url

    if (direction === "reload") view.webContents.reload()
    else if (direction === "back") view.webContents.navigationHistory.goBack()
    else view.webContents.navigationHistory.goForward()

    await session.waitFor(async () => (await session.pageInfo()).url !== before, 10_000)
    return requirePage()
  })
}

export function savePdf(): Promise<string> {
  // Under the mutex like every other page operation: printing has to render the
  // page, so running it alongside a click or a navigation would race the very
  // layout it is trying to capture.
  return mutex.run(async () => {
    const session = await activeSession()
    const bytes = await session.printPdf()
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const file = path.join(app.getPath("downloads"), `dummy-${stamp}.pdf`)
    await writeFile(file, bytes)
    return file
  })
}

/**
 * Releases the page's memory without losing the view or its logins.
 *
 * Load-bearing on 8 GB: a heavy page can cost more than the whisper model F1
 * rejected. Cookies live in the partition, not the document, so `about:blank`
 * keeps every session intact.
 */
export function releasePageMemory(): Promise<void> {
  // Under the mutex like every other page operation: this navigates, so running
  // it alongside a click or a snapshot would race the very document it is
  // evicting.
  return mutex.run(async () => {
    if (!view) return
    await view.webContents.loadURL(ALLOWED_ABOUT_URL)
    refs.clear()
    emitStatus(null)
  })
}

export function dispose() {
  close()
}