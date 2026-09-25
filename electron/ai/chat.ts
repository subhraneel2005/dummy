import { asc, eq } from "drizzle-orm"
import { ToolLoopAgent, type ModelMessage } from "ai"

import { getDb } from "../db/index.js"
import { chatMessages } from "../db/schema.js"
import { resolveModel } from "./provider.js"

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

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

const DEFAULT_SESSION_ID = "default"

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

async function insertMessage(role: "user" | "assistant", content: string): Promise<void> {
  await getDb()
    .insert(chatMessages)
    .values({ sessionId: DEFAULT_SESSION_ID, role, content, createdAt: new Date() })
    .run()
}

async function loadRows(): Promise<ChatMessage[]> {
  const rows = await getDb()
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, DEFAULT_SESSION_ID))
    .orderBy(asc(chatMessages.id))
    .all()
  return rows.map((row) => ({ role: row.role, text: row.content }))
}

async function loadHistory(): Promise<ModelMessage[]> {
  return (await loadRows()).map((row) => ({ role: row.role, content: row.text }))
}

export async function getChatHistory(): Promise<ChatHistoryResult> {
  try {
    return { ok: true, messages: await loadRows() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to load chat history: ${message}` }
  }
}

export async function sendChatMessage(text: string): Promise<ChatSendResult> {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: "Message is empty." }

  let agent: ToolLoopAgent
  try {
    agent = new ToolLoopAgent({ model: await resolveModel(), instructions: CHAT_INSTRUCTIONS })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }

  let messages: ModelMessage[]
  try {
    await insertMessage("user", trimmed)
    messages = await loadHistory()
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
          emit({ type: "delta", text: part.text })
        } else if (part.type === "error") {
          const err = part.error
          const message = err instanceof Error ? err.message : String(err)
          emit({ type: "error", message })
          return
        } else if (part.type === "abort") {
          return
        }
      }
      const finalText = full.trim()
      if (finalText) await insertMessage("assistant", finalText)
      emit({ type: "done" })
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : String(err)
      emit({ type: "error", message })
    } finally {
      if (activeStream === controller) activeStream = null
    }
  })()

  return { ok: true }
}

export async function resetChat(): Promise<ChatSendResult> {
  activeStream?.abort()
  activeStream = null
  try {
    await getDb().delete(chatMessages).where(eq(chatMessages.sessionId, DEFAULT_SESSION_ID)).run()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to reset chat: ${message}` }
  }
}
