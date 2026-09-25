import { getProviderKey } from "../db/keys.js"
import { MODEL_CATALOG, isProviderId, type ModelInfo, type ProviderId } from "./models.js"

export interface ModelListResult {
  ok: boolean
  models?: ModelInfo[]
  error?: string
}

const TIMEOUT_MS = 15_000

/**
 * Calls each provider's real "list models" endpoint with the user's stored key,
 * so the picker never shows a guessed id. These endpoints are stable, widely
 * documented, and much cheaper than a completion:
 *
 *   OpenAI    GET https://api.openai.com/v1/models            -> { data: [{ id }] }
 *   xAI       GET https://api.x.ai/v1/models                  -> { data: [{ id }] }
 *   Anthropic GET https://api.anthropic.com/v1/models         -> { data: [{ id, display_name }] }
 *             (requires `x-api-key` + `anthropic-version` headers)
 *   Google    GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 *             -> { models: [{ name: "models/gemini-...", displayName, ... }] }
 *
 * Falls back to the curated seed catalog when the request fails (offline, bad
 * key, or an endpoint change) so the picker is never empty.
 */
export async function listProviderModels(provider: ProviderId): Promise<ModelListResult> {
  const key = await getProviderKey(provider)
  if (!key) {
    return { ok: false, error: `No API key saved for ${provider}.` }
  }

  try {
    const raw = await requestModels(provider, key)
    const models = normalize(provider, raw)
    if (models.length === 0) {
      return { ok: false, error: `${provider} returned no chat models.` }
    }
    return { ok: true, models }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ...{ models: MODEL_CATALOG[provider] },
    }
  }
}

interface RawModel {
  id?: unknown
  name?: unknown
  displayName?: unknown
  display_name?: unknown
  supportedGenerationMethods?: unknown
  supported_actions?: unknown
}

async function requestModels(provider: ProviderId, key: string): Promise<RawModel[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let url: string
    let headers: Record<string, string> = {}

    switch (provider) {
      case "openai":
        url = "https://api.openai.com/v1/models"
        headers = { Authorization: `Bearer ${key}` }
        break
      case "xai":
        url = "https://api.x.ai/v1/models"
        headers = { Authorization: `Bearer ${key}` }
        break
      case "anthropic":
        url = "https://api.anthropic.com/v1/models?limit=100"
        headers = { "x-api-key": key, "anthropic-version": "2023-06-01" }
        break
      case "google":
        url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`
        break
    }

    const res = await fetch(url, { headers, signal: controller.signal })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`${provider} models request failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`)
    }

    const body = (await res.json()) as { data?: unknown; models?: unknown }
    if (Array.isArray(body.data)) return body.data as RawModel[]
    if (Array.isArray(body.models)) return body.models as RawModel[]
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Keeps only text/chat models. Provider "list models" endpoints also return
 * embeddings, image, audio, and TTS models, which would 400 or return nothing
 * useful from `generateText`/`ToolLoopAgent`.
 */
const NON_CHAT_PATTERNS = [
  /embedding/i,
  /-tts\b/i,
  /-tts-/i,
  /\btts-/i,
  /whisper/i,
  /transcribe/i,
  /translat/i,
  /\blive\b/i,
  /realtime/i,
  /^gpt-image/i,
  /-image$/i,
  /dall-e/i,
  /imagen/i,
  /veo\b/i,
  /robotics/i,
  /gemma/i,
  /tuned/i,
  /vision-model/i,
]

function isChatModel(provider: ProviderId, model: RawModel, id: string): boolean {
  if (provider === "google") {
    const methods = model.supportedGenerationMethods
    if (Array.isArray(methods) && methods.length > 0) {
      return methods.some((m) => typeof m === "string" && m === "generateContent")
    }
  }
  return !NON_CHAT_PATTERNS.some((re) => re.test(id))
}

function normalize(provider: ProviderId, raw: RawModel[]): ModelInfo[] {
  const seen = new Set<string>()
  const out: ModelInfo[] = []

  for (const model of raw) {
    if (typeof model !== "object" || model === null) continue
    // Google prefixes ids with `models/`; the SDKs expect the bare id.
    const rawId =
      typeof model.id === "string"
        ? model.id
        : typeof model.name === "string"
          ? model.name.replace(/^models\//, "")
          : null
    if (!rawId) continue

    const id = rawId.trim()
    if (!id || seen.has(id)) continue
    if (!isChatModel(provider, model, id)) continue
    seen.add(id)

    const display =
      (typeof model.displayName === "string" && model.displayName) ||
      (typeof model.display_name === "string" && model.display_name) ||
      null
    out.push({ id, label: display ? `${display} (${id})` : id })
  }

  out.sort(compareModels)
  return out
}

/** Cheap/fast model families, used to sort the "small model" options first. */
const FAST_PATTERNS = [
  /\bmini\b/i,
  /\bnano\b/i,
  /\blite\b/i,
  /\bhaiku\b/i,
  /\bflash-lite\b/i,
  /-fast\b/i,
  /\bturbo\b/i,
]

export function isFastModel(id: string): boolean {
  return FAST_PATTERNS.some((re) => re.test(id))
}

function compareModels(a: ModelInfo, b: ModelInfo): number {
  const fastA = isFastModel(a.id) ? 0 : 1
  const fastB = isFastModel(b.id) ? 0 : 1
  if (fastA !== fastB) return fastA - fastB
  return a.label.localeCompare(b.label, undefined, { numeric: true })
}

export function modelsForProvider(provider: string): ModelInfo[] {
  return isProviderId(provider) ? MODEL_CATALOG[provider] : []
}
