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
  | { type: "stopped"; sessionId: string }
  | { type: "error"; sessionId: string; message: string }
  | { type: "load-error"; message: string }
  // Browser tool lifecycle. `tool-call`/`tool-result` drive the live timeline;
  // `approval-request` parks the turn until `respondToApproval` is called.
  | {
      type: "tool-call"
      sessionId: string
      toolCallId: string
      toolName: string
      input: unknown
    }
  | {
      type: "tool-result"
      sessionId: string
      toolCallId: string
      toolName: string
      output: unknown
    }
  | {
      type: "approval-request"
      sessionId: string
      approvalId: string
      toolCallId: string
      toolName: string
      input: unknown
      reason?: string
    }
  | {
      type: "approval-response"
      sessionId: string
      approvalId: string
      toolCallId: string
      toolName: string
      approved: boolean
    }
  // A page the model captured, shown to the user immediately.
  | {
      type: "browser-capture"
      sessionId: string
      attachmentId: string
      mediaType: string
      width: number
      height: number
      dataBase64: string
    }

/** Where the embedded browser currently is. */
interface BrowserStatus {
  page: { url: string; title: string } | null
  open: boolean
}

/**
 * Where the browser panel sits, in CSS pixels relative to the window viewport.
 * `null` means the panel is collapsed — the page keeps running either way.
 */
interface BrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

interface ChatSession {
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
type ChatSessionsResult =
  | { ok: true; sessions: ChatSession[] }
  | { ok: false; error: string }
type ChatSessionResult =
  | { ok: true; session: ChatSession }
  | { ok: false; error: string }
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

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      windowRole: "island" | "chat" | "capture"
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
      capture: {
        info: () => Promise<CaptureInfo | null>
        select: (rect: CaptureRectPayload) => void
        cancel: () => void
        permission: () => Promise<{
          granted: boolean
          status: string
          responsible: string
          message: string
        }>
        openSettings: () => Promise<void>
        consume: (holdId: string) => Promise<StagedCapture[]>
        onShow: (callback: (info: CaptureInfo) => void) => () => void
        onStaged: (callback: (event: CaptureStagedEvent) => void) => () => void
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
        send: (
          text: string,
          sessionId: string,
          attachments?: ChatAttachmentUpload[],
        ) => Promise<ChatSendResult>
        history: (sessionId: string) => Promise<ChatHistoryResult>
        reset: (sessionId: string) => Promise<ChatSendResult>
        listSessions: () => Promise<ChatSessionsResult>
        ensureSession: (sessionId: string) => Promise<ChatSessionResult>
        renameSession: (sessionId: string, title: string) => Promise<ChatSessionResult>
        deleteSession: (sessionId: string) => Promise<ChatSendResult>
        attachmentData: (attachmentId: string) => Promise<ChatAttachmentDataResult>
        stop: () => Promise<{ ok: true }>
        respondToApproval: (
          approvalId: string,
          approved: boolean,
        ) => Promise<{ ok: true } | { ok: false; error: string }>
        open: (text: string) => void
        takeInitialText: () => Promise<ChatSeed | null>
        ackInitialText: () => Promise<boolean>
        onInitialText: (callback: (seed: ChatSeed) => void) => () => void
        onEvent: (callback: (event: ChatEvent) => void) => () => void
      }
      browser: {
        show: () => Promise<BrowserStatus>
        status: () => Promise<BrowserStatus>
        hide: () => Promise<BrowserStatus>
        setBounds: (rect: BrowserBounds | null) => Promise<{ ok: true } | { ok: false }>
        close: () => Promise<BrowserStatus>
        onStatus: (callback: (status: BrowserStatus) => void) => () => void
      }
      onGlobalShortcut: (callback: (phase: "down" | "up") => void) => () => void
      ready: () => void
    }
  }
}
