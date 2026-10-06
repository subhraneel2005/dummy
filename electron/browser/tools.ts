/**
 * The eight browser tools, exposed to the model as an AI SDK `ToolSet`.
 *
 * Two tiers, split by whether the action can *write* something:
 *   - `READ_ONLY` auto-approves. Opening a page, reading it, clicking a link, and
 *     going back or forward cannot put data anywhere on the user's behalf.
 *     Prompting for those teaches the user to approve without reading, which is
 *     the habit that makes the remaining prompts worthless. Navigation stays
 *     visible through the browser panel and the tool timeline.
 *   - the two that write — typing into a field (which can submit a form) and
 *     saving a PDF to disk — wait for an explicit decision.
 *
 * Schemas use zod via the SDK's `tool` helper. Errors are returned as values
 * rather than thrown wherever the model could plausibly recover on its own
 * (a stale ref, a slow page), because a thrown error aborts the turn instead of
 * letting the model try something else.
 */
import { tool, type ToolSet } from "ai"
import { z } from "zod"

import { captureScreenshot } from "./captures.js"
import type { PageInfo } from "./cdp.js"
import {
  BrowserNotReadyError,
  clickRef,
  go,
  isOpen,
  open,
  pageInfo,
  readPage,
  releasePageMemory,
  savePdf,
  show,
  snapshotPage,
  status,
  type BrowserStatus,
} from "./window.js"

/**
 * Auto-approved tools: everything that only *looks* at a page.
 *
 * Opening an address, reading text, listing elements, screenshotting, clicking a
 * link, and going back or forward cannot submit anything on the user's behalf.
 * Prompting for them is worse than not prompting at all — the user learns to
 * click "Allow" without reading, which is exactly the habit that makes the
 * remaining prompts meaningless.
 *
 * The two gated tools are the ones that write: `browser_type` can submit a form,
 * and `browser_save_pdf` writes a file to disk.
 */
export const READ_ONLY = [
  "browser_navigate",
  "browser_snapshot",
  "browser_read",
  "browser_screenshot",
  "browser_click",
  "browser_go",
] as const

export type BrowserToolName = (typeof READ_ONLY)[number] | "browser_type" | "browser_save_pdf"

export function isReadOnlyTool(name: string): boolean {
  return (READ_ONLY as readonly string[]).includes(name)
}

/**
 * Constrained at the schema rather than only in `open()`, so an unusable address
 * comes back as a validation error the model can correct, instead of a tool
 * failure after the call has already been approved.
 */
const url = z
  .string()
  .describe("An absolute http or https address")
  .refine(
    (value) => {
      try {
        const parsed = new URL(value)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "Must be an absolute http or https address, for example https://example.com" },
  )

/**
 * Wraps a tool body so a failure becomes a value instead of a throw.
 *
 * A thrown error aborts the whole turn. A returned `{ error }` lets the model
 * read what went wrong and try something else — which is what should happen for
 * a stale ref or a page that was still loading.
 */
function asResult<Input, Output extends Record<string, unknown>>(
  fn: (input: Input) => Promise<Output>,
): (input: Input) => Promise<Output & { page: PageInfo | null; error?: string }> {
  return async (input: Input) => {
    try {
      return { ...(await fn(input)), page: safePage() }
    } catch (err) {
      const message =
        err instanceof BrowserNotReadyError
          ? `${err.message}. Call browser_navigate first.`
          : err instanceof Error
            ? err.message
            : String(err)
      return { ...({} as Output), page: safePage(), error: message }
    }
  }
}

function safePage(): PageInfo | null {
  try {
    return pageInfo()
  } catch {
    return null
  }
}

export const browserTools: ToolSet = {
  browser_navigate: tool({
    description:
      "Open a web address in the embedded browser and return the loaded page. Use this before any other browser tool.",
    inputSchema: z.object({ url }),
    execute: asResult(async (input) => {
      const page = await open(input.url)
      return { ok: true, ...page }
    }),
  }),

  browser_snapshot: tool({
    description:
      "List the interactive elements on the current page as numbered refs, with their role and accessible name. Call this before clicking or typing, since refs are invalidated by navigation.",
    inputSchema: z.object({}),
    execute: asResult(async () => {
      const snapshot = await snapshotPage()
      return {
        elements: snapshot.nodes.map((node) => ({
          ref: node.ref,
          role: node.role,
          name: node.name,
        })),
        count: snapshot.nodes.length,
        ...(snapshot.truncated ? { note: snapshot.truncated } : {}),
      }
    }),
  }),

  browser_read: tool({
    description: "Read the visible text of the current page. Use this to answer questions about page content.",
    inputSchema: z.object({
      maxChars: z.number().int().positive().max(20_000).optional()
        .describe("Truncate the text to this many characters"),
    }),
    execute: asResult(async (input) => {
      const result = await readPage(input.maxChars)
      return { text: result.text, truncated: result.truncated }
    }),
  }),

  browser_screenshot: tool({
    description:
      "Capture the current page as a PNG and attach it to the conversation for the user. Prefer browser_read for text — you cannot see this image, it is only shown to the user.",
    inputSchema: z.object({}),
    execute: asResult(async () => {
      const shot = await captureScreenshot()
      return shot
    }),
  }),

  browser_click: tool({
    description: "Click an element by ref from the latest snapshot.",
    inputSchema: z.object({
      ref: z.number().int().positive().describe("Element ref from browser_snapshot"),
    }),
    execute: asResult(async (input) => {
      const before = safePage()?.url
      const page = await clickRef(input.ref)
      return { ok: true, navigated: page.url !== before }
    }),
  }),

  browser_type: tool({
    description: "Type text into an element by ref, optionally submitting with Enter.",
    inputSchema: z.object({
      ref: z.number().int().positive().describe("Element ref from browser_snapshot"),
      text: z.string().describe("The text to type"),
      submit: z.boolean().optional().describe("Press Enter after typing"),
    }),
    execute: asResult(async (input) => {
      const page = await typeRefSafe(input.ref, input.text, input.submit)
      return { ok: true, submitted: Boolean(input.submit), url: page.url }
    }),
  }),

  browser_go: tool({
    description: "Navigate back, forward, or reload in the browser history.",
    inputSchema: z.object({
      direction: z.enum(["back", "forward", "reload"]),
    }),
    execute: asResult(async (input) => {
      const page = await go(input.direction)
      return { ok: true, ...page }
    }),
  }),

  browser_save_pdf: tool({
    description: "Print the current page to a PDF file in the Downloads folder.",
    inputSchema: z.object({}),
    execute: asResult(async () => {
      const file = await savePdf()
      return { ok: true, path: file }
    }),
  }),
}

/** Thin wrapper so `browser_type` reads the same as the others at the call site. */
async function typeRefSafe(ref: number, text: string, submit: boolean | undefined) {
  const { typeRef } = await import("./window.js")
  return typeRef(ref, text, Boolean(submit))
}

export type BrowserEvent =
  | { type: "status"; status: BrowserStatus }
  | { type: "page"; url: string; title: string }
  | { type: "released" }

export { show, isOpen, releasePageMemory, status }