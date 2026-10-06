"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Attachment metadata exactly as main stores it. No bytes, no filesystem path. */
export interface ChatAttachment {
  id: string
  mediaType: string
  fileName: string
  width: number
  height: number
  byteSize: number
}

/**
 * An attachment as the UI needs it. `localSrc` is present only on the
 * optimistic copy of a just-sent message: the renderer still holds those bytes
 * as a data URL, so there is nothing to fetch. Once the message comes back from
 * history the field is gone and the thumbnail is fetched by id instead.
 */
export type ChatAttachmentView = ChatAttachment & { localSrc?: string }

/** An attachment on its way to main. */
export interface ChatAttachmentUpload {
  id: string
  mediaType: string
  fileName: string
  dataBase64: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
  attachments: ChatAttachmentView[]
  /**
   * The browser tool calls this assistant turn made.
   *
   * Stored on the message rather than kept in one hook-level map, because the
   * timeline is part of the conversation: it has to come back from `chat:history`
   * after a reload, and it has to be positioned against the reply it belongs to.
   */
  toolCalls: ToolActivity[]
}

type ChatEvent =
  | { type: "delta"; sessionId: string; text: string }
  | { type: "done"; sessionId: string }
  | { type: "stopped"; sessionId: string }
  | { type: "error"; sessionId: string; message: string }
  | { type: "load-error"; message: string }
  | { type: "tool-call"; sessionId: string; toolCallId: string; toolName: string; input: unknown }
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
  | {
      type: "browser-capture"
      sessionId: string
      attachmentId: string
      mediaType: string
      width: number
      height: number
      dataBase64: string
    }

/**
 * A tool call as the UI shows it.
 *
 * Tool activity is deliberately not part of `ChatMessage`: it is not a turn,
 * it never reaches history (a reloaded transcript starts with no timeline at
 * all), and collapsing it into a message would make the assistant's text
 * inseparable from the work that produced it.
 */
export interface ToolActivity {
  toolCallId: string
  toolName: string
  /** Present from `tool-call`; used to render what is about to happen. */
  input: unknown
  /** Present once the tool actually ran. */
  output: unknown
  /**
   * `running` is live-only — nothing persisted is ever running, because a
   * `running` row means the turn was interrupted before it could finish.
   */
  status: "running" | "done" | "error" | "denied" | "stopped"
  /** Set while the user is being asked, cleared when they answer. */
  approvalId: string | null
  /** Set only after a decision, so a denied action reads as "skipped", not "pending". */
  approved: boolean | null
  /** Milliseconds, measured from `tool-call` to result or decision. */
  durationMs: number | null
  error: string | null
  /**
   * When the row started, for the live spinner.
   *
   * Live-only, like `status: "running"`: it is dropped when the row is handed to
   * a message and reloaded from history, where `durationMs` is already final.
   */
  startedAt?: number
}

/** One tool row, with the live-only fields removed, ready to store on a message. */
export function toStoredToolCall(call: ToolActivity): Omit<ToolActivity, "approvalId" | "startedAt"> {
  return {
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    input: call.input,
    output: call.output,
    status: call.status === "running" ? "stopped" : call.status,
    approved: call.approved,
    durationMs: call.durationMs,
    error: call.error,
  }
}

export interface BrowserApproval {
  approvalId: string
  toolCallId: string
  toolName: string
  input: unknown
  reason?: string
}

// The preload cast cannot guarantee the shape of a payload from another
// process, so coerce before it reaches state that the panel maps over.
function normalizeAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return []
    const raw = entry as Partial<ChatAttachment>
    if (typeof raw.id !== "string" || !raw.id) return []
    if (typeof raw.mediaType !== "string" || !raw.mediaType) return []
    return [
      {
        id: raw.id,
        mediaType: raw.mediaType,
        fileName: typeof raw.fileName === "string" ? raw.fileName : "",
        width: typeof raw.width === "number" ? raw.width : 0,
        height: typeof raw.height === "number" ? raw.height : 0,
        byteSize: typeof raw.byteSize === "number" ? raw.byteSize : 0,
      },
    ]
  })
}

/**
 * Main's recorded tool calls, normalised for the timeline.
 *
 * A row with no `tool_call_id` is dropped rather than rendered: it cannot be
 * matched to anything, and the UI keys on that id. Statuses are checked against
 * a fixed set so a row written by a newer build degrades to "stopped" instead of
 * rendering as an unknown state.
 */
