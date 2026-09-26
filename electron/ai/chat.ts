import { asc, eq } from "drizzle-orm"
import { ToolLoopAgent, type ModelMessage } from "ai"

import { getDb } from "../db/index.js"
import { chatMessages } from "../db/schema.js"
import { resolveModel } from "./provider.js"
import { autoTitleSession, clearSessionMessages, ensureSession, touchSession } from "./sessions.js"

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

export interface AiError {
  ok: false
  error: string
}

export type ChatSendResult = { ok: true } | AiError
export type ChatHistoryResult = { ok: true; messages: ChatMessage[] } | AiError

// `sessionId` rides along on every event so a renderer that switched threads
// mid-stream can drop deltas belonging to the conversation it just left.
// `load-error` is app-level and deliberately has no session.
export type ChatStreamEvent =
  | { type: "delta"; sessionId: string; text: string }
  | { type: "done"; sessionId: string }
  | { type: "error"; sessionId: string; message: string }
  | { type: "load-error"; message: string }

const CHAT_INSTRUCTIONS =
  "You are a concise assistant embedded in a macOS dictation app. The user dictates technical " +
  "notes and sends them to you for discussion. Answer directly and prefer short, well-structured " +
  "responses. Use markdown for code blocks and lists."

const listeners = new Set<(event: ChatStreamEvent) => void>()

let activeStream: AbortController | null = null

function emit(event: ChatStreamEvent): void {
  for (const listener of listeners) listener(event)
}

export function onChatEvent(listener: (event: ChatStreamEvent) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function abortActiveStream(): void {
  activeStream?.abort()
  activeStream = null
}

async function insertMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await getDb()
    .insert(chatMessages)
    .values({ sessionId, role, content, createdAt: new Date() })
    .run()
}

async function loadRows(sessionId: string): Promise<ChatMessage[]> {
  const rows = await getDb()
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.id))
    .all()
  return rows.map((row) => ({ role: row.role, text: row.content }))
}

async function loadHistory(sessionId: string): Promise<ModelMessage[]> {
  return (await loadRows(sessionId)).map((row) => ({ role: row.role, content: row.text }))
}

export async function getChatHistory(sessionId: string): Promise<ChatHistoryResult> {
  try {
    return { ok: true, messages: await loadRows(sessionId) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to load chat history: ${message}` }
  }
}

export async function sendChatMessage(text: string, sessionId: string): Promise<ChatSendResult> {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: "Message is empty." }
  if (!sessionId) return { ok: false, error: "No chat session is open." }

  let agent: ToolLoopAgent
  try {
    agent = new ToolLoopAgent({ model: await resolveModel(), instructions: CHAT_INSTRUCTIONS })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }

  let messages: ModelMessage[]
  try {
    const ensured = await ensureSession(sessionId)
    if (!ensured.ok) return ensured
    await autoTitleSession(sessionId, trimmed)
    await insertMessage(sessionId, "user", trimmed)
    await touchSession(sessionId)
    messages = await loadHistory(sessionId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to save message: ${message}` }
  }

  activeStream?.abort()
  const controller = new AbortController()
  activeStream = controller

  void (async () => {
    let full = ""
    try {
      const result = await agent.stream({ messages, abortSignal: controller.signal })
      // `textStream` silently drops error parts, which would turn a failed
      // request into a bogus "done", so consume the full part stream instead.
      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          full += part.text
          emit({ type: "delta", sessionId, text: part.text })
        } else if (part.type === "error") {
          const err = part.error
          const message = err instanceof Error ? err.message : String(err)
          emit({ type: "error", sessionId, message })
          return
        } else if (part.type === "abort") {
          return
        }
      }
      const finalText = full.trim()
      if (finalText) {
        await insertMessage(sessionId, "assistant", finalText)
        await touchSession(sessionId)
      }
      emit({ type: "done", sessionId })
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : String(err)
      emit({ type: "error", sessionId, message })
    } finally {
      if (activeStream === controller) activeStream = null
    }
  })()

  return { ok: true }
}

export async function resetChat(sessionId: string): Promise<ChatSendResult> {
  abortActiveStream()
  try {
    await clearSessionMessages(sessionId)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to reset chat: ${message}` }
  }
}
