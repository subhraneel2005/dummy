import { randomBytes, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { asc, eq } from "drizzle-orm"
import {
  ToolLoopAgent,
  stepCountIs,
  type FilePart,
  type ModelMessage,
  type TextPart,
  type UserContent,
} from "ai"

import { getDb, type Db } from "../db/index.js"
import { chatAttachments, chatMessages, chatToolCalls, type ToolCallStatus } from "../db/schema.js"
import { abandonCaptures, beginCaptures, capturesFor, commitCaptures } from "../browser/captures.js"
import { DEEP_TASK_APPROVAL_REASON, isReadOnlyTool, mentionCatalog, toolsForBackend } from "../browser/tools.js"
import { abortDeepTask, registerDeepSessionProvider } from "../browser/deep-task.js"
import { isOpen, releasePageMemory } from "../browser/window.js"
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  attachmentKind,
  decodeAttachment,
  deleteAttachmentFiles,
  resolveMediaType,
  storeAttachment,
  type StoredAttachment,
} from "./attachments.js"
import { resolveModelWithProvider, supportsInlineDocuments } from "./provider.js"
import { toolMentionDirective as mentionDirective } from "./mentions.js"
import { getBrowserBackend } from "./config.js"
import { PROVIDER_INFO, type BrowserBackend, type ProviderId } from "./models.js"
import { autoTitleSession, clearSessionMessages, ensureSession, touchSession } from "./sessions.js"

/**
 * Attachment metadata for the renderer. Deliberately no `path` and no bytes:
 * the path is meaningless outside main, and shipping every screenshot in the
 * history payload would make opening a session cost megabytes.
 */
export interface ChatAttachmentMeta {
  id: string
  mediaType: string
  fileName: string
  width: number
  height: number
  byteSize: number
}

/**
 * One browser tool call, as it is shown in the activity timeline.
 *
 * Recorded during the turn and written with the assistant message, which is why
 * `messageId` is not known while the turn runs.
 */
export interface RecordedToolCall {
  toolCallId: string
  toolName: string
  input: unknown
  output: unknown
  status: ToolCallStatus
  /** Null until the user answers an approval; reads only on mutating tools. */
  approved: boolean | null
  durationMs: number | null
  error: string | null
  /** Set when the row is created, cleared once recorded. */
  startedAt: number
}

/** A tool that reported a failure rather than throwing. */
function failedToolOutput(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null
  const error = (output as { error?: unknown }).error
  return typeof error === "string" && error.length > 0 ? error : null
}

function elapsedSince(call: RecordedToolCall): number {
  return Math.max(0, Date.now() - call.startedAt)
}

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
  attachments: ChatAttachmentMeta[]
  /** Browser tool calls made while producing this message, in order. */
  toolCalls: RecordedToolCall[]
}

/** An attachment as it arrives from the renderer over IPC. */
export interface IncomingAttachment {
  id: string
  mediaType: string
  fileName: string
  dataBase64: string
}

export interface AiError {
  ok: false
  error: string
}

export type ChatSendResult = { ok: true } | AiError
export type ChatHistoryResult = { ok: true; messages: ChatMessage[] } | AiError

// `sessionId` rides along on every event so a renderer that switched threads
// mid-stream can drop deltas belonging to the conversation it just left.
// `load-error` is app-level and deliberately has no session.
export type ChatStreamEvent =
  | { type: "delta"; sessionId: string; text: string }
  | { type: "done"; sessionId: string }
  // A turn the user stopped. Carries no message because nothing failed — the
  // point is only that it is terminal.
  | { type: "stopped"; sessionId: string }
  | { type: "error"; sessionId: string; message: string }
  | { type: "load-error"; message: string }
  // Browser tool lifecycle. `tool-call` and `tool-result` drive the live
  // timeline; `approval-request` is what makes the user act, and it parks the
  // turn until the matching `chat:approval-response` arrives.
  | {
      type: "tool-call"
      sessionId: string
      toolCallId: string
      toolName: string
      input: unknown
    }
  | {
      type: "tool-result"
      sessionId: string
      toolCallId: string
      toolName: string
      output: unknown
    }
  | {
      type: "approval-request"
      sessionId: string
      approvalId: string
      toolCallId: string
      toolName: string
      input: unknown
      reason?: string
    }
  | {
      type: "approval-response"
      sessionId: string
      approvalId: string
      toolCallId: string
      toolName: string
      approved: boolean
    }
  // A page the model captured. Carries the bytes so it can be shown now, and is
  // written into the assistant's message when the turn ends.
  | {
      type: "browser-capture"
      sessionId: string
      attachmentId: string
      mediaType: string
      width: number
      height: number
      dataBase64: string
    }

