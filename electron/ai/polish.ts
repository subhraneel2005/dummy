import { generateText } from "ai"

import { resolveModel } from "./provider.js"

export const POLISH_SYSTEM_PROMPT =
  "You fix transcription errors in technical/developer speech. Output ONLY the corrected " +
  "transcript. Do not add commentary, paraphrases, quotes, markdown, or reword phrasing. " +
  "Preserve sentence structure, punctuation, capitalization, and line breaks exactly. Correct: " +
  "library/package/tool names, identifiers, flags, commands, version numbers, URLs, APIs, file " +
  "paths, and technical terms. If raw terms look like deliberate speech (e.g. intentional names), " +
  "keep them."

export const POLISH_USER_PROMPT = (raw: string) =>
  [
    "Correct ONLY the technical spelling in the following dictated transcript.",
    "Fix tool/package names, commands, flags, APIs, identifiers, and version numbers.",
    "Do NOT reword, paraphrase, comment, explain, or add code blocks/markdown or backticks.",
    "Output ONLY the corrected transcript as plain prose, no formatting.",
    "TRANSCRIPT:",
    raw,
  ].join("\n")

const POLISH_TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function runPolish(raw: string): Promise<string> {
  const model = await resolveModel()
  const result = await generateText({
    model,
    instructions: POLISH_SYSTEM_PROMPT,
    prompt: POLISH_USER_PROMPT(raw),
  })
  return result.text.trim() || raw
}

/**
 * Never block dictation on the LLM pass: any failure (no provider, missing key,
 * network error, timeout, empty reply) falls back to the raw transcript.
 */
export async function polishTranscript(raw: string): Promise<string> {
  const trimmed = raw.trim()
  if (!trimmed) return raw

  try {
    const corrected = await withTimeout(
      runPolish(trimmed),
      POLISH_TIMEOUT_MS,
      "Timed out waiting for the model to polish the transcript.",
    )
    return corrected.trim() || trimmed
  } catch {
    return trimmed
  }
}
