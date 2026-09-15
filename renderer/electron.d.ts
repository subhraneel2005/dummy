export {}

declare global {
  interface Window {
    electronAPI?: {
      window: {
        close: () => void
        minimize: () => void
        toggleMaximize: () => void
      }
      onGlobalShortcut: (callback: (phase: "down" | "up") => void) => () => void
      ready: () => void
    }
  }
}