function normalizeToolCalls(value: unknown): ToolActivity[] {
  if (!Array.isArray(value)) return []
  const statuses = new Set<ToolActivity["status"]>(["done", "error", "denied", "stopped"])
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return []
    const raw = entry as Partial<ToolActivity> & { status?: unknown }
    if (typeof raw.toolCallId !== "string" || !raw.toolCallId) return []
    const status = statuses.has(raw.status as ToolActivity["status"])
      ? (raw.status as ToolActivity["status"])
      : "stopped"
    return [
      {
        toolCallId: raw.toolCallId,
        toolName: typeof raw.toolName === "string" ? raw.toolName : "tool",
        input: raw.input ?? null,
        output: raw.output ?? null,
        status,
        // Nothing can be awaiting approval in history — the turn that asked is
        // over — so this is always null.
        approvalId: null,
        approved: typeof raw.approved === "boolean" ? raw.approved : null,
        durationMs: typeof raw.durationMs === "number" ? raw.durationMs : null,
        error: typeof raw.error === "string" ? raw.error : null,
      },
    ]
  })
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return []
    const raw = entry as Partial<ChatMessage>
    const role = raw.role === "assistant" ? "assistant" : "user"
    const text = typeof raw.text === "string" ? raw.text : ""
    const attachments = normalizeAttachments(raw.attachments)
    const toolCalls = normalizeToolCalls(raw.toolCalls)
    // A message can be images with no caption, or a turn whose whole output was
    // a page the model browsed to — so neither text nor attachments alone being
    // empty is a reason to drop a row.
    if (!text && attachments.length === 0 && toolCalls.length === 0) return []
    return [{ role, text, attachments, toolCalls }]
  })
}

function base64ByteSize(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.round((base64.length * 3) / 4) - padding)
}

/**
 * Mirrors the image rule in main's attachment registry. Kept as a prefix test
 * rather than an allowlist so a new image type shows a preview instead of
 * silently rendering as a document.
 */
function isImageType(mediaType: string): boolean {
  return mediaType.toLowerCase().startsWith("image/")
}

/**
 * Chat state for a single session. Changing `sessionId` swaps the whole
 * conversation: the stream tail is dropped and the new session's history loads.
 */
