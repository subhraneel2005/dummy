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

export const schema = { settings, providerKeys, chatSessions, chatMessages }
