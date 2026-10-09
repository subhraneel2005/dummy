/**
 * The deep-task lane (Feature 6): hands a one-shot task to `@browser_use/pi`,
 * which runs its own agent loop against an external, headed Chrome with an
 * isolated persistent profile — completely separate from the embedded panel
 * (`browser/window.ts`).
 *
 * Why this module exists as its own service instead of living in `browser`
 * alongside the embedded tools:
 *   - it must be importable from `browser/tools.ts` (the tool calls it) without
 *     ever importing `ai/chat.ts` back (chat → tools → deep-task), so the
 *     session id for the cell feed is injected instead of imported
 *   - the module-level single-flight guard and the per-run abort mirror the
 *     active-turn pattern in `ai/chat.ts`, but a deep run lives behind one tool
 *     call, not one turn
 *
 * The browser, profile lock and Chrome launch all happen at `create()` time
 * (verified in Phase 0), which is also where the chrome-missing and lock-held
 * errors surface — so the single-flight guard must gate `create()`, and those
 * errors must be wrapped here into plain actionable tool text.
 *
 * Provider keys are reused: they are decrypted from `db/keys.ts`, written into
 * the matching pi-ai env var just before this run (the forked worker runs with
 * `env: {}`, so the agent process is the only one that can hold them), and
 * removed afterwards. The model is picked per provider from pi's own builtin
 * catalog, validated vision-capable, never guessed.
 */
import { app } from "electron"
import { readdir, mkdir } from "node:fs/promises"
import path from "node:path"

import type { AgentEvent, StreamFn } from "@browser_use/pi"

import { getProvider } from "../ai/config.js"
import { MissingApiKeyError, NoProviderConfiguredError } from "../ai/provider.js"
import type { ProviderId } from "../ai/models.js"
import { getProviderKey } from "../db/keys.js"

/** Cap a single deep run. Budgets and a watchdog, not a per-cell allowance. */
const DEEP_TASK_TIMEOUT_MS = 600_000
const DEEP_TASK_MAX_COST_USD = 1

/** Where the persistent Chrome profile for deep tasks lives, under userData. */
const PROFILE_DIR = "deep-chrome"

/**
 * Extra model-request attempts past the first, passed into pi-ai's transport.
 *
 * pi-ai retries 408/409/429/5xx (with backoff, honoring `Retry-After`) — but
 * only when the caller opts in via `maxRetries`, which defaults to `0`, and
 * `BrowserUseOptions` never sets it. So without this, one transient `429` from
 * the provider kills the whole run. Two retries ride out a per-minute quota
 * bounce; a hard daily cap still fails, but now with an actionable message.
 */
const DEEP_MODEL_MAX_RETRIES = 2
/** Honor the provider's requested delay up to a minute; longer asks fail fast. */
const DEEP_MODEL_MAX_RETRY_DELAY_MS = 60_000

/**
 * Per-provider model to hand pi, picked from the catalog (Phase 0 dump), not
 * from our own seed catalog — the two agree today but prove nothing about each
 * other. Validated at runtime against `builtinModels()` and replaced by the
 * first vision-capable entry when it ever drifts out of the catalog.
 */
const DEEP_MODEL_DEFAULTS: Record<ProviderId, string> = {
  openai: "gpt-5.4",
  anthropic: "claude-sonnet-4-6",
  google: "gemini-2.5-flash",
  xai: "grok-4.3",
}

/** The env var pi-ai's transport reads per provider (from its env-api-keys). */
const PROVIDER_KEY_ENV: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",
}

/** One entry in the live cell feed, matching pi's `javascript`/`finish` cells. */
export type DeepCellKind = "code" | "finish"

export type DeepEvent =
  | {
      type: "deep-cell-start"
      sessionId: string | null
      toolCallId: string
      cellId: string
      toolName: string
      kind: DeepCellKind
      code: string | null
    }
  | {
      type: "deep-cell-delta"
      sessionId: string | null
      toolCallId: string
      cellId: string
      toolName: string
      detail: string
      truncated: boolean
    }
  | {
      type: "deep-cell-end"
      sessionId: string | null
      toolCallId: string
      cellId: string
      toolName: string
      detail: string
      truncated: boolean
      isError: boolean
    }
  // A page is asking the user to prove they are human. The run does not try to
  // solve it — it pauses and hands control back, and the user resumes once done.
  | {
      type: "deep-challenge"
      sessionId: string | null
      toolCallId: string
      reason: string
      snippet: string
    }
  // Pause/resume, whether requested by the user or by challenge detection, so
  // the row can say what actually happened rather than what was asked for.
  | {
      type: "deep-control"
      sessionId: string | null
      toolCallId: string
      paused: boolean
    }

