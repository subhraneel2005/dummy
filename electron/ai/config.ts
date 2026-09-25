import { eq } from "drizzle-orm"

import { getDb } from "../db/index.js"
import { clearProviderKey, getProviderKey, isEncryptionAvailable, setProviderKey } from "../db/keys.js"
import { settings } from "../db/schema.js"
import { MODEL_CATALOG, PROVIDERS, isProviderId, type ProviderId } from "./models.js"
const PROVIDER_KEY = "selected_provider"
const MODEL_KEY = "selected_model"

export interface AiConfig {
  provider: ProviderId | null
  model: string | null
  hasKey: boolean
  encryptionAvailable: boolean
}

async function readSetting(key: string): Promise<string | null> {
  const row = await getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  return row?.value ?? null
}

async function writeSetting(key: string, value: string): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run()
}

export async function getProvider(): Promise<ProviderId | null> {
  const value = await readSetting(PROVIDER_KEY)
  return value && isProviderId(value) ? value : null
}

export async function getModel(): Promise<string | null> {
  return readSetting(MODEL_KEY)
}

export async function providerHasKey(provider: ProviderId): Promise<boolean> {
  return (await getProviderKey(provider)) !== null
}

export async function getConfig(): Promise<AiConfig> {
  const provider = await getProvider()
  return {
    provider,
    model: await getModel(),
    hasKey: provider ? await providerHasKey(provider) : false,
    encryptionAvailable: isEncryptionAvailable(),
  }
}

export async function setProvider(provider: ProviderId): Promise<void> {
  if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider: ${provider}`)
  const current = await getProvider()
  await writeSetting(PROVIDER_KEY, provider)
  // A model id from a different provider is meaningless, so clear it on switch.
  if (current !== provider) await writeSetting(MODEL_KEY, "")
}

export async function setModel(modelId: string): Promise<void> {
  const provider = await getProvider()
  if (!provider) throw new Error("Select a provider before choosing a model")
  // Only sanity-check the shape. The picker is populated from each provider's
  // live `list models` endpoint, so the id will often not be in the seed
  // catalog; validating against `MODEL_CATALOG` would reject valid models.
  if (!modelId || /\s/.test(modelId)) throw new Error("Invalid model id")
  await writeSetting(MODEL_KEY, modelId)
}

export async function setApiKey(provider: ProviderId, key: string): Promise<void> {
  await setProviderKey(provider, key)
}

export async function clearApiKey(provider: ProviderId): Promise<void> {
  await clearProviderKey(provider)
}
