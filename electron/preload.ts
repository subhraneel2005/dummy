import { contextBridge, ipcRenderer } from "electron"

interface DictationStatus {
  state: "transcribing" | "done" | "error"
  text?: string
  message?: string
}

interface OpenCodeModel {
  providerID: string
  providerName: string
  modelID: string
  name: string
  vision: boolean
}

type OpenCodeStatus =
  | { state: "connecting" }
  | { state: "ready"; version: string }
  | { state: "error"; message: string }

type OpenCodeResult =
  | { ok: true; models: OpenCodeModel[] }
  | { ok: false; error: string }

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
  opencode: {
    onOpenPicker: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on("opencode:open-picker", handler)
      return () => ipcRenderer.removeListener("opencode:open-picker", handler)
    },
    onStatus: (callback: (status: OpenCodeStatus) => void) => {
      const handler = (_event: unknown, status: OpenCodeStatus) => callback(status)
      ipcRenderer.on("opencode:status", handler)
      return () => ipcRenderer.removeListener("opencode:status", handler)
    },
    listModels: () => ipcRenderer.invoke("opencode:models") as Promise<OpenCodeResult>,
    getModel: () =>
      ipcRenderer.invoke("opencode:get-model") as Promise<
        { ok: true; model: OpenCodeModel | null } | { ok: false; error: string }
      >,
    setModel: (model: OpenCodeModel) =>
      ipcRenderer.invoke("opencode:set-model", model) as Promise<{
        ok: true
        model: OpenCodeModel
      }>
  },
  ready: () => ipcRenderer.send("renderer:ready")
}

contextBridge.exposeInMainWorld("electronAPI", electronAPI)

export type ElectronAPI = typeof electronAPI
export type { DictationStatus, OpenCodeModel, OpenCodeResult, OpenCodeStatus }