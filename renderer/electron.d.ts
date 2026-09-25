export {}

interface AiConfig {
  provider: string | null
  model: string | null
  hasKey: boolean
  encryptionAvailable: boolean
}

interface ModelInfo {
  id: string
  label: string
}

interface ProviderInfo {
  id: string
  label: string
  keyPlaceholder: string
  docsUrl: string
}

type AiConfigResult = { ok: true; config: AiConfig } | { ok: false; error: string }
type AiCatalogResult = {
  ok: true
  providers: Record<string, ProviderInfo>
  models: Record<string, ModelInfo[]>
}
type AiModelsResult =
  | { ok: true; models: ModelInfo[] }
  | { ok: false; error: string; models?: ModelInfo[] }

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

type ChatSendResult = { ok: true } | { ok: false; error: string }
type ChatHistoryResult =
  | { ok: true; messages: ChatMessage[] }
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
          state: "transcribing" | "polishing" | "done" | "error"
          text?: string
          message?: string
        }) => void) => () => void
      }
      ai: {
        onOpenSettings: (callback: () => void) => () => void
        getConfig: () => Promise<AiConfigResult>
        getCatalog: () => Promise<AiCatalogResult>
        listModels: (provider: string) => Promise<AiModelsResult>
        setProvider: (provider: string) => Promise<AiConfigResult>
        setModel: (model: string) => Promise<AiConfigResult>
        setKey: (provider: string, key: string) => Promise<AiConfigResult>
        clearKey: (provider: string) => Promise<AiConfigResult>
      }
      chat: {
        send: (text: string) => Promise<ChatSendResult>
        history: () => Promise<ChatHistoryResult>
        reset: () => Promise<ChatSendResult>
        onEvent: (callback: (event: ChatEvent) => void) => () => void
      }
      onGlobalShortcut: (callback: (phase: "down" | "up") => void) => () => void
      ready: () => void
    }
  }
}