export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  // Keyed by tool call id: a task that clicks five things interleaves five
  // runs, and an array would have to be matched up by position.
  const [toolActivity, setToolActivity] = useState<Record<string, ToolActivity>>({})
  const [approvals, setApprovals] = useState<BrowserApproval[]>([])

  /**
   * Mirror of `toolActivity`.
   *
   * Needed because `flushTail` has to read the timeline and store it on the
   * message *in the same* state update. Reading state inside another state
   * updater would be a side effect that React may run twice.
   */
  const toolActivityRef = useRef<Record<string, ToolActivity>>({})

  // The assistant tail accumulates across IPC-delivered deltas ("delta"
  // events with a "text" continuation each) until "done" finalizes it.
  const tailRef = useRef("")

  // Once anything has been sent or received locally, the snapshot returned by
  // `chat:history` is stale — applying it would drop the message that was just
  // added. This matters on the chat window, where the dictation transcript
  // auto-sends on mount at the same time history is loading.
  const hasLocalActivityRef = useRef(false)

  // Stream events name their session; the renderer only ever shows one at a
  // time. Read through a ref so the IPC subscription is registered once.
  const sessionIdRef = useRef(sessionId)
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Wall-clock start per tool call, kept out of state so re-renders never race
  // the stamp. `performance.now()` rather than `Date.now()` so it is immune to
  // the wall clock moving under a long task.
  const toolStartRef = useRef(new Map<string, number>())

  /**
   * Pages the model captured this turn.
   *
   * Held in a ref and drained into the assistant message when it is finalized,
   * so the capture belongs to the reply it was taken for. `localSrc` is filled
   * from the event's bytes: main only writes the attachment row at the end of
   * the turn, so fetching by id would 404 right now.
   */
  const capturesRef = useRef<ChatAttachmentView[]>([])

  /**
   * Merges a patch into one tool's row, creating it if the event arrived first.
   * `tool-call` normally precedes everything else for a given id, but a denied
   * action still has to render, so a missing row cannot be treated as a bug.
   */
  const patchTool = useCallback((toolCallId: string, patch: Partial<ToolActivity>) => {
    const current = toolActivityRef.current[toolCallId] ?? {
      toolCallId,
      toolName: "browser",
      input: undefined,
      output: undefined,
      status: "running" as const,
      approvalId: null,
      approved: null,
      durationMs: null,
      error: null,
      startedAt: performance.now(),
    }
    const next = { ...toolActivityRef.current, [toolCallId]: { ...current, ...patch } }
    toolActivityRef.current = next
    setToolActivity(next)
  }, [])

  const settleTool = useCallback(
    (toolCallId: string) => {
      const started = toolStartRef.current.get(toolCallId)
      toolStartRef.current.delete(toolCallId)
      return started === undefined ? null : Math.max(0, Math.round(performance.now() - started))
    },
    [],
  )

  /**
   * Ends every tool row still spinning, so a turn that stops mid-tool does not
   * leave a permanent "running" marker in the timeline. Denied and errored rows
   * already settled themselves and are left as they are.
   */
  const settleUnfinishedTools = useCallback(() => {
    if (toolStartRef.current.size === 0) return
    toolStartRef.current = new Map()
    const settled: Record<string, ToolActivity> = {}
    for (const [toolCallId, call] of Object.entries(toolActivityRef.current)) {
      // Denied and errored rows settled themselves; leaving them alone keeps
      // "denied" readable instead of overwriting it with a generic message.
      if (call.status !== "running" || call.approved === false) continue
      settled[toolCallId] = {
        ...call,
        status: "stopped",
        durationMs: call.durationMs ?? Math.round(performance.now() - (call.startedAt ?? 0)),
      }
    }
    if (Object.keys(settled).length === 0) return
    const next = { ...toolActivityRef.current, ...settled }
    toolActivityRef.current = next
    setToolActivity(next)
  }, [])

  const flushTail = useCallback(() => {
    const text = tailRef.current
    const captures = capturesRef.current
    tailRef.current = ""
    capturesRef.current = []
    setStreamingText("")
    setStreaming(false)
    // Each terminal event settles whatever was still running *before* the rows
    // are read, so a turn that stops mid-tool records "stopped" rather than a
    // spinner that persists into the reply.
    settleUnfinishedTools()
    const toolCalls = Object.values(toolActivityRef.current).map(toStoredToolCall)
    // The rows now belong to the message, so the live map is cleared here: the
    // caller has no other point where both can be cleared atomically.
    toolActivityRef.current = {}
    setToolActivity({})
    // A capture or a tool call with no text still has to render, or the user
    // sees a page the model opened and no evidence of it.
    if (text || captures.length > 0 || toolCalls.length > 0) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text, attachments: captures, toolCalls: toolCalls as ToolActivity[] },
      ])
    }
  }, [settleUnfinishedTools])

  useEffect(() => {
    return window.electronAPI?.chat.onEvent((event: ChatEvent) => {
      if (event.type === "load-error") {
        setError(
          typeof event.message === "string" ? event.message : "The chat window failed to load.",
        )
        setSending(false)
        return
      }
      // Drop deltas for a conversation the user has already navigated away from.
      if (event.sessionId !== sessionIdRef.current) return
      if (event.type === "delta") {
        const text = typeof event.text === "string" ? event.text : ""
        if (!text) return
        hasLocalActivityRef.current = true
        tailRef.current += text
        setStreamingText(tailRef.current)
        setStreaming(true)
        setError("")
      } else if (event.type === "browser-capture") {
        // Accumulated rather than pushed as its own message: the capture is the
        // assistant reply's evidence, and a separate row would make one turn
        // render as several. `flushTail` attaches them when the reply lands.
        if (typeof event.dataBase64 !== "string" || !event.dataBase64) return
        capturesRef.current = [
          ...capturesRef.current,
          {
            id: event.attachmentId,
            mediaType: event.mediaType,
            fileName: "browser.png",
            width: event.width,
            height: event.height,
            byteSize: base64ByteSize(event.dataBase64),
            // Main writes the attachment row at the end of the turn, so fetching
            // by id would 404 until then; the event already has the bytes.
            localSrc: `data:${event.mediaType};base64,${event.dataBase64}`,
          },
        ]
      } else if (event.type === "tool-call") {
        // A tool call is activity, not a message: it must not flush the tail or
        // mark local history dirty, or a mid-sentence tool call would finalize
        // the assistant's paragraph as a separate turn.
        toolStartRef.current.set(event.toolCallId, performance.now())
        patchTool(event.toolCallId, {
          toolName: event.toolName,
          input: event.input,
          status: "running",
          approvalId: null,
          approved: null,
          durationMs: null,
          error: null,
        })
      } else if (event.type === "tool-result") {
        // Tools report their own failures as `{ error }` rather than by
        // throwing — a failed navigation is a result the model should read and
        // adapt to, not a transport error that should fail the turn. Surfacing
        // it on the row keeps the reason next to the action that caused it.
        const failure =
          typeof event.output === "object" && event.output !== null
            ? (event.output as Record<string, unknown>).error
            : null
        patchTool(event.toolCallId, {
          toolName: event.toolName,
          output: event.output,
          status: "done",
          durationMs: settleTool(event.toolCallId),
          error: typeof failure === "string" ? failure : null,
        })
      } else if (event.type === "approval-request") {
        patchTool(event.toolCallId, {
          toolName: event.toolName,
          input: event.input,
          approvalId: event.approvalId,
        })
        setApprovals((prev) => [
          // Guard against a duplicate id: main parks exactly one request per
          // approval, so a repeat would render the same card twice and both
          // copies would answer the same question.
          ...prev.filter((a) => a.approvalId !== event.approvalId),
          {
            approvalId: event.approvalId,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.input,
            ...(event.reason ? { reason: event.reason } : {}),
          },
        ])
        // The turn is still running, just waiting. Keeping `sending` true is what
        // stops the composer from starting a second turn that main would drop.
        setStreaming(true)
        setError("")
      } else if (event.type === "approval-response") {
        setApprovals((prev) => prev.filter((a) => a.approvalId !== event.approvalId))
        patchTool(event.toolCallId, {
          approved: event.approved,
          approvalId: null,
          // A denial ends the row: the tool never runs, so there is no result
          // coming. Without this it would keep spinning until the turn's
          // terminal event.
          ...(event.approved
            ? {}
            : { status: "done", durationMs: settleTool(event.toolCallId), error: null }),
        })
      } else if (event.type === "done") {
        flushTail()
        setApprovals([])
        setSending(false)
      } else if (event.type === "stopped") {
        // Keep whatever text streamed in before the stop — the user saw it, and
        // it reads as a real (if unfinished) reply.
        flushTail()
        setApprovals([])
        setSending(false)
        settleUnfinishedTools()
      } else {
        flushTail()
        // A turn that ends in an error can still be parked on a dead approval,
        // so clear the prompt rather than leaving an unanswerable card.
        setApprovals([])
        setError(typeof event.message === "string" ? event.message : "The chat request failed.")
        setSending(false)
      }
    })
  }, [flushTail, patchTool, settleTool, settleUnfinishedTools])

  // Switch sessions by clearing local state at the moment of the switch. Doing it
  // in an effect on [sessionId] raced the optimistic send: minting a new session
  // id re-ran the effect and wiped the message the user had just submitted.
  const clearLocal = useCallback(() => {
    tailRef.current = ""
    setMessages([])
    setStreamingText("")
    setStreaming(false)
    setSending(false)
    setError("")
    toolStartRef.current.clear()
    capturesRef.current = []
    toolActivityRef.current = {}
    setToolActivity({})
    setApprovals([])
    hasLocalActivityRef.current = false
  }, [])

  // History lives in SQLite, so a prior conversation survives app restarts. A
  // null session is a brand-new thread: nothing to load.
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    window.electronAPI?.chat.history(sessionId).then((result) => {
      if (cancelled || !result) return
      if (hasLocalActivityRef.current) return
      if (result.ok) setMessages(normalizeMessages(result.messages))
    })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // The session id is passed in rather than read from the closure so the first
  // message of a brand-new thread can mint its own id and send immediately.
  const send = useCallback(
    async (text: string, targetSessionId: string, uploads?: readonly ChatAttachmentUpload[]) => {
      const trimmed = text.trim()
      const files = uploads ?? []
      // Images with no caption are a valid message; nothing at all is not.
      if ((!trimmed && files.length === 0) || sending || !targetSessionId) return
      // Deltas can arrive before React re-renders with the new id, so point the
      // filter at the session we are actually sending to.
      sessionIdRef.current = targetSessionId
      setError("")
      hasLocalActivityRef.current = true
      // A new turn starts with an empty timeline. The previous turn's tool
      // activity is not history, so it is dropped rather than appended — which
      // also clears any card whose approval main has already forgotten.
      toolStartRef.current.clear()
      capturesRef.current = []
      setToolActivity({})
      setApprovals([])
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: trimmed,
          toolCalls: [],
          // Shown from the bytes the renderer already holds, so the message
          // renders with its thumbnails immediately rather than after a reload.
          attachments: files.map((file) => ({
            id: file.id,
            mediaType: file.mediaType,
            fileName: file.fileName,
            width: 0,
            height: 0,
            byteSize: base64ByteSize(file.dataBase64),
            // Only images are previewed, so only images need a data URL. Handing
            // a document's bytes to the UI as well would build a base64 string
            // the size of the file for an icon that never reads it.
            ...(isImageType(file.mediaType)
              ? { localSrc: `data:${file.mediaType};base64,${file.dataBase64}` }
              : {}),
          })),
        },
      ])
      setSending(true)
      const result = await window.electronAPI?.chat.send(trimmed, targetSessionId, files as ChatAttachmentUpload[])
      if (result && !result.ok) {
        setError(typeof result.error === "string" ? result.error : "The chat request failed.")
        setSending(false)
      }
    },
    [sending]
  )

  const history = useCallback(async () => {
    if (!sessionId) return
    const result = await window.electronAPI?.chat.history(sessionId)
    if (!result) return
    if (result.ok) {
      hasLocalActivityRef.current = false
      setMessages(normalizeMessages(result.messages))
      tailRef.current = ""
      setStreamingText("")
      setError("")
    } else {
      setError(typeof result.error === "string" ? result.error : "Could not load chat history.")
    }
  }, [sessionId])

  /**
   * Answers a parked approval.
   *
   * The card is dropped locally *before* the answer is confirmed, so a double
   * click cannot send two decisions: main rejects the second id as unknown, and
   * that error is what surfaces instead of a silently wrong action. The tool row
   * is marked from the `approval-response` event, which is the only place the
   * decision is actually observed.
   */
  const respondToApproval = useCallback(async (approvalId: string, approved: boolean) => {
    const pending = approvals.find((a) => a.approvalId === approvalId)
    setApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId))
    const result = await window.electronAPI?.chat.respondToApproval(approvalId, approved)
    if (result && !result.ok) {
      // Nothing to answer any more: put the card back so the decision is not
      // lost, and say why.
      if (pending) {
        setApprovals((prev) => [...prev.filter((a) => a.approvalId !== approvalId), pending])
      }
      setError(typeof result.error === "string" ? result.error : "Could not answer the approval.")
    }
  }, [approvals])

  const reset = useCallback(async () => {
    if (!sessionId) return
    const result = await window.electronAPI?.chat.reset(sessionId)
    if (!result) return
    if (result.ok) {
      hasLocalActivityRef.current = false
      setMessages([])
      tailRef.current = ""
      setStreamingText("")
      setStreaming(false)
      setSending(false)
      setError("")
      toolStartRef.current.clear()
      capturesRef.current = []
      setToolActivity({})
      setApprovals([])
    } else {
      setError(result.error)
    }
  }, [sessionId])

  return {
    messages,
    streamingText,
    streaming,
    sending,
    error,
    toolActivity,
    approvals,
    respondToApproval,
    send,
    history,
    reset,
    clearLocal,
  }
}

