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
 * Whether a provider can read a PDF sent as an inline file part.
 *
 * Verified against the installed adapters: OpenAI (`input_file`), Anthropic
 * (`document`) and Google (`inlineData`) all serialize one, and xAI's Responses
 * API accepts only a URL or a Files API reference for non-image files, throwing
 * `UnsupportedFunctionalityError` on inline bytes. Neither alternative is wired
 * up here, so the caller refuses a PDF for xAI rather than surfacing that error
 * mid-stream. Images and inlined text work on every provider.
 */
export function supportsInlineDocuments(provider: ProviderId): boolean {
  return provider !== "xai"
}

/** The live model plus which provider it came from, for capability checks. */
export interface ResolvedModel {
  model: LanguageModel
  provider: ProviderId
}

/**
 * Builds a live model instance from the persisted provider/model/key. The key is
 * decrypted here and handed straight to the provider factory; it is never
 * returned, logged, or sent over IPC.
 */
export async function resolveModelWithProvider(): Promise<ResolvedModel> {
  const provider = await getProvider()
  if (!provider || !isProviderId(provider)) throw new NoProviderConfiguredError()

  const modelId = await getModel()
  if (!modelId) throw new NoProviderConfiguredError()

  const apiKey = await getProviderKey(provider)
  if (!apiKey) throw new MissingApiKeyError(provider)

  return { model: createProviderModel(provider, apiKey, modelId), provider }
}

export async function resolveModel(): Promise<LanguageModel> {
  return (await resolveModelWithProvider()).model
}
