"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

type ChatEvent =
  | { type: "delta"; sessionId: string; text: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; sessionId: string; message: string }
  | { type: "load-error"; message: string }

// The preload cast cannot guarantee the shape of a payload from another
// process, so coerce before it reaches state that the panel maps over.
function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return []
    const raw = entry as Partial<ChatMessage>
    if (typeof raw.text !== "string" || !raw.text) return []
    const role = raw.role === "assistant" ? "assistant" : "user"
    return [{ role, text: raw.text }]
  })
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
      setMessages((prev) => [...prev, { role: "assistant", text }])
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
    async (text: string, targetSessionId: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending || !targetSessionId) return
      // Deltas can arrive before React re-renders with the new id, so point the
      // filter at the session we are actually sending to.
      sessionIdRef.current = targetSessionId
      setError("")
      hasLocalActivityRef.current = true
      setMessages((prev) => [...prev, { role: "user", text: trimmed }])
      setSending(true)
      const result = await window.electronAPI?.chat.send(trimmed, targetSessionId)
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
