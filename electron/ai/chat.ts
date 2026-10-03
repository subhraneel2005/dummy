import { readFile } from "node:fs/promises"

import { asc, eq } from "drizzle-orm"
import { ToolLoopAgent, type FilePart, type ModelMessage, type TextPart, type UserContent } from "ai"

import { getDb, type Db } from "../db/index.js"
import { chatAttachments, chatMessages } from "../db/schema.js"
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  decodeAttachment,
  deleteAttachmentFiles,
  storeAttachment,
  type StoredAttachment,
} from "./attachments.js"
import { resolveModel } from "./provider.js"
import { autoTitleSession, clearSessionMessages, ensureSession, touchSession } from "./sessions.js"

/**
 * Attachment metadata for the renderer. Deliberately no `path` and no bytes:
 * the path is meaningless outside main, and shipping every screenshot in the
 * history payload would make opening a session cost megabytes.
 */
export interface ChatAttachmentMeta {
  id: string
  mediaType: string
  fileName: string
  width: number
  height: number
  byteSize: number
}

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
  attachments: ChatAttachmentMeta[]
}

/** An attachment as it arrives from the renderer over IPC. */
export interface IncomingAttachment {
  id: string
  mediaType: string
  fileName: string
  dataBase64: string
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
  "responses. Use markdown for code blocks and lists. Screenshots may be attached to a message " +
  "as images of whatever was on the user's screen at that moment — read them when the question " +
  "refers to them, and say so plainly if an image does not actually show what was asked about."

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

/** Either the database or an open transaction — both can insert. */
type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]

async function insertMessage(
  db: Executor,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<number> {
  const inserted = await db
    .insert(chatMessages)
    .values({ sessionId, role, content, createdAt: new Date() })
    .returning({ id: chatMessages.id })
    .get()
  return inserted.id
}

async function insertAttachment(
  db: Executor,
  sessionId: string,
  messageId: number,
  position: number,
  stored: StoredAttachment,
): Promise<void> {
  await db
    .insert(chatAttachments)
    .values({
      id: stored.id,
      messageId,
      position,
      sessionId,
      mediaType: stored.mediaType,
      fileName: stored.fileName,
      path: stored.path,
      width: stored.width,
      height: stored.height,
      byteSize: stored.byteSize,
      createdAt: new Date(),
    })
    .run()
}

async function loadRows(sessionId: string): Promise<ChatMessage[]> {
  const db = getDb()
  const rows = await db
    .select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.id))
    .all()

  const attachmentRows = await db
    .select({
      id: chatAttachments.id,
      messageId: chatAttachments.messageId,
      mediaType: chatAttachments.mediaType,
      fileName: chatAttachments.fileName,
      width: chatAttachments.width,
      height: chatAttachments.height,
      byteSize: chatAttachments.byteSize,
    })
    .from(chatAttachments)
    .where(eq(chatAttachments.sessionId, sessionId))
    // `id` is a UUID, so it cannot order anything; `position` is the order the
    // user arranged the attachments in.
    .orderBy(asc(chatAttachments.messageId), asc(chatAttachments.position))
    .all()

  const byMessage = new Map<number, ChatAttachmentMeta[]>()
  for (const attachment of attachmentRows) {
    const list = byMessage.get(attachment.messageId) ?? []
    list.push({
      id: attachment.id,
      mediaType: attachment.mediaType,
      fileName: attachment.fileName,
      width: attachment.width,
      height: attachment.height,
      byteSize: attachment.byteSize,
    })
    byMessage.set(attachment.messageId, list)
  }

  return rows.map((row) => ({
    role: row.role,
    text: row.content,
    attachments: byMessage.get(row.id) ?? [],
  }))
}

/**
 * Rebuilds the model prompt.
 *
 * History is **text only** — a screenshot is used in model context exactly
 * once, on the turn it was captured for. Re-hydrating every image on every turn
 * would make each request cost grow with the length of the conversation, and
 * the images stay on disk for the UI either way.
 */
async function loadHistory(sessionId: string): Promise<ModelMessage[]> {
  return (await loadRows(sessionId)).map((row) => ({ role: row.role, content: row.text }))
}

