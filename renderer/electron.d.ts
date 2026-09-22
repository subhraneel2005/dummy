export {}

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

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      window: {
        close: () => void
        minimize: () => void
        toggleMaximize: () => void
        startDrag: () => void
        moveDrag: () => void
        endDrag: () => void
        setIgnoreMouseEvents: (ignore: boolean) => void
        setIslandSize: (width: number, height: number) => void
      }
      dictation: {
        sendAudio: (wav: ArrayBuffer) => void
        onStatus: (callback: (status: {
          state: "transcribing" | "done" | "error"
          text?: string
          message?: string
        }) => void) => () => void
      }
      opencode: {
        onOpenPicker: (callback: () => void) => () => void
        onStatus: (callback: (status: OpenCodeStatus) => void) => () => void
        listModels: () => Promise<OpenCodeResult>
        getModel: () => Promise<
          { ok: true; model: OpenCodeModel | null } | { ok: false; error: string }
        >
        setModel: (model: OpenCodeModel) => Promise<{ ok: true; model: OpenCodeModel }>
      }
      onGlobalShortcut: (callback: (phase: "down" | "up") => void) => () => void
      ready: () => void
    }
  }
}