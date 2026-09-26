import { and, desc, eq, sql } from "drizzle-orm"

import { getDb } from "../db/index.js"
import { chatMessages, chatSessions } from "../db/schema.js"

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export type SessionsResult = { ok: true; sessions: ChatSession[] } | { ok: false; error: string }
export type SessionResult = { ok: true; session: ChatSession } | { ok: false; error: string }
export type OkResult = { ok: true } | { ok: false; error: string }

export const DEFAULT_SESSION_TITLE = "New chat"

// Keeps the sidebar readable: derive a title from the opening message and clip
// it on a word boundary so rows don't end mid-word.
export function titleFromMessage(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (!flat) return DEFAULT_SESSION_TITLE
  if (flat.length <= 48) return flat
  const clipped = flat.slice(0, 48)
  const lastSpace = clipped.lastIndexOf(" ")
  return `${(lastSpace > 24 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

function toSession(row: typeof chatSessions.$inferSelect): ChatSession {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

/**
 * Creates the session row on first use. Sessions are created lazily by the
 * renderer, which owns the id, so an abandoned "New chat" never leaves an empty
 * row in the sidebar.
 */
export async function ensureSession(id: string): Promise<SessionResult> {
  try {
    const db = getDb()
    const existing = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, id))
      .get()
    if (existing) return { ok: true, session: toSession(existing) }

    const now = new Date()
    const row: typeof chatSessions.$inferSelect = {
      id,
      title: DEFAULT_SESSION_TITLE,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(chatSessions).values(row).run()
    return { ok: true, session: toSession(row) }
  } catch (err) {
    return { ok: false, error: errMessage(err, "ensure session") }
  }
}

export async function listSessions(): Promise<SessionsResult> {
  try {
    const rows = await getDb()
      .select()
      .from(chatSessions)
      // Hide sessions that never received a message, so a thread the user
      // started and abandoned doesn't linger as an empty row.
      .where(
        sql`exists (select 1 from ${chatMessages} where ${chatMessages.sessionId} = ${chatSessions.id})`,
      )
      .orderBy(desc(chatSessions.updatedAt))
      .all()
    return { ok: true, sessions: rows.map(toSession) }
  } catch (err) {
    return { ok: false, error: errMessage(err, "list sessions") }
  }
}

export async function renameSession(id: string, title: string): Promise<SessionResult> {
  const trimmed = title.replace(/\s+/g, " ").trim()
  if (!trimmed) return { ok: false, error: "Title is empty." }
  try {
    const db = getDb()
    await db
      .update(chatSessions)
      .set({ title: trimmed.slice(0, 120), updatedAt: new Date() })
      .where(eq(chatSessions.id, id))
      .run()
    const row = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).get()
    if (!row) return { ok: false, error: "Session not found." }
    return { ok: true, session: toSession(row) }
  } catch (err) {
    return { ok: false, error: errMessage(err, "rename session") }
  }
}

export async function deleteSession(id: string): Promise<OkResult> {
  try {
    const db = getDb()
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, id)).run()
    await db.delete(chatSessions).where(eq(chatSessions.id, id)).run()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errMessage(err, "delete session") }
  }
}

export async function clearSessionMessages(id: string): Promise<OkResult> {
  try {
    await getDb().delete(chatMessages).where(eq(chatMessages.sessionId, id)).run()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errMessage(err, "clear session") }
  }
}

/** Bumps `updatedAt` so the active thread sorts to the top of the sidebar. */
export async function touchSession(id: string): Promise<void> {
  try {
    await getDb()
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, id))
      .run()
  } catch {
    // Ordering is cosmetic; never fail a send because of it.
  }
}

/** Names an untitled session after its first user message. */
export async function autoTitleSession(id: string, text: string): Promise<void> {
  try {
    const db = getDb()
    await db
      .update(chatSessions)
      .set({ title: titleFromMessage(text) })
      .where(and(eq(chatSessions.id, id), eq(chatSessions.title, DEFAULT_SESSION_TITLE)))
      .run()
  } catch {
    // A default title is a fine fallback.
  }
}

function errMessage(err: unknown, action: string): string {
  const detail = err instanceof Error ? err.message : String(err)
  return `Failed to ${action}: ${detail}`
}
