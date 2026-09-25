import path from "node:path"
import { fileURLToPath } from "node:url"

import { createClient, type Client } from "@libsql/client"
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"
import type { EmptyRelations } from "drizzle-orm/relations"
import { app } from "electron"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Migrations live in a committed top-level `drizzle/` folder. This file compiles
// to `dist/db/index.js`, so the dev layout resolves as `../../drizzle` from here.
// There is no packager config in the repo yet; once one is added, ship the folder
// as an extraResource and it will be read from `process.resourcesPath` instead.
export const MIGRATIONS_FOLDER = app.isPackaged
  ? path.join(process.resourcesPath, "drizzle")
  : path.join(__dirname, "..", "..", "drizzle")

export type Db = LibSQLDatabase<EmptyRelations> & { $client: Client }

let client: Client | null = null
let db: Db | null = null

export function databasePath(): string {
  return path.join(app.getPath("userData"), "app.db")
}

export function initDb(): Db {
  if (db) return db

  const file = databasePath()
  client = createClient({ url: `file:${file}` })
  const created = drizzle({ client })
  db = created
  return created
}

export function getDb(): Db {
  if (!db) throw new Error("Database not initialised")
  return db
}

export async function migrateDb(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: MIGRATIONS_FOLDER })
}

export function closeDb(): void {
  client?.close()
  client = null
  db = null
}
