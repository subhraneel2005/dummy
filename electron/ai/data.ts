import fs from "node:fs/promises"
import path from "node:path"

import { app } from "electron"

import { getDb } from "../db/index.js"
import {
  chatAttachments,
  chatMessages,
  chatSessions,
  chatToolCalls,
  providerKeys,
  settings,
} from "../db/schema.js"
import { screenshotsDir } from "./attachments.js"

/** What was on disk/DB before a wipe, so the UI can report real numbers. */
export interface DataCounts {
  messages: number
  sessions: number
  attachments: number
  attachmentsBytes: number
  toolCalls: number
  savedKeys: number
}

/**
 * A wipe is two halves that must stay in step:
 *
 *  - the rows, and
 *  - the bytes behind them.
 *
 * Deleting `chat_attachments` rows without the files leaks a screenshot per
 * message forever, since nothing else ever walks the screenshots directory.
 * Deleting files without the rows leaves ghost rows whose thumbnail reads fail.
 *
 * The screenshots directory is removed wholesale (rather than walking the rows),
 * because it also holds `staging/` leftovers and any orphaned bytes that no row
 * points at — "free the space" should free all of it. `/deep-tasks` is the
 * Feature 6 workspace root; it does not exist yet, so `force: true` is what
 * keeps this future-proof at zero cost today.
 */

export async function deleteAllAttachments(): Promise<{
  deleted: number
  freedBytes: number
}> {
  const db = getDb()
  const rows = await db
    .select({ path: chatAttachments.path, byteSize: chatAttachments.byteSize })
    .from(chatAttachments)
    .all()
  const freedBytes = rows.reduce((sum, row) => sum + row.byteSize, 0)
  await db.delete(chatAttachments).run()
  await fs.rm(screenshotsDir(), { recursive: true, force: true })
  return { deleted: rows.length, freedBytes }
}

export async function deleteAllData(): Promise<{
  counts: DataCounts
  freedBytes: number
}> {
  const db = getDb()
  const [messages, sessions, attachments, toolCalls, keys] = await Promise.all([
    db.select({ id: chatMessages.id }).from(chatMessages).all(),
    db.select({ id: chatSessions.id }).from(chatSessions).all(),
    db
      .select({ path: chatAttachments.path, byteSize: chatAttachments.byteSize })
      .from(chatAttachments)
      .all(),
    db.select({ id: chatToolCalls.id }).from(chatToolCalls).all(),
    db.select({ provider: providerKeys.provider }).from(providerKeys).all(),
  ])
  const freedBytes = attachments.reduce((sum, row) => sum + row.byteSize, 0)

  // One transaction so a mid-wipe failure cannot leave history without its
  // keys or a key without its provider. Files are removed after it commits.
  await db.transaction(async (tx) => {
    await tx.delete(chatToolCalls).run()
    await tx.delete(chatAttachments).run()
    await tx.delete(chatMessages).run()
    await tx.delete(chatSessions).run()
    await tx.delete(providerKeys).run()
    await tx.delete(settings).run()
  })

  await Promise.all([
    fs.rm(screenshotsDir(), { recursive: true, force: true }),
    fs.rm(path.join(app.getPath("userData"), "deep-tasks"), { recursive: true, force: true }),
  ])

  return {
    counts: {
      messages: messages.length,
      sessions: sessions.length,
      attachments: attachments.length,
      attachmentsBytes: freedBytes,
      toolCalls: toolCalls.length,
      savedKeys: keys.length,
    },
    freedBytes,
  }
}