const BASE_INSTRUCTIONS =
  "You are a concise assistant embedded in a macOS dictation app. The user dictates technical " +
  "notes and sends them to you for discussion. Answer directly and prefer short, well-structured " +
  "responses. Use markdown for code blocks and lists. Screenshots may be attached to a message " +
  "as images of whatever was on the user's screen at that moment — read them when the question " +
  "refers to them, and say so plainly if an image does not actually show what was asked about."

const EMBEDDED_BROWSER_INSTRUCTIONS =
  "You can drive a web browser to answer questions that need live pages. Call " +
  "browser_snapshot before clicking or typing, because the numbered refs it returns are only valid " +
  "for the page they came from and any navigation invalidates them. Prefer browser_read over a " +
  "screenshot for page content: you cannot see images the browser captures. If the user denies an " +
  "action, do not retry it — carry on without it and say what you could not do. Every step is shown " +
  "to the user as it happens, so keep the run short and explain what you are about to do."

const DEEP_BROWSER_INSTRUCTIONS =
  "Browser work runs through browser_deep_task and nothing else: there are no step-by-step " +
  "browser tools in this mode. Hand it one complete, self-contained goal — research across several " +
  "sites, sign in, fill and submit a form, download files — rather than a single step. It runs in " +
  "its own Chrome window under a separate agent: one call, one approval, and no further prompts " +
  "while it works, with the run visible in the activity feed. State what to accomplish, any sites " +
  "or accounts involved, what to collect or download, and where to put the results."

const TOOL_ERROR_INSTRUCTIONS =
  "When a tool returns an error, never invent the result, list, or findings it failed to " +
  "produce, and never present an error as a completed answer. Distinguish two cases. A " +
  "transient failure — a navigation that was aborted or timed out, a page that was still " +
  "loading, a stale element reference — is worth retrying once or twice, or working around " +
  "with another tool; that is a hiccup, not an answer, and abandoning the whole request over " +
  "one is the wrong call. A failure that is clearly permanent — a site that refuses access, a " +
  "tool you do not have, a request that cannot be satisfied — is not worth retrying: say " +
  "plainly what you could not do, then finish the rest of the task and report what you did " +
  "establish. Never apologise your way out of work you can still do, and never pad the answer " +
  "with guesses to paper over a gap."

/**
 * The system prompt for one turn, chosen by the browser backend setting.
 *
 * Each backend gets the paragraph that describes *its* tools and not the other's.
 * Telling a model a tool exists when it is not in the tool set produces a turn
 * that apologises for a call it cannot make, and it is the model — not the tool
 * layer — that decides which capability to reach for.
 */
function chatInstructions(backend: BrowserBackend): string {
  return [
    BASE_INSTRUCTIONS,
    backend === "deep" ? DEEP_BROWSER_INSTRUCTIONS : EMBEDDED_BROWSER_INSTRUCTIONS,
    TOOL_ERROR_INSTRUCTIONS,
  ].join("\n\n")
}

/**
 * The directive a `@`-mentioned capability adds to one turn, or null when the
 * message mentions none.
 *
 * `BrowserAutomation` is resolved to the lane's real tools rather than naming
 * one: the user named a capability, and which tools carry it is the backend's
 * business, not theirs.
 */
function toolMentionDirective(text: string, backend: BrowserBackend): string | null {
  return mentionDirective(text, mentionCatalog(backend).map((entry) => entry.name))
}

/**
 * Set on every agent so a click-wait-observe loop cannot burn the SDK default
 * step budget. The flat cap is a runaway guard, not the intended limit.
 */
const BROWSER_STEP_LIMIT = 24

/**
 * Deep-task timeouts. The SDK's per-step total timeout defaults to 300s, but a
 * `browser_deep_task` step legitimately runs the whole 600s of its own budget,
 * so the step's allowances are lifted to match — scoped to the deep tool so the
 * other tools keep their normal pace.
 */
const DEEP_STEP_TIMEOUT_MS = 600_000
const DEEP_TASK_CALL_TIMEOUT_MS = 620_000

/**
 * Binds an approval response to the tool call that requested it.
 *
 * Fresh per launch and main-process only, so it never has to be stored: an
 * approval cannot outlive the turn that produced it. Without it, a compromised
 * renderer could forge an approval and let a click land without ever being
 * shown to the user, which would defeat the entire confirm-before-acting model.
 */
const TOOL_APPROVAL_SECRET = randomBytes(32)

const listeners = new Set<(event: ChatStreamEvent) => void>()

