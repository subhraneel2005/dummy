import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  getSelectedModel,
  listModels,
  onOpenCodeStatus,
  setSelectedModel,
  stopOpenCode,
} from "./opencode.js"
import { transcribeWav, whisperReady } from "./transcribe.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let pendingPttDown = false
let pendingModelPicker = false
let dragOffset: { dx: number; dy: number } | null = null
let isRecording = false

const PTT_KEY = "Alt+D"
const MODEL_PICKER_KEY = "Alt+M"

const PAD = 12
const ISLAND_WIDTH = 280
const ISLAND_HEIGHT = 84

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

function registerIpcHandlers() {
  ipcMain.on("window:close", () => mainWindow?.close())
  ipcMain.on("window:minimize", () => mainWindow?.minimize())
  ipcMain.on("window:toggle-maximize", () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle("window:start-drag", () => {
    if (!mainWindow) return
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
  ipcMain.on("window:set-ignore-mouse-events", (_event, ignore: boolean) => {
    if (!mainWindow) return
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  })
  ipcMain.on("window:set-island-size", (_event, width: number, height: number) => {
    if (!mainWindow) return
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
    if (pendingModelPicker) {
      pendingModelPicker = false
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send("opencode:open-picker")
      }
    }
  })

  ipcMain.handle("opencode:models", () => listModels())
  ipcMain.handle("opencode:get-model", () => ({
    ok: true as const,
    model: getSelectedModel(),
  }))
  ipcMain.handle("opencode:set-model", (_event, model) => {
    setSelectedModel(model)
    return { ok: true as const, model }
  })

  onOpenCodeStatus((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("opencode:status", status)
    }
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
      clipboard.writeText(text)
      mainWindow.webContents.send("dictation:status", { state: "done", text })
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

  const okPicker = globalShortcut.register(MODEL_PICKER_KEY, () => {
    if (mainWindow && mainWindow.isDestroyed()) {
      pendingModelPicker = true
      createWindow()
      return
    }
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send("opencode:open-picker")
    }
  })
  if (!okPicker) {
    console.warn(`Failed to register global shortcut: ${MODEL_PICKER_KEY}`)
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  registerGlobalShortcut()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
  stopOpenCode()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})