/**
 * Lazily resolves attachment bytes for a history thumbnail.
 *
 * History carries metadata only, so a conversation with a dozen screenshots
 * would otherwise ship megabytes to draw a 200px preview. Attachments that came
 * from the current composer already carry a `localSrc` and never hit this.
 *
 * Non-image attachments are skipped outright: they render as a file icon, so
 * fetching a PDF's bytes to display a glyph would be pure waste.
 */
export function useAttachmentSrc(attachment: ChatAttachmentView | undefined): string {
  const localSrc = attachment?.localSrc
  const id = attachment?.id
  const fetchable = attachment ? isImageType(attachment.mediaType) : false
  // The result is stored keyed by id rather than cleared on change, so the
  // effect never has to reset state synchronously — a stale entry simply fails
  // the `fetched.id === id` check and reads as "not loaded yet".
  const [fetched, setFetched] = useState<{ id: string; src: string } | null>(null)

  useEffect(() => {
    if (localSrc || !id || !fetchable) return
    let cancelled = false
    void window.electronAPI?.chat.attachmentData(id).then((result) => {
      if (cancelled || !result?.ok) return
      setFetched({ id, src: `data:${result.mediaType};base64,${result.dataBase64}` })
    })
    return () => {
      cancelled = true
    }
  }, [id, localSrc, fetchable])

  if (localSrc) return localSrc
  return fetched && fetched.id === id ? fetched.src : ""
}
