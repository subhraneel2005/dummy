import { app, BrowserWindow, globalShortcut, ipcMain, screen } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let pendingPttDown = false
let dragOffset: { dx: number; dy: number } | null = null

const PTT_KEY = "Alt+D"

function createWindow() {
  mainWindow = new BrowserWindow ({

    frame: false,
    transparent: true,
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

  const { width } = mainWindow.getBounds()
  const { width: displayWidth } = screen.getPrimaryDisplay().workArea
  mainWindow.setPosition(Math.round((displayWidth - width) / 2), 40)
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
  ipcMain.on("renderer:ready", () => {
    if (!pendingPttDown) return
    pendingPttDown = false
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("global-shortcut:down")
    }
  })
}

function registerGlobalShortcut() {
  const ok = globalShortcut.register(PTT_KEY, () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      pendingPttDown = true
      createWindow()
      return
    }
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