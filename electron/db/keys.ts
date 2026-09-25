import { eq } from "drizzle-orm"
import { safeStorage } from "electron"

import { getDb } from "./index.js"
import { providerKeys } from "./schema.js"

export class EncryptionUnavailableError extends Error {
  constructor() {
    super("OS key encryption is unavailable, so the API key cannot be stored safely.")
    this.name = "EncryptionUnavailableError"
  }
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export async function setProviderKey(provider: string, key: string): Promise<void> {
  if (!isEncryptionAvailable()) throw new EncryptionUnavailableError()
  const encrypted = safeStorage.encryptString(key).toString("base64")
  await getDb()
    .insert(providerKeys)
    .values({ provider, encryptedKey: encrypted, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: providerKeys.provider,
      set: { encryptedKey: encrypted, updatedAt: new Date() },
    })
    .run()
}

export async function clearProviderKey(provider: string): Promise<void> {
  await getDb().delete(providerKeys).where(eq(providerKeys.provider, provider)).run()
}

/** Returns the decrypted key, or null when the provider has no stored key. */
export async function getProviderKey(provider: string): Promise<string | null> {
  if (!isEncryptionAvailable()) return null
  const row = await getDb()
    .select({ encryptedKey: providerKeys.encryptedKey })
    .from(providerKeys)
    .where(eq(providerKeys.provider, provider))
    .get()
  if (!row) return null
  return safeStorage.decryptString(Buffer.from(row.encryptedKey, "base64"))
}