/** The one tool output; files are the workspace root's entries, by name. */
export interface DeepTaskOutput {
  summary: string
  files: string[]
  workspace: string
}

/** The same union minus the ids injected at emit time. */
type DeepEventPayload =
  | {
      type: "deep-cell-start"
      cellId: string
      toolName: string
      kind: DeepCellKind
      code: string | null
    }
  | {
      type: "deep-cell-delta"
      cellId: string
      toolName: string
      detail: string
      truncated: boolean
    }
  | {
      type: "deep-cell-end"
      cellId: string
      toolName: string
      detail: string
      truncated: boolean
      isError: boolean
    }
  | { type: "deep-challenge"; reason: string; snippet: string }
  | { type: "deep-control"; paused: boolean }

/** How far a cell's partial/result payload is shipped to the renderer. */
const CELL_DETAIL_LIMIT = 2_000

/**
 * Phrases that mean a page is asking the user to prove they are human.
 *
 * Detecting one is not an attempt to defeat it: the run pauses, the user
 * solves it in the visible Chrome window, and then resumes. The pattern is
 * deliberately broad — a false positive costs a click on Resume, while a miss
 * costs the agent a loop of failed attempts against a wall it cannot pass.
 */
const CHALLENGE_PATTERN =
  /recaptcha|hcaptcha|turnstile|cf-challenge|challenge-platform|not a robot|verify you are human|verify you are a human|are you a robot|unusual traffic|checking your browser|just a moment|enable javascript and cookies/i

/** What the challenge card says the page is asking for. */
const CHALLENGE_REASON = "This page is asking you to prove you're human."

/**
 * The window of text around a challenge match, so the card can quote what was
 * seen instead of only asserting it. Returns null when nothing matches.
 */
function challengeSnippet(text: string): string | null {
  const match = CHALLENGE_PATTERN.exec(text)
  if (!match || match.index === undefined) return null
  const start = Math.max(0, match.index - 80)
  const end = Math.min(text.length, match.index + match[0].length + 80)
  const snippet = text.slice(start, end).replace(/\s+/g, " ").trim()
  return `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}`
}

const listeners = new Set<(event: DeepEvent) => void>()

