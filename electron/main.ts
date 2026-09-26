import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, nativeTheme, screen } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getChatHistory, onChatEvent, resetChat, sendChatMessage } from "./ai/chat.js"
import { listProviderModels } from "./ai/catalog.js"
import { clearApiKey, getConfig, setApiKey, setModel, setProvider } from "./ai/config.js"
import { isProviderId, MODEL_CATALOG, PROVIDER_INFO } from "./ai/models.js"
import { polishTranscript } from "./ai/polish.js"
import {
  deleteSession,
  ensureSession,
  listSessions,
  renameSession,
} from "./ai/sessions.js"
import { closeDb, initDb, migrateDb } from "./db/index.js"
import { transcribeWav, whisperReady } from "./transcribe.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let chatWindow: BrowserWindow | null = null
let pendingChatText: string | null = null
let pendingPttDown = false
let dragOffset: { dx: number; dy: number } | null = null
let isRecording = false

const PTT_KEY = "Alt+D"

const PAD = 12
const ISLAND_WIDTH = 280
const ISLAND_HEIGHT = 84
const CHAT_MIN_WIDTH = 1000
const CHAT_MIN_HEIGHT = 640
// Gap left around the chat window, in DIPs, when it is sized to the display.
// Kept small so the default really does fill the screen, while still leaving a
// visible edge to grab and resize from.
const CHAT_SCREEN_MARGIN = 8
// Upper bounds so an ultrawide or 5K display does not open a window that is
// hard to work with; the window stays freely resizable past this.
const CHAT_MAX_WIDTH = 1800
const CHAT_MAX_HEIGHT = 1200

/**
 * Sizes the chat window to the display it will open on instead of a fixed pixel
 * size. A hardcoded 1280x860 silently clamps on a 1440x807 display (the height
 * overflows the work area), which is what made the old default feel arbitrary.
 */
function chatWindowSize(): { width: number; height: number } {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workAreaSize
  return {
    width: Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, area.width - CHAT_SCREEN_MARGIN * 2)),
    height: Math.min(CHAT_MAX_HEIGHT, Math.max(CHAT_MIN_HEIGHT, area.height - CHAT_SCREEN_MARGIN * 2)),
  }
}

// Window controls are per-window, so resolve the target from the sender rather
// than assuming the island. Otherwise the chat window's minimize button would
// minimize the island instead.
function windowFor(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender)
}

function createWindow() {
  mainWindow = new BrowserWindow ({
    width: ISLAND_WIDTH + PAD * 2,
    height: ISLAND_HEIGHT + PAD * 2,

    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    show: false,
    hasShadow: false,
    resizable: false,
    fullscreenable : false,
    alwaysOnTop: true ,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWindow.setAlwaysOnTop(true, "screen-saver")
  if (process.platform !== "darwin") {
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  }

  mainWindow.loadURL("http://localhost:3000")

  // Global shortcuts have no key-up event, so catch the D/Alt release here and
  // relay it as the "up" phase while the window is focused on a recording.
  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.type !== "keyUp" || !isRecording) return
    const key = input.key.toLowerCase()
    if (key === "d" || key === "alt" || key === "option") {
      mainWindow?.webContents.send("global-shortcut:up")
    }
  })

  const { width: displayWidth } = screen.getPrimaryDisplay().workArea
  mainWindow.setPosition(Math.round((displayWidth - (ISLAND_WIDTH + PAD * 2)) / 2), 40)
}

const IS_MAC = process.platform === "darwin"

/** Matches the app's `--background` so the title bar blends into the content. */
function chatBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? "#09090b" : "#ffffff"
}

