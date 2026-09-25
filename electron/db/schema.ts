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

export const schema = { settings, providerKeys, chatMessages }
