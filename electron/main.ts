import { app, BrowserWindow, globalShortcut, ipcMain, screen } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let pendingPttDown = false

const PTT_KEY = "Alt+D"

function createWindow() {
  mainWindow = new BrowserWindow ({
    width: 520,
    height: 680,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    fullscreenable : false,
    alwaysOnTop: true ,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true
    }
  })

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