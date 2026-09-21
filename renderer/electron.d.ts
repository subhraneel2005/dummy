export {}

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
      onGlobalShortcut: (callback: (phase: "down" | "up") => void) => () => void
      ready: () => void
    }
  }
}