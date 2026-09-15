import { contextBridge, ipcRenderer } from "electron"

const electronAPI = {
  window: {
    close: () => ipcRenderer.send("window:close"),
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
    startDrag: () => ipcRenderer.invoke("window:start-drag"),
    moveDrag: () => ipcRenderer.send("window:drag-move"),
    endDrag: () => ipcRenderer.send("window:drag-end")
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