async function buildUserContent(
  text: string,
  attachments: readonly StoredAttachment[],
): Promise<UserContent> {
  if (attachments.length === 0) return text
  const parts: Array<TextPart | FilePart> = []
  for (const attachment of attachments) {
    parts.push({
      type: "file",
      mediaType: attachment.mediaType,
      filename: attachment.fileName,
      // `FilePart`, not `ImagePart`: the latter is deprecated in ai@7.
      data: { type: "data", data: await readFile(attachment.path) },
    })
  }
  return text ? [{ type: "text", text }, ...parts] : parts
}

export async function getChatHistory(sessionId: string): Promise<ChatHistoryResult> {
  try {
    return { ok: true, messages: await loadRows(sessionId) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to load chat history: ${message}` }
  }
}

/** Base64 bytes for one stored attachment, fetched on demand for a thumbnail. */
export async function getAttachmentData(
  attachmentId: string,
): Promise<{ ok: true; mediaType: string; dataBase64: string } | AiError> {
  try {
    const row = await getDb()
      .select({ path: chatAttachments.path, mediaType: chatAttachments.mediaType })
      .from(chatAttachments)
      .where(eq(chatAttachments.id, attachmentId))
      .get()
    if (!row) return { ok: false, error: "Attachment not found." }
    return {
      ok: true,
      mediaType: row.mediaType,
      dataBase64: (await readFile(row.path)).toString("base64"),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to read attachment: ${message}` }
  }
}

function validateAttachments(raw: unknown): IncomingAttachment[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw new Error("Attachments must be a list.")
  if (raw.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new Error(`At most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message.`)
  }
  return raw.map((entry) => {
    const item = entry as Partial<IncomingAttachment>
    if (typeof item?.id !== "string") throw new Error("Attachment is missing an id.")
    if (typeof item.mediaType !== "string") throw new Error("Attachment is missing a media type.")
    if (typeof item.fileName !== "string") throw new Error("Attachment is missing a filename.")
    if (typeof item.dataBase64 !== "string") throw new Error("Attachment is missing its data.")
    return {
      id: item.id,
      mediaType: item.mediaType,
      fileName: item.fileName,
      dataBase64: item.dataBase64,
    }
  })
}

export async function sendChatMessage(
  text: string,
  sessionId: string,
  incoming?: unknown,
): Promise<ChatSendResult> {
  const trimmed = text.trim()
  if (!sessionId) return { ok: false, error: "No chat session is open." }

  let attachments: IncomingAttachment[]
  try {
    attachments = validateAttachments(incoming)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
  // A message can be images with no caption, but it cannot be nothing at all.
  if (!trimmed && attachments.length === 0) return { ok: false, error: "Message is empty." }

  let agent: ToolLoopAgent
  try {
    agent = new ToolLoopAgent({ model: await resolveModel(), instructions: CHAT_INSTRUCTIONS })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }

  let messages: ModelMessage[]
  // Files are written outside SQL, so a failure after the first one would
  // otherwise leave PNGs on disk that no row points at. They are unlinked
  // explicitly if the transaction below throws.
  const writtenPaths: string[] = []
  try {
    const ensured = await ensureSession(sessionId)
    if (!ensured.ok) return ensured
    await autoTitleSession(sessionId, trimmed)

    // History is read before this turn is written, so the new message is simply
    // appended — no need to load everything and drop the last row again.
    const history = await loadHistory(sessionId)

    const stored = await getDb().transaction(async (tx) => {
      const messageId = await insertMessage(tx, sessionId, "user", trimmed)
      const records: StoredAttachment[] = []
      for (const [index, attachment] of attachments.entries()) {
        const { bytes } = decodeAttachment(
          attachment.id,
          attachment.mediaType,
          attachment.fileName,
          attachment.dataBase64,
        )
        // `storeAttachment` mints the permanent id, so two messages can each
        // reference the same draft attachment without colliding.
        const record = await storeAttachment(
          attachment.id,
          bytes,
          attachment.mediaType,
          attachment.fileName,
        )
        writtenPaths.push(record.path)
        await insertAttachment(tx, sessionId, messageId, index, record)
        records.push(record)
      }
      return records
    })

    await touchSession(sessionId)
    // History as plain text, then the new turn with its images.
    messages = [...history, { role: "user", content: await buildUserContent(trimmed, stored) }]
  } catch (err) {
    await deleteAttachmentFiles(writtenPaths)
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
        await insertMessage(getDb(), sessionId, "assistant", finalText)
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
