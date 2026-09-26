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
  | { type: "delta"; sessionId: string; text: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; sessionId: string; message: string }
  | { type: "load-error"; message: string }

interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

type ChatSendResult = { ok: true } | { ok: false; error: string }
type ChatHistoryResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string }
type ChatSessionsResult =
  | { ok: true; sessions: ChatSession[] }
  | { ok: false; error: string }
type ChatSessionResult =
  | { ok: true; session: ChatSession }
  | { ok: false; error: string }

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      windowRole: "island" | "chat"
      window: {
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
        getConfig: () => Promise<AiConfigResult>
        getCatalog: () => Promise<AiCatalogResult>
        listModels: (provider: string) => Promise<AiModelsResult>
        setProvider: (provider: string) => Promise<AiConfigResult>
        setModel: (model: string) => Promise<AiConfigResult>
        setKey: (provider: string, key: string) => Promise<AiConfigResult>
        clearKey: (provider: string) => Promise<AiConfigResult>
      }
      chat: {
        send: (text: string, sessionId: string) => Promise<ChatSendResult>
        history: (sessionId: string) => Promise<ChatHistoryResult>
        reset: (sessionId: string) => Promise<ChatSendResult>
        listSessions: () => Promise<ChatSessionsResult>
        ensureSession: (sessionId: string) => Promise<ChatSessionResult>
        renameSession: (sessionId: string, title: string) => Promise<ChatSessionResult>
        deleteSession: (sessionId: string) => Promise<ChatSendResult>
        open: (text: string) => void
        takeInitialText: () => Promise<string | null>
        ackInitialText: () => Promise<boolean>
        onInitialText: (callback: (text: string) => void) => () => void
        onEvent: (callback: (event: ChatEvent) => void) => () => void
      }
      onGlobalShortcut: (callback: (phase: "down" | "up") => void) => () => void
      ready: () => void
    }
  }
}