/**
 * In-flight turn, or null.
 *
 * One at a time, app-wide. A tool call can be parked waiting for the user's
 * approve/deny, and that parked state has to be cancellable too — otherwise
 * `chat:stop` would leave a turn that can never finish and the next send would
 * be silently dropped.
 */
/** An approval the SDK asked for and the user has not answered yet. */
type ParkedApproval = {
  approvalId: string
  toolCallId: string
  toolName: string
  input: unknown
  reason?: string
}

type ActiveTurn = {
  controller: AbortController
  /** Denies every approval this turn is parked on, if any. */
  denyPending: (() => void) | null
  /** Identifies this turn's capture buffer, so cleanup cannot hit a later turn. */
  token: string
  /** Needed to emit the terminal event when the turn is stopped. */
  sessionId: string
}

let activeTurn: ActiveTurn | null = null

// The deep-task lane keys its cell feed to the conversation currently being
// answered, exactly like every other ChatStreamEvent. Injected here rather than
// imported by `deep-task.ts`, which must not depend on this module.
registerDeepSessionProvider(() => activeTurn?.sessionId ?? null)

function emit(event: ChatStreamEvent): void {
  for (const listener of listeners) listener(event)
}

export function onChatEvent(listener: (event: ChatStreamEvent) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Cancels the in-flight turn without telling the renderer.
 *
 * Used when a turn is being *replaced* — a new message, or a cleared chat — and
 * the renderer is already about to render the replacement. Emitting a terminal
 * event here would arrive after the renderer's new turn state and wipe it, so
 * only `stopActiveStream` reports.
 *
 * A parked approval is denied rather than left hanging, so the turn reaches a
 * clean end instead of waiting forever on a prompt the user has walked away
 * from.
 */
export function abortActiveStream(): void {
  abort(false)
}

/**
 * Cancels the in-flight turn *because the user asked to stop*.
 *
 * The renderer only learns about it through the emitted event: the aborted
 * stream produces no terminal event of its own, so without this the composer
 * would stay disabled with no way to send again.
 */
export function stopActiveStream(): void {
  abort(true)
}

function abort(notify: boolean): void {
  const turn = activeTurn
  if (!turn) return
  // The old turn is being stopped, so the page it was using is about to become
  // idle again.
  if (isOpen()) scheduleIdleRelease()
  // Denies rather than just aborting: any card still on screen would otherwise
  // answer into a turn that no longer exists.
  turn.denyPending?.()
  turn.denyPending = null
  // Signals the SDK stream (which propagates into the deep task's abort signal)
  // — and directly, in case the deep run is mid-fork and hasn't registered a
  // listener yet. Either way its `finally` closes Chrome and frees the lock.
  abortDeepTask()
  turn.controller.abort()
  activeTurn = null
  // Emitted here, not in the stream's `finally`, because that runs after an
  // await and so can land after the *next* turn has already started.
  if (notify) emit({ type: "stopped", sessionId: turn.sessionId })
}

/* -------------------------------------------------------------------------- */
/* Tool approvals                                                              */
/* -------------------------------------------------------------------------- */

/** Pending approve/deny decisions, keyed by the id the SDK minted for the request. */
const pendingApprovals = new Map<
  string,
  { resolve: (approved: boolean) => void; token: string }
>()

/**
 * Releases every approval the given turn parked.
 *
 * Turn-scoped, not session-scoped: a stop that lands after the next turn has
 * already started must not reach into it, which is the same reasoning the
 * capture buffers are token-scoped for.
 */
function denyApprovalsFor(token: string): void {
  for (const [id, waiting] of pendingApprovals) {
    if (waiting.token !== token) continue
    pendingApprovals.delete(id)
    waiting.resolve(false)
  }
}

/**
 * Records the user's answer to a parked approval.
 *
 * Rejects unknown or already-answered ids rather than resolving whatever happens
 * to be parked: a stale click on a card from a previous turn must not approve
 * whatever the model is asking about now.
 */
export function respondToApproval(
  approvalId: string,
  approved: boolean,
): { ok: true } | AiError {
  const pending = pendingApprovals.get(approvalId)
  if (!pending) return { ok: false, error: "That approval is no longer waiting for a decision." }
  pendingApprovals.delete(approvalId)
  // The turn is live again, so a pending eviction must not fire underneath it.
  cancelIdleRelease()
  pending.resolve(approved)
  return { ok: true }
}

/**
 * Called when the user opens the browser window from the sidebar, so a pending
 * eviction cannot blank the page out from under them.
 */
export function cancelBrowserIdleRelease(): void {
  cancelIdleRelease()
}

/* -------------------------------------------------------------------------- */
/* Idle release                                                                */
/* -------------------------------------------------------------------------- */

/**
 * How long a browser page may sit idle before its memory is reclaimed.
 *
 * Five minutes is long enough that a follow-up question ("now click the second
 * result") still hits a live page — the common case, and re-navigating would
 * throw away the page the user was looking at. Past that, the page has served no
 * purpose: on an 8 GB machine a heavy tab held open indefinitely is a real cost
 * with no user-visible benefit, and logins survive in the partition regardless.
 */
const BROWSER_IDLE_MS = 5 * 60_000

let idleTimer: NodeJS.Timeout | null = null

function cancelIdleRelease(): void {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function scheduleIdleRelease(): void {
  cancelIdleRelease()
  // A turn in flight owns the page — evicting it mid-task would destroy the refs
  // the model is about to click. `activeTurn` is the authority on "busy", so the
  // timer re-checks rather than the caller remembering to cancel.
  idleTimer = setTimeout(() => {
    idleTimer = null
    if (activeTurn) return
    void releasePageMemory()
  }, BROWSER_IDLE_MS)
  // Nothing else should keep the event loop alive for a page nobody is using.
  idleTimer.unref?.()
}

/** Either the database or an open transaction — both can insert. */
type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]

async function insertMessage(
  db: Executor,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<number> {
  const inserted = await db
    .insert(chatMessages)
    .values({ sessionId, role, content, createdAt: new Date() })
    .returning({ id: chatMessages.id })
    .get()
  return inserted.id
}

/**
 * Serialises one tool call.
 *
 * JSON.stringify can throw on a value the model produced (a circular structure
 * in a tool result, say). Callers must not lose the whole turn over that, so an
 * unserialisable input or output is stored as a short marker rather than
 * propagated — the timeline is a record of what happened, and "could not
 * serialise this" is an accurate record.
 */
function toJson(value: unknown): string | null {
  if (value === null || value === undefined) return null
  try {
    return JSON.stringify(value) ?? null
  } catch {
    return JSON.stringify({ unserialisable: true })
  }
}

async function insertToolCall(
  db: Executor,
  sessionId: string,
  messageId: number,
  position: number,
  call: RecordedToolCall,
): Promise<void> {
  await db
    .insert(chatToolCalls)
    .values({
      sessionId,
      messageId,
      position,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: toJson(call.input),
      output: toJson(call.output),
      status: call.status,
      approved: call.approved,
      durationMs: call.durationMs,
      error: call.error,
      createdAt: new Date(),
    })
    .run()
}

async function insertAttachment(
  db: Executor,
  sessionId: string,
  messageId: number,
  position: number,
  stored: StoredAttachment,
): Promise<void> {
  await db
    .insert(chatAttachments)
    .values({
      id: stored.id,
      messageId,
      position,
      sessionId,
      mediaType: stored.mediaType,
      fileName: stored.fileName,
      path: stored.path,
      width: stored.width,
      height: stored.height,
      byteSize: stored.byteSize,
      createdAt: new Date(),
    })
    .run()
}

async function loadRows(sessionId: string): Promise<ChatMessage[]> {
  const db = getDb()
  const rows = await db
    .select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.id))
    .all()

  const attachmentRows = await db
    .select({
      id: chatAttachments.id,
      messageId: chatAttachments.messageId,
      mediaType: chatAttachments.mediaType,
      fileName: chatAttachments.fileName,
      width: chatAttachments.width,
      height: chatAttachments.height,
      byteSize: chatAttachments.byteSize,
    })
    .from(chatAttachments)
    .where(eq(chatAttachments.sessionId, sessionId))
    // `id` is a UUID, so it cannot order anything; `position` is the order the
    // user arranged the attachments in.
    .orderBy(asc(chatAttachments.messageId), asc(chatAttachments.position))
    .all()

  const toolCallRows = await db
    .select({
      messageId: chatToolCalls.messageId,
      toolCallId: chatToolCalls.toolCallId,
      toolName: chatToolCalls.toolName,
      input: chatToolCalls.input,
      output: chatToolCalls.output,
      status: chatToolCalls.status,
      approved: chatToolCalls.approved,
      durationMs: chatToolCalls.durationMs,
      error: chatToolCalls.error,
    })
    .from(chatToolCalls)
    .where(eq(chatToolCalls.sessionId, sessionId))
    .orderBy(asc(chatToolCalls.messageId), asc(chatToolCalls.position))
    .all()

  const attachmentsByMessage = new Map<number, ChatAttachmentMeta[]>()
  for (const attachment of attachmentRows) {
    const list = attachmentsByMessage.get(attachment.messageId) ?? []
    list.push({
      id: attachment.id,
      mediaType: attachment.mediaType,
      fileName: attachment.fileName,
      width: attachment.width,
      height: attachment.height,
      byteSize: attachment.byteSize,
    })
    attachmentsByMessage.set(attachment.messageId, list)
  }

  const toolCallsByMessage = new Map<number, RecordedToolCall[]>()
  for (const call of toolCallRows) {
    const list = toolCallsByMessage.get(call.messageId) ?? []
    list.push({
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: fromJson(call.input),
      output: fromJson(call.output),
      status: call.status,
      approved: call.approved,
      durationMs: call.durationMs,
      error: call.error,
      // Not persisted; only ever used while the turn is live.
      startedAt: 0,
    })
    toolCallsByMessage.set(call.messageId, list)
  }

  return rows.map((row) => ({
    role: row.role,
    text: row.content,
    attachments: attachmentsByMessage.get(row.id) ?? [],
    toolCalls: toolCallsByMessage.get(row.id) ?? [],
  }))
}

