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
      }
      onGlobalShortcut: (callback: (phase: "down" | "up") => void) => () => void
      ready: () => void
    }
  }
}