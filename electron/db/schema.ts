import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

export const providerKeys = sqliteTable("provider_keys", {
  provider: text("provider").primaryKey(),
  encryptedKey: text("encrypted_key").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export type ChatRole = "user" | "assistant"

// A chat session is the unit the sidebar lists. `chat_messages.sessionId`
// already points at one of these; it stays a plain text column so existing rows
// keep working without a backfill.
export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    role: text("role").$type<ChatRole>().notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("chat_messages_session_idx").on(table.sessionId)],
)

/**
 * Screenshots and picked files sent alongside a message.
 *
 * `session_id` is denormalised alongside `message_id` so a session can be
 * cleaned up (rows *and* files) with a single predicate instead of a join, which
 * matters because deleting the session has to delete the PNGs too.
 *
 * `path` is always written by this process — the renderer never supplies one —
 * so there is no path-traversal surface on the way in.
 */
export const chatAttachments = sqliteTable(
  "chat_attachments",
  {
    id: text("id").primaryKey(),
    messageId: integer("message_id").notNull(),
    position: integer("position").notNull(),
    sessionId: text("session_id").notNull(),
    mediaType: text("media_type").notNull(),
    fileName: text("file_name").notNull(),
    path: text("path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    byteSize: integer("byte_size").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("chat_attachments_message_idx").on(table.messageId),
    index("chat_attachments_session_idx").on(table.sessionId),
  ],
)

export const schema = { settings, providerKeys, chatSessions, chatMessages, chatAttachments }