/** Main subscribes here and fans the events out over `browser:deep` IPC. */
export function onDeepTaskEvent(listener: (event: DeepEvent) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Injected by `ai/chat.ts`: the ids pi events have no knowledge of ride along
 * so the renderer can drop or patch only its own session's rows. Injected
 * rather than imported because deep-task.ts must not import chat.ts.
 */
type SessionProvider = () => string | null
let sessionProvider: SessionProvider = () => null

export function registerDeepSessionProvider(provider: (() => string | null) | null): void {
  sessionProvider = provider ?? (() => null)
}

function emit(event: DeepEventPayload, toolCallId: string): void {
  const sessionId = sessionProvider()
  for (const listener of listeners) listener({ ...event, sessionId, toolCallId } as DeepEvent)
}

/** True while a deep run is in flight, so a second `browser_deep_task` is refused. */
let running = false
let runAbort: AbortController | null = null

/**
 * The live run's handle and tool-call id, so pause/resume can reach the run
 * from an IPC handler and address the row that owns it. Both are cleared in the
 * run's `finally`, which is what keeps them honest once a run ends.
 */
let activeBrowser: DeepBrowser | null = null
let activeToolCallId: string | null = null

/** Fired once per run: a page that keeps matching must not re-announce itself. */
let challengeSignalled = false

/**
 * Cancels the in-flight deep run: signals pi's `run()`, whose `finally` then
 * closes the browser and releases the profile lock. Idempotent and safe to
 * call with nothing running.
 */
export function abortDeepTask(): void {
  runAbort?.abort()
}

/**
 * Asks the in-flight deep run to pause at its next tool boundary.
 *
 * pi's `pause()` is cooperative and only resolves at the next checkpoint, so it
 * is never awaited from here — the caller (an event handler or an IPC invoke)
 * must not block on a run that is itself waiting to reach a checkpoint. The
 * row is told immediately; pi acknowledges by simply not taking the next tool.
 */
export function pauseDeepTask(): void {
  if (!activeBrowser || !activeToolCallId) return
  emit({ type: "deep-control", paused: true }, activeToolCallId)
  void activeBrowser.pause().catch(() => undefined)
}

/**
 * Releases a paused run and re-arms challenge detection, so a second wall later
 * in the same task is reported rather than swallowed by the first one's flag.
 */
export function resumeDeepTask(): void {
  if (!activeBrowser || !activeToolCallId) return
  challengeSignalled = false
  emit({ type: "deep-control", paused: false }, activeToolCallId)
  void activeBrowser.resume().catch(() => undefined)
}

function truncate(value: unknown): { text: string; truncated: boolean } {
  if (typeof value === "string") {
    return value.length > CELL_DETAIL_LIMIT
      ? { text: value.slice(0, CELL_DETAIL_LIMIT), truncated: true }
      : { text: value, truncated: false }
  }
  let text = ""
  try {
    text = JSON.stringify(value) ?? ""
  } catch {
    text = String(value)
  }
  return text.length > CELL_DETAIL_LIMIT
    ? { text: text.slice(0, CELL_DETAIL_LIMIT), truncated: true }
    : { text, truncated: false }
}

/**
 * Validates pi's vision-capable pick for the provider, falling back to the
 * first image-capable entry. Returns the `provider/modelId` id pi expects.
 *
 * `DUMMY_DEEP_MODEL` overrides the default — either a bare model id for the
 * active provider, or `provider/modelId` (ignored if the provider differs).
 * Useful for pointing a deep run at a model with more quota headroom.
 */
function resolveModelId(models: { getModels: (provider: string) => ReadonlyArray<{ id: string; input?: readonly string[] }> }, provider: ProviderId): string {
  const override = process.env.DUMMY_DEEP_MODEL
  const slash = override?.indexOf("/") ?? -1
  const overrideProvider = override && slash >= 0 ? override.slice(0, slash) : undefined
  const overrideModel = override && slash >= 0 ? override.slice(slash + 1) : override
  const requested =
    overrideModel && (!overrideProvider || overrideProvider === provider)
      ? overrideModel
      : DEEP_MODEL_DEFAULTS[provider]
  const entries = models.getModels(provider)

  const imageCapable = (m: { id: string; input?: readonly string[] }) =>
    Array.isArray(m.input) && m.input.includes("image")
  const match = entries.find((m) => m.id === requested) ?? entries.find(imageCapable)
  if (!match) {
    throw new Error(`No vision-capable model found for the ${provider} provider in browser-use-pi's catalog.`)
  }
  return `${provider}/${match.id}`
}

/** The deep run's per-task workspace: userData/deep-tasks/<session>-<ts>. */
function workspaceFor(sessionId: string | null): string {
  const name = sessionId ? sessionId.replace(/[^a-zA-Z0-9_-]/g, "-") : "standalone"
  return path.join(app.getPath("userData"), "deep-tasks", `${name}-${Date.now()}`)
}

/** Lists the workspace's immediate entries by name (files the run produced). */
async function listWorkspace(workspace: string): Promise<string[]> {
  const entries = await readdir(workspace, { withFileTypes: true }).catch(() => [])
  return entries.map((entry) => entry.name)
}

/**
 * When a run stops on a rate-limit/quota error, returns plain, actionable text
 * for the user instead of the raw provider string. The tool hands this back as
 * `{ error }`, and a specific instruction keeps the chat model from paraphrasing
 * a failed task into a fabricated answer. Returns null for other failures.
 */
function rateLimitHint(message: string): string | null {
  if (!/\b429\b|too many requests|rate[_ ]?limit|quota|resource[_ ]exhausted/i.test(message)) {
    return null
  }
  return (
    "The deep browser task hit the provider's rate limit and could not finish. " +
    "Wait a minute and try again, or switch to a provider or model with more " +
    `headroom in Settings. (${message})`
  )
}

type DeepBrowser = Awaited<ReturnType<typeof import("@browser_use/pi").BrowserUse.create>>

/**
 * Runs one deep task to completion. Throws an Error whose message is plain,
 * actionable tool text — the `browser_deep_task` tool returns it as `{ error }`
 * rather than failing the turn, so the model can report it and move on.
 */
export async function runDeepTask(
  task: string,
  options: { toolCallId: string; signal?: AbortSignal | undefined },
): Promise<DeepTaskOutput> {
  if (running) {
    throw new Error("Another deep browser task is already running. Let it finish, or press Stop first.")
  }

  // Provider and key are read before the import so a misconfigured chat fails
  // with the same typed errors the rest of the app uses.
  const provider = await getProvider()
  if (!provider) throw new NoProviderConfiguredError()
  const apiKey = await getProviderKey(provider)
  if (!apiKey) throw new MissingApiKeyError(provider)

  const controller = new AbortController()
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true })
  runAbort = controller
  running = true
  challengeSignalled = false

  const workspace = workspaceFor(sessionProvider())
  const profileDir = path.join(app.getPath("userData"), PROFILE_DIR)
  const keyEnv = PROVIDER_KEY_ENV[provider]

  let previousKey: string | undefined
  let browser: DeepBrowser | null = null

  try {
    await mkdir(workspace, { recursive: true })
    // Just-in-time, and only on this process — the forked worker's env is
    // empty by design, so the key never leaves the agent process.
    previousKey = process.env[keyEnv]
    process.env[keyEnv] = apiKey

    const piModule = await import("@browser_use/pi")
    const models = piModule.builtinModels()
    const modelId = resolveModelId(models, provider)

    // pi's own streaming path never opts into provider retries, so wrap its
    // default transport to pass `maxRetries` through to pi-ai. Without this a
    // single 429 ends the run instead of backing off and retrying.
    const streamSimple = models.streamSimple.bind(models)
    const streamFn: StreamFn = (model, context, options) =>
      streamSimple(model, context, {
        ...options,
        maxRetries: DEEP_MODEL_MAX_RETRIES,
        maxRetryDelayMs: DEEP_MODEL_MAX_RETRY_DELAY_MS,
      })

    // create() launches Chrome, acquires the profile lock, and is where the
    // chrome-missing / lock-held errors land — so this is also where they get
    // wrapped into instructions the user can act on.
    try {
      browser = await piModule.BrowserUse.create({
        model: modelId,
        models,
        streamFn,
        telemetry: false,
        researchTools: false,
        browser: piModule.Browser.chromium({ headless: false, profileDir }),
        workspace,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("Chrome not found")) {
        throw new Error(
          `${message} Install Google Chrome (https://www.google.com/chrome/) and try again — ` +
            "the deep task runs in its own Chrome window.",
        )
      }
      if (message.includes("Browser profile is locked")) {
        throw new Error(
          `${message} If no deep task is visibly running, quit that Chrome window or remove ` +
            `"${path.join(profileDir, ".bu-pi.lock")}" and try again.`,
        )
      }
      throw err
    }

    // The handle is live from here, so pause/resume can address this run.
    activeBrowser = browser
    activeToolCallId = options.toolCallId

    const result = await browser.run(task, {
      timeoutMs: DEEP_TASK_TIMEOUT_MS,
      maxCostUsd: DEEP_TASK_MAX_COST_USD,
      signal: controller.signal,
      onEvent: (event: AgentEvent) => {
        if (event.type === "tool_execution_start") {
          emit(
            {
              type: "deep-cell-start",
              cellId: event.toolCallId,
              toolName: event.toolName,
              kind: event.toolName === "javascript" ? "code" : "finish",
              code: typeof event.args?.code === "string" ? event.args.code : null,
            },
            options.toolCallId,
          )
          return
        }
        if (event.type === "tool_execution_update") {
          const { text, truncated } = truncate(event.partialResult)
          emit(
            { type: "deep-cell-delta", cellId: event.toolCallId, toolName: event.toolName, detail: text, truncated },
            options.toolCallId,
          )
          return
        }
        if (event.type === "tool_execution_end") {
          const { text, truncated } = truncate(event.result)
          emit(
            {
              type: "deep-cell-end",
              cellId: event.toolCallId,
              toolName: event.toolName,
              detail: text,
              truncated,
              isError: event.isError,
            },
            options.toolCallId,
          )
          // A human-verification wall is handed to the user, not fought. Pause
          // and say so; `challengeSignalled` keeps a page that keeps matching
          // from re-announcing itself on every later cell.
          if (!challengeSignalled) {
            const snippet = challengeSnippet(text)
            if (snippet !== null) {
              challengeSignalled = true
              emit(
                { type: "deep-challenge", reason: CHALLENGE_REASON, snippet },
                options.toolCallId,
              )
              pauseDeepTask()
            }
          }
        }
      },
    })

    if (controller.signal.aborted) {
      throw new Error("The deep browser task was stopped.")
    }
    if (result.status !== "completed") {
      const reason = result.error ?? `stopped early (${result.status})`
      throw new Error(rateLimitHint(reason) ?? `The deep browser task ${reason}.`)
    }

    const summary = typeof result.output === "string" && result.output ? result.output : result.text
    return { summary, files: await listWorkspace(workspace), workspace }
  } finally {
    if (browser) await browser.close()
    if (previousKey === undefined) delete process.env[keyEnv]
    else process.env[keyEnv] = previousKey
    activeBrowser = null
    activeToolCallId = null
    runAbort = null
    running = false
  }
}