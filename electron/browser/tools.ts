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

import type { BrowserBackend } from "../ai/models.js"
import { captureScreenshot } from "./captures.js"
import { abortDeepTask, runDeepTask } from "./deep-task.js"
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

export type BrowserToolName =
  | (typeof READ_ONLY)[number]
  | "browser_type"
  | "browser_save_pdf"
  | "browser_deep_task"

export function isReadOnlyTool(name: string): boolean {
  return (READ_ONLY as readonly string[]).includes(name)
}

/**
 * What a `browser_deep_task` approval actually grants, shown as the card's
 * caption. Unlike the other gated tools — a single click or a single file — a
 * deep task is one approval for an open-ended run over a separate Chrome
 * window the user can watch. The word "skip" keeps the denial an option, per
 * the approve-or-`{ error }` convention.
 */
export const DEEP_TASK_APPROVAL_REASON =
  "Full control of a separate Chrome window for one long task: it can open sites, " +
  "sign in, submit forms, download files, and run code with access to your data. " +
  "This one approval covers the entire task — there will be no more prompts. " +
  "Watch it in the live feed below and press Stop to cancel, or deny to skip."

/** Free-text limit keeps the task prompt from becoming a document. */
const DEEP_TASK_MAX_CHARS = 4_000

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

  browser_deep_task: tool({
    description:
      "Run a long, self-contained browsing goal — research across several sites, sign in, " +
      "fill and submit forms, download files — in one shot, in a separate Chrome window " +
      "driven by its own agent. One approval covers the whole task; you watch it run in the " +
      "activity feed and nobody will be prompted again while it works. Use this instead of " +
      "chaining browser_* tools whenever the goal is a complete job rather than a quick " +
      "lookup on the current page.",
    inputSchema: z.object({
      task: z
        .string()
        .min(1)
        .max(DEEP_TASK_MAX_CHARS)
        .describe(
          "The complete, self-contained goal: what to accomplish, any sites or accounts involved, " +
            "what to collect or download, and where to put the results.",
        ),
    }),
    execute: async (input, options) => {
      try {
        // A denied deep task never gets here: the approval gate runs first, so
        // this execute is only reached once the user approved.
        const result = await runDeepTask(input.task, {
          toolCallId: options.toolCallId,
          signal: options.abortSignal,
        })
        return { ok: true, ...result }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, error: message }
      }
    },
  }),
}

/**
 * The tool set one backend is allowed to use.
 *
 * The two backends are *exclusive* rather than cumulative: the embedded lane is
 * step-by-step tools against the in-app page, and the deep lane is a single
 * long-running agent in its own Chrome window. Handing the model both at once
 * means it interleaves a dozen approved clicks with one approved autonomous run,
 * which is neither auditable nor cheap. So the setting picks the lane outright.
 */
export function toolsForBackend(backend: BrowserBackend): ToolSet {
  if (backend === "deep") {
    const deep = browserTools.browser_deep_task
    return deep ? { browser_deep_task: deep } : {}
  }
  const tools: ToolSet = {}
  for (const [name, def] of Object.entries(browserTools)) {
    if (name !== "browser_deep_task") tools[name] = def
  }
  return tools
}

export interface ToolSummary {
  name: string
  description: string
}

/**
 * The single `@` the composer offers, which stands for whichever browser tools
 * the active backend has.
 *
 * Not a tool name: it is a capability the user names, not a call they pick. A
 * picker listing `browser_navigate`/`browser_snapshot`/`browser_read`/… asks the
 * user to know which internal step they want before the assistant has looked at
 * anything, and it changes shape when a tool is renamed. Naming the *capability*
 * is what a person actually means by "go and check that page", so that is what
 * the mention says — and it resolves to the real tool set at call time.
 */
export const BROWSER_MENTION = "BrowserAutomation"

const BROWSER_MENTION_DESCRIPTIONS: Record<BrowserBackend, string> = {
  embedded:
    "Open pages, read them, click, type and save PDFs, step by step in the in-app browser.",
  deep:
    "Hand a long multi-step goal — research, sign in, submit forms, download files — to the deep task agent.",
}

/**
 * What the `@` picker shows: one capability per backend, not its raw tools.
 *
 * Kept separate from `toolsForBackend` on purpose. The agent still gets the real
 * tools; the picker stays a one-line decision that means the same thing in both
 * modes.
 */
export function mentionCatalog(backend: BrowserBackend): ToolSummary[] {
  return [
    { name: BROWSER_MENTION, description: BROWSER_MENTION_DESCRIPTIONS[backend] },
  ]
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

export { show, isOpen, releasePageMemory, status, abortDeepTask }