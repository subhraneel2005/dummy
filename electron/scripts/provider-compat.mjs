/**
 * Guards the attachment/provider capability matrix.
 *
 * `ai/chat.ts` splits attachments in two — images and PDFs go out as `FilePart`s
 * with their bytes, text documents go out as inlined `TextPart`s — because the
 * providers disagree about what a file part may be. Those limits live in the
 * provider adapters, not in this app, so a version bump can change them without
 * touching any code here.
 *
 * This asserts the matrix against the installed adapters with the network
 * transport mocked out, which also proves the exact `UserContent` that
 * `buildUserContent` emits is accepted. Re-run after upgrading any `@ai-sdk/*`
 * package; if it fails, the expectations below are what need updating.
 *
 *   node scripts/provider-compat.mjs
 *
 * Pass `--update` to print the observed matrix instead of asserting it, for
 * when an upgrade legitimately changes the answer.
 */
import { generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createXai } from "@ai-sdk/xai"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 0x20)])

/** The three shapes `buildUserContent` can emit. */
const CASES = {
  "pdf file part": [
    { type: "text", text: "What is this?" },
    { type: "file", mediaType: "application/pdf", filename: "paper.pdf", data: { type: "data", data: PDF } },
  ],
  "png file part": [
    { type: "text", text: "What is this?" },
    { type: "file", mediaType: "image/png", filename: "shot.png", data: { type: "data", data: PNG } },
  ],
  "text document inlined as a text part": [
    { type: "text", text: "What is this?" },
    { type: "text", text: "--- notes.md ---\n# Title\nbody\n--- end of notes.md ---" },
  ],
}

/**
 * Observed on the installed adapters. xAI is the only one that refuses an inline
 * PDF — its Responses API takes non-image files only by URL or Files API
 * reference — which is what `supportsInlineDocuments` in `ai/provider.ts` exists
 * to pre-empt.
 */
const EXPECTED = {
  "pdf file part": { openai: true, anthropic: true, google: true, xai: false },
  "png file part": { openai: true, anthropic: true, google: true, xai: true },
  "text document inlined as a text part": {
    openai: true, anthropic: true, google: true, xai: true,
  },
}

/**
 * Detected from the request body rather than the URL, so it does not depend on
 * a host string that a provider can change. OpenAI and xAI route to `/responses`
 * when the model calls for it, which is a body shape (`input`), not a URL.
 */
const shapeFor = (body) => {
  if (Array.isArray(body.input)) {
    return {
      id: "x", object: "response", created_at: 0, model: "m", status: "completed",
      output: [{
        type: "message", id: "m1", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: "ok", annotations: [] }],
      }],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    }
  }
  if (Array.isArray(body.contents)) {
    return {
      candidates: [{ content: { parts: [{ text: "ok" }], role: "model" }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    }
  }
  // Anthropic requires max_tokens; the OpenAI chat endpoint never sends it.
  if (typeof body.max_tokens === "number") {
    return {
      id: "x", type: "message", role: "assistant", model: "m",
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }
  }
  return {
    id: "x", object: "chat.completion", created: 0, model: "m",
    choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }
}

const PROVIDERS = {
  openai: (fetch) => createOpenAI({ apiKey: "test", fetch }),
  anthropic: (fetch) => createAnthropic({ apiKey: "test", fetch }),
  google: (fetch) => createGoogleGenerativeAI({ apiKey: "test", fetch }),
  xai: (fetch) => createXai({ apiKey: "test", fetch }),
}

const update = process.argv.includes("--update")

/** A marker that is findable in the serialized body, base64 or plain. */
const markerFor = (content) => {
  const isText = content.some((p) => p.type === "text" && p.text.includes("---"))
  if (isText) return "# Title"
  // A whole number of leading bytes, so no padding to disagree about.
  return Buffer.from(content.find((p) => p.type === "file").data.data.subarray(0, 9)).toString("base64")
}

/** Whether the provider serialized the payload without rejecting it. */
const probe = async (providerName, content) => {
  let wire = null
  const mockFetch = async (_url, init) => {
    wire = JSON.parse(init.body)
    return new Response(JSON.stringify(shapeFor(wire)), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }
  try {
    await generateText({
      model: PROVIDERS[providerName](mockFetch)("gpt-4o-mini"),
      messages: [{ role: "user", content }],
    })
  } catch (err) {
    // An explicit capability refusal is a real answer, not a harness failure.
    return { supported: false, reason: err.name }
  }
  // Accepted and sent, but a dropped payload would still be a silent failure.
  return wire && wire !== null && JSON.stringify(wire).includes(markerFor(content))
    ? { supported: true }
    : { supported: false, reason: "DroppedFromRequest" }
}

let failures = 0
const observed = {}

for (const [caseName, content] of Object.entries(CASES)) {
  console.log(`\n${caseName}`)
  observed[caseName] = {}
  for (const providerName of Object.keys(PROVIDERS)) {
    const result = await probe(providerName, content)
    observed[caseName][providerName] = result.supported
    const expected = EXPECTED[caseName][providerName]
    const agrees = result.supported === expected
    if (!agrees) failures++
    const verdict = update ? "   " : agrees ? "ok " : "FAIL"
    console.log(
      `  ${verdict} ${providerName.padEnd(10)} ${result.supported ? "supported" : `refused (${result.reason})`}`,
    )
  }
}

if (update) {
  console.log("\nObserved — paste into EXPECTED if this was an intended change:")
  console.log(JSON.stringify(observed, null, 2))
} else if (failures) {
  console.log(
    `\n${failures} combination(s) disagree with EXPECTED. If an @ai-sdk/* upgrade caused` +
      "\nthis, re-run with --update and review the new matrix before accepting it.",
  )
} else {
  console.log("\nMatrix matches EXPECTED for all providers.")
}

process.exitCode = failures ? 1 : 0