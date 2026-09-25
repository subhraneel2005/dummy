import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogle } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createXai } from "@ai-sdk/xai"
import type { LanguageModel } from "ai"

import { getProviderKey } from "../db/keys.js"
import { getModel, getProvider } from "./config.js"
import { isProviderId, type ProviderId } from "./models.js"

export class NoProviderConfiguredError extends Error {
  constructor() {
    super("No AI provider is configured yet. Press Alt+M to set one up.")
    this.name = "NoProviderConfiguredError"
  }
}

export class MissingApiKeyError extends Error {
  constructor(provider: ProviderId) {
    super(`No API key saved for ${provider}. Press Alt+M to add one.`)
    this.name = "MissingApiKeyError"
  }
}

function createProviderModel(provider: ProviderId, apiKey: string, modelId: string): LanguageModel {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId)
    case "anthropic":
      return createAnthropic({ apiKey })(modelId)
    case "google":
      return createGoogle({ apiKey })(modelId)
    case "xai":
      return createXai({ apiKey })(modelId)
  }
}

/**
 * Builds a live model instance from the persisted provider/model/key. The key is
 * decrypted here and handed straight to the provider factory; it is never
 * returned, logged, or sent over IPC.
 */
export async function resolveModel(): Promise<LanguageModel> {
  const provider = await getProvider()
  if (!provider || !isProviderId(provider)) throw new NoProviderConfiguredError()

  const modelId = await getModel()
  if (!modelId) throw new NoProviderConfiguredError()

  const apiKey = await getProviderKey(provider)
  if (!apiKey) throw new MissingApiKeyError(provider)

  return createProviderModel(provider, apiKey, modelId)
}
