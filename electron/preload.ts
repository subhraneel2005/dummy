import { contextBridge, ipcRenderer } from "electron"

interface DictationStatus {
  state: "transcribing" | "polishing" | "done" | "error"
  text?: string
  message?: string
}

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
type AiModelsResult = { ok: true; models: ModelInfo[] } | { ok: false; error: string; models?: ModelInfo[] }

interface ChatAttachment {
  id: string
  mediaType: string
  fileName: string
  width: number
  height: number
  byteSize: number
}

interface ChatMessage {
  role: "user" | "assistant"
  text: string
  attachments: ChatAttachment[]
}

/** An attachment on its way to the model. */
interface ChatAttachmentUpload {
  id: string
  mediaType: string
  fileName: string
  dataBase64: string
}

type ChatEvent =
  | { type: "delta"; sessionId: string; text: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; sessionId: string; message: string }
  | { type: "load-error"; message: string }

type ChatSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

/**
 * What the chat window is handed when dictation ends: the transcript (if any)
 * and the id of the hold whose captures belong with it. `holdId` is null when
 * the dictation produced no screenshots.
 */
type ChatSeed = { text: string | null; holdId: string | null }

type ChatSendResult = { ok: true } | { ok: false; error: string }
type ChatHistoryResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string }
type ChatSessionsResult = { ok: true; sessions: ChatSession[] } | { ok: false; error: string }
type ChatSessionResult = { ok: true; session: ChatSession } | { ok: false; error: string }
type ChatAttachmentDataResult =
  | { ok: true; mediaType: string; dataBase64: string }
  | { ok: false; error: string }

/** Geometry of the display the capture overlay covers, in absolute DIPs. */
type CaptureInfo = {
  holdId: string
  displayId: number
  x: number
  y: number
  width: number
  height: number
  count: number
  max: number
  granted: boolean
  permissionMessage: string
}

/** One screenshot, as the renderer needs it to stage a preview. */
type StagedCapture = ChatAttachment & { dataBase64: string }

type CaptureRectPayload = { x: number; y: number; width: number; height: number }

type CaptureStagedEvent = { holdId: string; count: number; limitReached: boolean }

const electronAPI = {
  platform: process.platform,
  // The island, the chat window and the capture overlay load the same bundle;
  // the route tells the renderer which surface to render.
  windowRole: location.pathname.startsWith("/capture")
    ? ("capture" as const)
    : location.pathname.startsWith("/chat")
      ? ("chat" as const)
      : ("island" as const),
  window: {
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
  capture: {
    info: () => ipcRenderer.invoke("capture:info") as Promise<CaptureInfo | null>,
    select: (rect: CaptureRectPayload) => ipcRenderer.send("capture:select", rect),
    cancel: () => ipcRenderer.send("capture:cancel"),
    permission: () =>
      ipcRenderer.invoke("capture:permission") as Promise<{
        granted: boolean
        status: string
        responsible: string
        message: string
      }>,
    openSettings: () => ipcRenderer.invoke("capture:open-settings") as Promise<void>,
    consume: (holdId: string) =>
      ipcRenderer.invoke("capture:consume", holdId) as Promise<StagedCapture[]>,
    onShow: (callback: (info: CaptureInfo) => void) => {
      const handler = (_event: unknown, info: CaptureInfo) => callback(info)
      ipcRenderer.on("capture:show", handler)
      return () => ipcRenderer.removeListener("capture:show", handler)
    },
    onStaged: (callback: (event: CaptureStagedEvent) => void) => {
      const handler = (_event: unknown, payload: CaptureStagedEvent) => callback(payload)
      ipcRenderer.on("capture:staged", handler)
      return () => ipcRenderer.removeListener("capture:staged", handler)
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
    ai: {
      getConfig: () => ipcRenderer.invoke("ai:get-config") as Promise<AiConfigResult>,
      getCatalog: () => ipcRenderer.invoke("ai:catalog") as Promise<AiCatalogResult>,
      listModels: (provider: string) =>
        ipcRenderer.invoke("ai:list-models", provider) as Promise<AiModelsResult>,
      setProvider: (provider: string) =>
        ipcRenderer.invoke("ai:set-provider", provider) as Promise<AiConfigResult>,
      setModel: (model: string) =>
        ipcRenderer.invoke("ai:set-model", model) as Promise<AiConfigResult>,
      setKey: (provider: string, key: string) =>
        ipcRenderer.invoke("ai:set-key", provider, key) as Promise<AiConfigResult>,
      clearKey: (provider: string) =>
        ipcRenderer.invoke("ai:clear-key", provider) as Promise<AiConfigResult>,
    },
    chat: {
      send: (text: string, sessionId: string, attachments?: ChatAttachmentUpload[]) =>
        ipcRenderer.invoke("chat:send", text, sessionId, attachments) as Promise<ChatSendResult>,
      history: (sessionId: string) =>
        ipcRenderer.invoke("chat:history", sessionId) as Promise<ChatHistoryResult>,
      reset: (sessionId: string) =>
        ipcRenderer.invoke("chat:reset", sessionId) as Promise<ChatSendResult>,
      listSessions: () =>
        ipcRenderer.invoke("chat:list-sessions") as Promise<ChatSessionsResult>,
      ensureSession: (sessionId: string) =>
        ipcRenderer.invoke("chat:ensure-session", sessionId) as Promise<ChatSessionResult>,
      renameSession: (sessionId: string, title: string) =>
        ipcRenderer.invoke("chat:rename-session", sessionId, title) as Promise<ChatSessionResult>,
      deleteSession: (sessionId: string) =>
        ipcRenderer.invoke("chat:delete-session", sessionId) as Promise<ChatSendResult>,
      attachmentData: (attachmentId: string) =>
        ipcRenderer.invoke("chat:attachment-data", attachmentId) as Promise<ChatAttachmentDataResult>,
      open: (text: string) => ipcRenderer.send("chat:open", text),
      takeInitialText: () => ipcRenderer.invoke("chat:take-initial-text") as Promise<ChatSeed | null>,
      ackInitialText: () => ipcRenderer.invoke("chat:ack-initial-text") as Promise<boolean>,
      onInitialText: (callback: (seed: ChatSeed) => void) => {
        const handler = (_event: unknown, seed: ChatSeed) => callback(seed)
        ipcRenderer.on("chat:initial-text", handler)
        return () => ipcRenderer.removeListener("chat:initial-text", handler)
      },
      onEvent: (callback: (event: ChatEvent) => void) => {
        const handler = (_event: unknown, event: ChatEvent) => callback(event)
        ipcRenderer.on("chat:event", handler)
        return () => ipcRenderer.removeListener("chat:event", handler)
      }
    },
  ready: () => ipcRenderer.send("renderer:ready")
}

contextBridge.exposeInMainWorld("electronAPI", electronAPI)

export type ElectronAPI = typeof electronAPI
export type {
  AiCatalogResult,
  AiConfig,
  AiConfigResult,
  CaptureInfo,
  ChatAttachment,
  ChatAttachmentDataResult,
  ChatAttachmentUpload,
  ChatEvent,
  ChatMessage,
  ChatSeed,
  ChatSession,
  DictationStatus,
  ModelInfo,
  ProviderInfo,
  StagedCapture
}