/** Inverse of `toJson`; a row written by an older build may not parse. */
function fromJson(value: string | null): unknown {
  if (value === null) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * Rebuilds the model prompt.
 *
 * History is **text only** — a screenshot is used in model context exactly
 * once, on the turn it was captured for. Re-hydrating every image on every turn
 * would make each request cost grow with the length of the conversation, and
 * the images stay on disk for the UI either way.
 */
async function loadHistory(sessionId: string): Promise<ModelMessage[]> {
  return (await loadRows(sessionId)).map((row) => ({ role: row.role, content: row.text }))
}

/**
 * Text attachments become a `TextPart`, never a `FilePart`.
 *
 * Every provider accepts text parts, but they disagree sharply about file parts:
 * OpenAI takes only `application/pdf`, Anthropic only `application/pdf` and
 * `text/plain`, Google passes the media type through, and xAI refuses any inline
 * non-image file. One encoding that works on all of them is a text part, so that
 * is what a `.md` becomes — the only variant a user can attach to any provider.
 * `scripts/provider-compat.mjs` asserts this matrix against the installed
 * adapters, since a provider upgrade can change it without touching this file.
 *
 * Inlining also suits how this app stores history: as plain text. A document read
 * this way stays in context on later turns, where a re-read file part would have
 * to be re-sent every time.
 */
async function buildUserContent(
  text: string,
  attachments: readonly StoredAttachment[],
): Promise<UserContent> {
  if (attachments.length === 0) return text
  const parts: Array<TextPart | FilePart> = []
  for (const attachment of attachments) {
    if (attachmentKind(attachment.mediaType) === "textual") {
      const body = (await readFile(attachment.path)).toString("utf8")
      parts.push({
        type: "text",
        text: `--- ${attachment.fileName} ---\n${body}\n--- end of ${attachment.fileName} ---`,
      })
      continue
    }
    parts.push({
      type: "file",
      mediaType: attachment.mediaType,
      filename: attachment.fileName,
      // `FilePart`, not `ImagePart`: the latter is deprecated in ai@7.
      data: { type: "data", data: await readFile(attachment.path) },
    })
  }
  return text ? [{ type: "text", text }, ...parts] : parts
}

export async function getChatHistory(sessionId: string): Promise<ChatHistoryResult> {
  try {
    return { ok: true, messages: await loadRows(sessionId) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to load chat history: ${message}` }
  }
}

/** Base64 bytes for one stored attachment, fetched on demand for a thumbnail. */
export async function getAttachmentData(
  attachmentId: string,
): Promise<{ ok: true; mediaType: string; dataBase64: string } | AiError> {
  try {
    const row = await getDb()
      .select({ path: chatAttachments.path, mediaType: chatAttachments.mediaType })
      .from(chatAttachments)
      .where(eq(chatAttachments.id, attachmentId))
      .get()
    if (!row) return { ok: false, error: "Attachment not found." }
    return {
      ok: true,
      mediaType: row.mediaType,
      dataBase64: (await readFile(row.path)).toString("base64"),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to read attachment: ${message}` }
  }
}

function validateAttachments(raw: unknown): IncomingAttachment[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw new Error("Attachments must be a list.")
  if (raw.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new Error(`At most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message.`)
  }
  return raw.map((entry) => {
    const item = entry as Partial<IncomingAttachment>
    if (typeof item?.id !== "string") throw new Error("Attachment is missing an id.")
    if (typeof item.mediaType !== "string") throw new Error("Attachment is missing a media type.")
    if (typeof item.fileName !== "string") throw new Error("Attachment is missing a filename.")
    if (typeof item.dataBase64 !== "string") throw new Error("Attachment is missing its data.")
    return {
      id: item.id,
      // Resolved here, before anything is written, so an unsupported type is
      // refused with its own message rather than behind a "Failed to save
      // message" prefix — and so the capability check below sees a real type
      // instead of the renderer's possibly-empty `File.type`.
      mediaType: resolveMediaType(item.mediaType, item.fileName),
      fileName: item.fileName,
      dataBase64: item.dataBase64,
    }
  })
}

export async function sendChatMessage(
  text: string,
  sessionId: string,
  incoming?: unknown,
): Promise<ChatSendResult> {
  const trimmed = text.trim()
  if (!sessionId) return { ok: false, error: "No chat session is open." }

  let attachments: IncomingAttachment[]
  try {
    attachments = validateAttachments(incoming)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
  // A message can be images with no caption, but it cannot be nothing at all.
  if (!trimmed && attachments.length === 0) return { ok: false, error: "Message is empty." }

  let agent: ToolLoopAgent
  let provider: ProviderId
  let backend: BrowserBackend
  try {
    const resolved = await resolveModelWithProvider()
    provider = resolved.provider
    backend = await getBrowserBackend()
    agent = new ToolLoopAgent({
      model: resolved.model,
      instructions: chatInstructions(backend),
      tools: toolsForBackend(backend),
      stopWhen: stepCountIs(BROWSER_STEP_LIMIT),
      timeout: {
        totalMs: DEEP_STEP_TIMEOUT_MS,
        toolMs: DEEP_STEP_TIMEOUT_MS,
        tools: { browser_deep_taskMs: DEEP_TASK_CALL_TIMEOUT_MS },
      },
      // A single expression rather than a per-tool map: read-only tools run
      // without prompting, everything that can change something waits for a
      // decision. See `browser/tools.ts` for why prompting on reads is harmful.
      // A deep task is the one tool that asks once for a whole run — its opens,
      // clicks and submits all fall under that single decision, and the reason
      // is what tells the user what they are granting.
      toolApproval: ({ toolCall }) => {
        if (isReadOnlyTool(toolCall.toolName)) return "approved"
        if (toolCall.toolName === "browser_deep_task") {
          // ai@7: a toolApproval function may return `{ type, reason }`; the
          // reason surfaces on the card as its caption, read off the request
          // part below.
          return { type: "user-approval", reason: DEEP_TASK_APPROVAL_REASON }
        }
        return "user-approval"
      },
      // Verifies that an approval response came from this app and was not
      // forged by a compromised renderer.
      experimental_toolApprovalSecret: TOOL_APPROVAL_SECRET,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }

  // Checked before the transaction rather than after: persisting the message and
  // its attachment rows and then refusing would leave a stored turn the model
  // never answered.
  if (!supportsInlineDocuments(provider)) {
    const document = attachments.find((a) => attachmentKind(a.mediaType) === "pdf")
    if (document) {
      return {
        ok: false,
        error: `${PROVIDER_INFO[provider].label} cannot read PDF attachments. Paste the text, or attach an image of the page.`,
      }
    }
  }

  let messages: ModelMessage[]
  // Files are written outside SQL, so a failure after the first one would
  // otherwise leave PNGs on disk that no row points at. They are unlinked
  // explicitly if the transaction below throws.
  const writtenPaths: string[] = []
  try {
    const ensured = await ensureSession(sessionId)
    if (!ensured.ok) return ensured
    await autoTitleSession(sessionId, trimmed)

    // History is read before this turn is written, so the new message is simply
    // appended — no need to load everything and drop the last row again.
    const history = await loadHistory(sessionId)

    const stored = await getDb().transaction(async (tx) => {
      const messageId = await insertMessage(tx, sessionId, "user", trimmed)
      const records: StoredAttachment[] = []
      for (const [index, attachment] of attachments.entries()) {
        // The resolved type is what gets persisted, so a file the renderer
        // reported with an empty or wrong `File.type` is stored — and later sent
        // to the model — as the type its bytes actually are.
        const { bytes, mediaType } = decodeAttachment(
          attachment.id,
          attachment.mediaType,
          attachment.fileName,
          attachment.dataBase64,
        )
        // `storeAttachment` mints the permanent id, so two messages can each
        // reference the same draft attachment without colliding.
        const record = await storeAttachment(
          attachment.id,
          bytes,
          mediaType,
          attachment.fileName,
        )
        writtenPaths.push(record.path)
        await insertAttachment(tx, sessionId, messageId, index, record)
        records.push(record)
      }
      return records
    })

    await touchSession(sessionId)
    // History as plain text, then the new turn with its images. The directive a
    // `@`-mentioned tool contributes is appended here — on the way to the model
    // only, after `insertMessage` above has already stored the text the user
    // actually typed.
    const directive = toolMentionDirective(trimmed, backend)
    const modelText = directive ? `${trimmed}\n\n[${directive}]` : trimmed
    messages = [...history, { role: "user", content: await buildUserContent(modelText, stored) }]
  } catch (err) {
    await deleteAttachmentFiles(writtenPaths)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to save message: ${message}` }
  }

  abortActiveStream()
  cancelIdleRelease()
  const controller = new AbortController()
  const turn: ActiveTurn = { controller, denyPending: null, token: randomUUID(), sessionId }
  activeTurn = turn

  // Captures arrive with the session id because the renderer only shows one
  // conversation at a time, exactly like the rest of these events.
  beginCaptures(turn.token, (capture) => {
    emit({
      type: "browser-capture",
      sessionId,
      attachmentId: capture.id,
      mediaType: capture.mediaType,
      width: capture.width,
      height: capture.height,
      dataBase64: capture.dataBase64,
    })
  })

  void (async () => {
    let full = ""
    // Every tool call this turn made, recorded so the activity timeline survives
    // a reload instead of living only in the renderer's memory.
    const toolCalls: RecordedToolCall[] = []
    // Grows across approvals: each resumed call appends what the previous call
    // produced plus this turn's tool message, so the model keeps its context
    // through however many approvals the task needs.
    //
    // `responseMessages` holds only what a call *produced* (its steps, plus
    // tool messages for approvals its input already carried) — never the input
    // itself. The resume must therefore EXTEND this list. Replacing it drops
    // the user message and history, and the next request opens with an
    // assistant function call, which Gemini rejects with a 400 ("function call
    // turn comes immediately after a user turn or after a function response
    // turn"). OpenAI tolerates an assistant-first prompt, so the bug only
    // surfaced on the provider that validates turn order.
    let workingMessages = messages

    try {
      for (;;) {
        const result = await agent.stream({ messages: workingMessages, abortSignal: controller.signal })

        // Every approval this step parked on. Usually one, but the SDK can
        // request several when the model emits parallel tool calls, and all of
        // them have to be answered before the step can resume.
        // `responseMessages` is only available once the stream settles.
        const parked: ParkedApproval[] = []

        for await (const part of result.stream) {
          if (part.type === "text-delta") {
            full += part.text
            emit({ type: "delta", sessionId, text: part.text })
          } else if (part.type === "tool-call") {
            // One entry per call, mutated in place as the call progresses. The
            // SDK can emit a `tool-call` for a call whose approval is still
            // pending, so the row has to exist before the user answers.
            toolCalls.push({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
              output: null,
              status: "done",
              approved: null,
              durationMs: null,
              error: null,
              startedAt: Date.now(),
            })
            emit({
              type: "tool-call",
              sessionId,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            })
          } else if (part.type === "tool-result") {
            const call = toolCalls.find((entry) => entry.toolCallId === part.toolCallId)
            const failure = failedToolOutput(part.output)
            if (call) {
              call.output = part.output
              call.status = failure ? "error" : "done"
              call.error = failure
              call.durationMs = elapsedSince(call)
            }
            emit({
              type: "tool-result",
              sessionId,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            })
          } else if (part.type === "tool-approval-request") {
            // The SDK emits a request for **every** tool that goes through the
            // approval policy, including the ones it has already approved
            // itself — those arrive with `isAutomatic` and are answered in the
            // same step, before the stream moves on. Parking on one would wait
            // for a decision nobody is ever asked to make, so the turn would
            // hang on the very first auto-approved read. Only a request that is
            // still waiting on the user becomes a card.
            if (part.isAutomatic) continue
            const { approvalId, toolCall } = part
            emit({
              type: "approval-request",
              sessionId,
              approvalId,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              input: toolCall.input,
              ...(part.reason ? { reason: part.reason } : {}),
            })
            parked.push({
              approvalId,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              input: toolCall.input,
              ...(part.reason ? { reason: part.reason } : {}),
            })
          } else if (part.type === "error") {
            const err = part.error
            const message = err instanceof Error ? err.message : String(err)
            emit({ type: "error", sessionId, message })
            return
          } else if (part.type === "abort") {
            return
          }
        }

        if (parked.length === 0) break

        // Parked on all of them together. The SDK reads every
        // `tool-approval-response` off the resumed tool message, so answering
        // them in separate passes is not possible — one wait covering the whole
        // batch, one message carrying every decision.
        //
        // Sequentially rather than in parallel so the cards are answered in the
        // order the model asked for them, and so one decision at a time keeps
        // the "what is this doing?" question obvious.
        //
        // Every promise is created before the first one is awaited, though: the
        // cards were all emitted a moment ago, and registering them one at a
        // time would make a fast answer to the second card come back as "no
        // longer waiting" — the user would have to click it again. The *wait*
        // is ordered; the *answerability* is not.
        const answers = new Map<string, Promise<boolean>>()
        for (const approval of parked) {
          answers.set(
            approval.approvalId,
            new Promise<boolean>((resolve) => {
              pendingApprovals.set(approval.approvalId, { resolve, token: turn.token })
            }),
          )
        }
        // A stop while parked must release every unanswered card, or the turn
        // waits forever on a prompt nobody can answer.
        turn.denyPending = () => denyApprovalsFor(turn.token)

        const decisions: { approvalId: string; approved: boolean }[] = []
        for (const approval of parked) {
          const approved = await answers.get(approval.approvalId)!
          if (controller.signal.aborted) return

          const call = toolCalls.find((entry) => entry.toolCallId === approval.toolCallId)
          if (call) {
            call.approved = approved
            if (!approved) {
              // A denied call never produces a result, so it has to be closed
              // out here or the timeline would show it as still running.
              call.status = "denied"
              call.durationMs = elapsedSince(call)
            }
          }

          emit({
            type: "approval-response",
            sessionId,
            approvalId: approval.approvalId,
            toolCallId: approval.toolCallId,
            toolName: approval.toolName,
            approved,
          })
          decisions.push({ approvalId: approval.approvalId, approved })
        }
        turn.denyPending = null

        // Resume the loop: the SDK hands back every message *produced* by this
        // call, which extends the running list — the input messages it was
        // built from are not part of it and must be kept.
        workingMessages = [
          ...workingMessages,
          ...(await result.responseMessages),
          {
            role: "tool",
            content: decisions.map((decision) => ({
              type: "tool-approval-response" as const,
              approvalId: decision.approvalId,
              approved: decision.approved,
            })),
          },
        ]
      }

      const finalText = full.trim()
      // Peeked, not taken: the buffer stays live until every attachment row
      // exists, so a failed insert still has files to clean up.
      const captures = capturesFor(turn.token)

      // A tool call that never produced a result was still something the user
      // watched happen, so it is recorded as stopped rather than dropped. This
      // has to happen before the rows are written, which is why it is a loop
      // over the mutable array rather than something done at insert time.
      for (const call of toolCalls) {
        if (call.status === "done" && call.output === null && call.approved !== false) {
          call.status = "stopped"
          call.durationMs = elapsedSince(call)
        }
      }

      if (finalText || captures.length > 0 || toolCalls.length > 0) {
        // Captures and tool calls are the assistant turn's evidence and no user
        // message comes after them, so they hang off the assistant row. Written
        // after the id is known because `message_id` is not nullable.
        const messageId = await insertMessage(getDb(), sessionId, "assistant", finalText)
        for (const [index, capture] of captures.entries()) {
          await insertAttachment(getDb(), sessionId, messageId, index, capture)
        }
        for (const [index, call] of toolCalls.entries()) {
          await insertToolCall(getDb(), sessionId, messageId, index, call)
        }
        await touchSession(sessionId)
      }
      // Every capture now has a row pointing at it, so the files are reachable
      // and must survive.
      commitCaptures(turn.token)
      emit({ type: "done", sessionId })
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : String(err)
      emit({ type: "error", sessionId, message })
    } finally {
      turn.denyPending = null
      // Token-scoped, like the captures below: an old turn's cleanup must not
      // delete a newer turn's approvals, which would leave that turn parked on
      // promises nobody can reach any more.
      for (const [id, pending] of pendingApprovals) {
        if (pending.token === turn.token) pendingApprovals.delete(id)
      }
      // Anything still buffered at this point never reached a message row: the
      // turn was stopped, the stream ended in error, or an insert threw. Either
      // way nothing points at the files, so deleting them is what stops a
      // browser session from filling the screenshots folder.
      //
      // Token-scoped, so a stopped turn whose cleanup lands after the next turn
      // started cannot delete the *new* turn's captures.
      await abandonCaptures(turn.token)
      if (activeTurn === turn) {
        activeTurn = null
        // The turn is over, so the page is now idle. A browser that was never
        // opened needs no timer at all.
        if (isOpen()) scheduleIdleRelease()
      }
    }
  })()

  return { ok: true }
}

export async function resetChat(sessionId: string): Promise<ChatSendResult> {
  abortActiveStream()
  try {
    await clearSessionMessages(sessionId)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to reset chat: ${message}` }
  }
}
