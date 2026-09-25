"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

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

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  // The assistant tail accumulates across IPC-delivered deltas ("delta"
  // events with a "text" continuation each) until "done" finalizes it.
  const tailRef = useRef("")

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
      if (event.type === "delta") {
        const text = typeof event.text === "string" ? event.text : ""
        if (!text) return
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

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      setError("")
      setMessages((prev) => [...prev, { role: "user", text: trimmed }])
      setSending(true)
      const result = await window.electronAPI?.chat.send(trimmed)
      if (result && !result.ok) {
        setError(typeof result.error === "string" ? result.error : "The chat request failed.")
        setSending(false)
      }
    },
    [sending]
  )

  const history = useCallback(async () => {
    const result = await window.electronAPI?.chat.history()
    if (!result) return
    if (result.ok) {
      setMessages(normalizeMessages(result.messages))
      tailRef.current = ""
      setStreamingText("")
      setError("")
    } else {
      setError(typeof result.error === "string" ? result.error : "Could not load chat history.")
    }
  }, [])

  // History now lives in SQLite, so a prior conversation survives app restarts.
  useEffect(() => {
    let cancelled = false
    window.electronAPI?.chat.history().then((result) => {
      if (cancelled || !result) return
      if (result.ok) setMessages(result.messages)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const reset = useCallback(async () => {
    const result = await window.electronAPI?.chat.reset()
    if (!result) return
    if (result.ok) {
      setMessages([])
      tailRef.current = ""
      setStreamingText("")
      setStreaming(false)
      setSending(false)
      setError("")
    } else {
      setError(result.error)
    }
  }, [])

  return { messages, streamingText, streaming, sending, error, send, history, reset }
}