function createChatWindow() {
  const size = chatWindowSize()

  chatWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: CHAT_MIN_WIDTH,
    minHeight: CHAT_MIN_HEIGHT,

    // Native window controls with a transparent title bar: the traffic lights
    // stay the real macOS ones, but the strip behind them has no fill of its
    // own, so the app's own background runs through it. Windows/Linux keep the
    // standard opaque system title bar. The window is never frameless, so the
    // controls remain genuinely native rather than drawn by the app.
    ...(IS_MAC
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 14, y: 18 },
        }
      : {}),
    transparent: false,
    backgroundColor: chatBackgroundColor(),
    show: false,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true
    }
  })

  // With `defaultTheme="system"` the app follows the OS, so the colour behind
  // the page has to follow it too or a live switch shows a stale letterbox.
  const syncBackground = () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.setBackgroundColor(chatBackgroundColor())
    }
  }
  nativeTheme.on("updated", syncBackground)
  chatWindow.on("closed", () => {
    nativeTheme.off("updated", syncBackground)
  })

  chatWindow.on("closed", () => {
    chatWindow = null
    pendingChatText = null
  })

  // Created hidden so the first paint isn't a white flash. `ready-to-show` can
  // be missed entirely if the dev server never finishes painting, so a timer
  // guarantees the window surfaces instead of staying invisible.
  const reveal = () => {
    if (!chatWindow || chatWindow.isDestroyed()) return
    chatWindow.show()
    chatWindow.focus()
  }
  const revealFallback = setTimeout(reveal, 2500)
  chatWindow.once("ready-to-show", () => {
    clearTimeout(revealFallback)
    reveal()
  })

  // If the renderer can't be reached (dev server down) the window would sit
  // there as a blank white rectangle with no explanation. Surface it and bail.
  chatWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return // aborted, usually a redirect or supersede
    console.error(`[chat] failed to load ${validatedURL}: ${errorDescription} (${errorCode})`)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(
          "chat:event",
          { type: "load-error", message: "Chat window could not load. Is the renderer dev server running on :3000?" }
        )
      }
    }
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.destroy()
    chatWindow = null
  })

  chatWindow.loadURL("http://localhost:3000/chat")

  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  chatWindow.setPosition(
    Math.round(workArea.x + (workArea.width - size.width) / 2),
    Math.round(workArea.y + (workArea.height - size.height) / 2)
  )
}

function openChatWindow(text: string) {
  if (!chatWindow || chatWindow.isDestroyed()) {
    pendingChatText = text || null
    createChatWindow()
    return
  }
  chatWindow.show()
  chatWindow.focus()
  // The renderer is already mounted, so hand the text over as an event rather
  // than waiting for a fresh mount to pull it.
  if (text) chatWindow.webContents.send("chat:initial-text", text)
}

