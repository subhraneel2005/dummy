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
}

type ChatEvent =
  | { type: "delta"; sessionId: string; text: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; sessionId: string; message: string }
  | { type: "load-error"; message: string }

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

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return []
    const raw = entry as Partial<ChatMessage>
    const role = raw.role === "assistant" ? "assistant" : "user"
    const text = typeof raw.text === "string" ? raw.text : ""
    const attachments = normalizeAttachments(raw.attachments)
    // A message can be images with no caption, so empty text alone is not a
    // reason to drop a row — that would silently discard attachment-only turns.
    if (!text && attachments.length === 0) return []
    return [{ role, text, attachments }]
  })
}

function base64ByteSize(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.round((base64.length * 3) / 4) - padding)
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

  const flushTail = useCallback(() => {
    const text = tailRef.current
    tailRef.current = ""
    setStreamingText("")
    setStreaming(false)
    if (text) {
      setMessages((prev) => [...prev, { role: "assistant", text, attachments: [] }])
    }
  }, [])

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
      } else if (event.type === "done") {
        flushTail()
        setSending(false)
      } else {
        flushTail()
        setError(typeof event.message === "string" ? event.message : "The chat request failed.")
        setSending(false)
      }
    })
  }, [flushTail])

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
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: trimmed,
          // Shown from the bytes the renderer already holds, so the message
          // renders with its thumbnails immediately rather than after a reload.
          attachments: files.map((file) => ({
            id: file.id,
            mediaType: file.mediaType,
            fileName: file.fileName,
            width: 0,
            height: 0,
            byteSize: base64ByteSize(file.dataBase64),
            localSrc: `data:${file.mediaType};base64,${file.dataBase64}`,
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
    } else {
      setError(result.error)
    }
  }, [sessionId])

  return { messages, streamingText, streaming, sending, error, send, history, reset, clearLocal }
}

/**
 * Lazily resolves attachment bytes for a history thumbnail.
 *
 * History carries metadata only, so a conversation with a dozen screenshots
 * would otherwise ship megabytes to draw a 200px preview. Attachments that came
 * from the current composer already carry a `localSrc` and never hit this.
 */
export function useAttachmentSrc(attachment: ChatAttachmentView | undefined): string {
  const localSrc = attachment?.localSrc
  const id = attachment?.id
  // The result is stored keyed by id rather than cleared on change, so the
  // effect never has to reset state synchronously — a stale entry simply fails
  // the `fetched.id === id` check and reads as "not loaded yet".
  const [fetched, setFetched] = useState<{ id: string; src: string } | null>(null)

  useEffect(() => {
    if (localSrc || !id) return
    let cancelled = false
    void window.electronAPI?.chat.attachmentData(id).then((result) => {
      if (cancelled || !result?.ok) return
      setFetched({ id, src: `data:${result.mediaType};base64,${result.dataBase64}` })
    })
    return () => {
      cancelled = true
    }
  }, [id, localSrc])

  if (localSrc) return localSrc
  return fetched && fetched.id === id ? fetched.src : ""
}
