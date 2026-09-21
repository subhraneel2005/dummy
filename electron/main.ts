import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, screen } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { transcribeWav, whisperReady } from "./transcribe.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let pendingPttDown = false
let dragOffset: { dx: number; dy: number } | null = null
let isRecording = false

const PTT_KEY = "Alt+D"

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
    mainWindow.setBounds({
      x: Math.round(x + (currentWidth - w) / 2),
      y: Math.round(y + (currentHeight - h) / 2),
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
    if (!pendingPttDown) return
    pendingPttDown = false
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("global-shortcut:down")
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
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})