function registerIpcHandlers() {
  // Window minimize/maximize/close are the OS's own controls now, so the chat
  // window needs no window-management IPC. The drag handlers below are for the
  // island only, which drags from JS.
  ipcMain.handle("window:start-drag", (event) => {
    if (windowFor(event) !== mainWindow || !mainWindow) return
    const [x = 0, y = 0] = mainWindow.getPosition()
    const cursor = screen.getCursorScreenPoint()
    dragOffset = { dx: cursor.x - x, dy: cursor.y - y }
  })
  ipcMain.on("window:drag-move", () => {
    if (!mainWindow || !dragOffset) return
    const cursor = screen.getCursorScreenPoint()
    mainWindow.setPosition(cursor.x - dragOffset.dx, cursor.y - dragOffset.dy)
  })
  ipcMain.on("window:drag-end", () => {
    dragOffset = null
  })
  ipcMain.on("window:set-ignore-mouse-events", (event, ignore: boolean) => {
    if (windowFor(event) !== mainWindow || !mainWindow) return
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  })
  ipcMain.on("window:set-island-size", (event, width: number, height: number) => {
    if (windowFor(event) !== mainWindow || !mainWindow) return
    const w = Math.max(1, Math.round(width)) + PAD * 2
    const h = Math.max(1, Math.round(height)) + PAD * 2
    const [x = 0, y = 0] = mainWindow.getPosition()
    const [currentWidth = 0, currentHeight = 0] = mainWindow.getSize()
    // Center horizontally around the current window, but anchor the top edge
    // so growing the island doesn't push it off the top of the screen.
    let nextX = Math.round(x + (currentWidth - w) / 2)
    let nextY = y
    // Keep the window fully inside the display's work area.
    const { workArea } = screen.getDisplayNearestPoint({ x, y })
    nextX = Math.min(Math.max(nextX, workArea.x), workArea.x + workArea.width - w)
    nextY = Math.min(Math.max(nextY, workArea.y), workArea.y + workArea.height - h)
    mainWindow.setBounds({
      x: nextX,
      y: nextY,
      width: w,
      height: h
    })
    if (width > 0 && height > 0) {
      if (!mainWindow.isVisible()) mainWindow.show()
    } else {
      mainWindow.hide()
    }
  })
  ipcMain.on("renderer:ready", () => {
    if (pendingPttDown) {
      pendingPttDown = false
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("global-shortcut:down")
      }
    }
  })

  // Session ids are minted by the renderer, so validate before they reach SQL.
  const validSessionId = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0 && value.length <= 64
  const badSession = { ok: false as const, error: "Invalid chat session id." }

  ipcMain.handle("chat:send", (_event, text: string, sessionId: unknown) =>
    validSessionId(sessionId) ? sendChatMessage(text, sessionId) : badSession,
  )
  ipcMain.handle("chat:history", (_event, sessionId: unknown) =>
    validSessionId(sessionId) ? getChatHistory(sessionId) : badSession,
  )
  ipcMain.handle("chat:reset", (_event, sessionId: unknown) =>
    validSessionId(sessionId) ? resetChat(sessionId) : badSession,
  )

  ipcMain.handle("chat:list-sessions", () => listSessions())
  ipcMain.handle("chat:ensure-session", (_event, sessionId: unknown) =>
    validSessionId(sessionId) ? ensureSession(sessionId) : badSession,
  )
  ipcMain.handle("chat:rename-session", (_event, sessionId: unknown, title: unknown) => {
    if (!validSessionId(sessionId) || typeof title !== "string") return badSession
    return renameSession(sessionId, title)
  })
  ipcMain.handle("chat:delete-session", (_event, sessionId: unknown) =>
    validSessionId(sessionId) ? deleteSession(sessionId) : badSession,
  )
  ipcMain.on("chat:open", (_event, text: string) => openChatWindow(text))
  // Pulled by the chat renderer on mount. The text is NOT cleared on read: the
  // renderer may unmount/remount (HMR, reload) between the invoke and the state
  // update, and clearing here destroyed the transcript with nothing to show for
  // it. The renderer acks once it has actually taken ownership.
  ipcMain.handle("chat:take-initial-text", (event) => {
    if (windowFor(event) !== chatWindow) return null
    return pendingChatText
  })
  ipcMain.handle("chat:ack-initial-text", (event) => {
    if (windowFor(event) !== chatWindow) return false
    pendingChatText = null
    return true
  })

  // Stream the assistant reply to whichever window is showing the chat.
  onChatEvent((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send("chat:event", event)
    }
  })

  ipcMain.handle("ai:get-config", () => getConfig().then((config) => ({ ok: true as const, config })))
  ipcMain.handle("ai:catalog", () => ({
    ok: true as const,
    providers: PROVIDER_INFO,
    models: MODEL_CATALOG,
  }))

  // The setters in `ai/config.ts` return void, so the post-mutation config has
  // to be re-read here. Returning their resolution value directly would ship
  // `{ ok: true, config: undefined }` to the renderer, which the preload cast
  // hides from the type checker.
  const mutateConfig = async (run: () => Promise<void>) => {
    try {
      await run()
      return { ok: true as const, config: await getConfig() }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  }

  ipcMain.handle("ai:set-provider", (_event, provider: string) => {
    if (!isProviderId(provider)) {
      return Promise.resolve({ ok: false as const, error: `Unknown provider: ${provider}` })
    }
    return mutateConfig(() => setProvider(provider))
  })
  ipcMain.handle("ai:set-model", (_event, model: string) => {
    return mutateConfig(() => setModel(model))
  })
  ipcMain.handle("ai:set-key", (_event, provider: string, key: string) => {
    if (!isProviderId(provider)) {
      return Promise.resolve({ ok: false as const, error: `Unknown provider: ${provider}` })
    }
    return mutateConfig(() => setApiKey(provider, key))
  })
  ipcMain.handle("ai:clear-key", (_event, provider: string) => {
    if (!isProviderId(provider)) {
      return Promise.resolve({ ok: false as const, error: `Unknown provider: ${provider}` })
    }
    return mutateConfig(() => clearApiKey(provider))
  })
  ipcMain.handle("ai:list-models", (_event, provider: string) => {
    if (!isProviderId(provider)) {
      return Promise.resolve({ ok: false as const, error: `Unknown provider: ${provider}` })
    }
    return listProviderModels(provider)
  })

  ipcMain.on("dictation:audio", async (event, wav: ArrayBuffer) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    isRecording = false

    const ready = whisperReady()
    if (!ready.ready) {
      mainWindow.webContents.send("dictation:status", { state: "error", message: ready.reason })
      return
    }

    const buffer = Buffer.from(wav)
    mainWindow.webContents.send("dictation:status", { state: "transcribing" })

    try {
      const text = await transcribeWav(buffer)
      if (!text) {
        mainWindow.webContents.send("dictation:status", {
          state: "error",
          message: "Nothing heard — try speaking closer or louder.",
        })
        return
      }
      mainWindow.webContents.send("dictation:status", { state: "polishing" })
      const polished = await polishTranscript(text)
      clipboard.writeText(polished)
      mainWindow.webContents.send("dictation:status", { state: "done", text: polished })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      mainWindow.webContents.send("dictation:status", { state: "error", message })
    }
  })
}

function registerGlobalShortcut() {
  const ok = globalShortcut.register(PTT_KEY, () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      pendingPttDown = true
      isRecording = true
      createWindow()
      return
    }
    isRecording = true
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send("global-shortcut:down")
  })
  if (!ok) {
    console.warn(`Failed to register global shortcut: ${PTT_KEY}`)
  }
}

app.whenReady().then(async () => {
  initDb()
  await migrateDb()
  registerIpcHandlers()
  createWindow()
  registerGlobalShortcut()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
  closeDb()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})