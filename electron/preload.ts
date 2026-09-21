import { contextBridge, ipcRenderer } from "electron"

interface DictationStatus {
  state: "transcribing" | "done" | "error"
  text?: string
  message?: string
}

const electronAPI = {
  platform: process.platform,
  window: {
    close: () => ipcRenderer.send("window:close"),
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
    startDrag: () => ipcRenderer.invoke("window:start-drag"),
    moveDrag: () => ipcRenderer.send("window:drag-move"),
    endDrag: () => ipcRenderer.send("window:drag-end"),
    setIgnoreMouseEvents: (ignore: boolean) =>
      ipcRenderer.send("window:set-ignore-mouse-events", ignore),
    setIslandSize: (width: number, height: number) =>
      ipcRenderer.send("window:set-island-size", width, height)
  },
  dictation: {
    sendAudio: (wav: ArrayBuffer) => ipcRenderer.send("dictation:audio", wav),
    onStatus: (callback: (status: DictationStatus) => void) => {
      const handler = (_event: unknown, status: DictationStatus) => callback(status)
      ipcRenderer.on("dictation:status", handler)
      return () => ipcRenderer.removeListener("dictation:status", handler)
    }
  },
  onGlobalShortcut: (callback: (phase: "down" | "up") => void) => {
    const onDown = () => callback("down")
    const onUp = () => callback("up")
    ipcRenderer.on("global-shortcut:down", onDown)
    ipcRenderer.on("global-shortcut:up", onUp)
    return () => {
      ipcRenderer.removeListener("global-shortcut:down", onDown)
      ipcRenderer.removeListener("global-shortcut:up", onUp)
    }
  },
  ready: () => ipcRenderer.send("renderer:ready")
}

contextBridge.exposeInMainWorld("electronAPI", electronAPI)

export type ElectronAPI = typeof electronAPI
export type { DictationStatus }