export const PROVIDERS = ["openai", "anthropic", "google", "xai"] as const

export type ProviderId = (typeof PROVIDERS)[number]

export interface ProviderInfo {
  id: ProviderId
  label: string
  keyPlaceholder: string
  docsUrl: string
}

export interface ModelInfo {
  id: string
  label: string
}

/**
 * Offline seed catalog only. The settings picker calls each provider's live
 * `list models` endpoint (`ai/list-models` -> `ai/catalog.ts`) once a key is
 * saved, so these ids are a fallback for when that request fails — not the
 * source of truth. Ids below were read from each vendor's own docs, not guessed:
 *
 *   OpenAI    platform.openai.com/docs/models  -> DOTTED versions (`gpt-5.6-luna`)
 *   Anthropic docs.anthropic.com/en/api/models -> HYPHENATED (`claude-sonnet-4-5`)
 *   Google    ai.google.dev/gemini-api/docs/models
 *   xAI       api.x.ai (OpenAI-compatible)
 *
 * Note the inconsistency is real and not a typo: OpenAI dotted, Anthropic
 * hyphenated. Verify against live docs before editing.
 */
export const MODEL_CATALOG: Record<ProviderId, ModelInfo[]> = {
  openai: [
    { id: "gpt-5.6-luna", label: "GPT-5.6 Luna (fast)" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 Nano (fastest)" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini (fast)" },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { id: "gpt-6-astra", label: "GPT-6 Astra" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fast)" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-opus-5", label: "Claude Opus 5" },
  ],
  google: [
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (fastest)" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite (fast)" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (fast)" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  ],
  xai: [
    { id: "grok-4.7", label: "Grok 4.7" },
    { id: "grok-4.6", label: "Grok 4.6" },
    { id: "grok-4.3", label: "Grok 4.3" },
  ],
}

export const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  google: {
    id: "google",
    label: "Google",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  xai: {
    id: "xai",
    label: "xAI",
    keyPlaceholder: "xai-...",
    docsUrl: "https://console.x.ai/",
  },
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDERS as readonly string[]).includes(value)
}
