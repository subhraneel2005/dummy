/**
 * Screenshots taken by the browser, between the tool that captures them and the
 * transcript that shows them.
 *
 * The gap exists because of where a screenshot lives in a conversation. The
 * model cannot see an image (`ToolResultOutput` is text/JSON only), so a
 * screenshot has exactly one audience: the user. That makes it an *attachment*
 * like any other, which means it needs a message row before it can be fetched
 * back by id — but the assistant message does not exist until the turn ends,
 * and a turn can take many steps.
 *
 * So the bytes are written to their final path immediately (via
 * `storeAttachment`, which mints the permanent id), kept here until the turn
 * ends, and attached to the assistant message at that point. The id is usable
 * straight away, which is what lets the UI render the capture while the model
 * is still working.
 *
 * Buffers are keyed by an owner token handed out by `beginCaptures`, and only
 * the owning turn may finish or abandon its own buffer. That is what makes a
 * stopped turn unable to delete the captures of the turn that replaced it.
 *
 * Nothing here persists across a restart: `pruneStaging` and the message-scoped
 * attachment rows own that, and an unpaired capture is deleted with its turn.
 */
import { randomUUID } from "node:crypto"
import { unlink } from "node:fs/promises"

import { storeAttachment, type StoredAttachment } from "../ai/attachments.js"
import { downscale } from "../capture.js"
import { takeScreenshot } from "./window.js"

/** A capture that has a file and an id, but no message row yet. */
export interface BrowserCapture extends StoredAttachment {
  /** Base64 PNG, so the renderer can show it before the turn ends. */
  dataBase64: string
}

/** The turn in flight. Only one chat turn runs at a time, so only one is live. */
let active: {
  token: string
  captures: BrowserCapture[]
  onCapture: (capture: BrowserCapture) => void | null
} | null = null

/**
 * Starts collecting captures for a turn.
 *
 * If a previous turn's buffer is still live, it was abandoned without being told
 * (its process died, say), so its files go now. Clearing it here — rather than
 * leaving it for the old turn's own cleanup — is what keeps an abandoned buffer
 * from outliving the turn that owned it.
 */
export function beginCaptures(token: string, onCapture: (capture: BrowserCapture) => void | null): void {
  if (active) void deleteFiles(active.captures)
  active = { token, captures: [], onCapture }
}

/**
 * The owning turn's captures, for attaching to its message.
 *
 * Read-only and repeatable, because the caller needs the length *before* it
 * knows whether a message is needed at all, then one entry per attachment row.
 * Empty once the buffer is committed or abandoned.
 */
export function capturesFor(token: string): readonly BrowserCapture[] {
  return active?.token === token ? active.captures : []
}

/**
 * Releases the buffer's files without deleting them, now that every capture has
 * an attachment row pointing at it. No-op unless this turn owns the buffer.
 */
export function commitCaptures(token: string): void {
  if (active?.token !== token) return
  active = null
}

/**
 * Deletes the turn's unpaired captures, because a message write failed, the turn
 * was stopped, or the stream ended in error.
 *
 * Refuses to act on a buffer this turn does not own: a stopped turn running its
 * cleanup late must not delete the captures of the turn that replaced it.
 */
export async function abandonCaptures(token: string): Promise<void> {
  if (active?.token !== token) return
  const dropped = active.captures
  active = null
  await deleteFiles(dropped)
}

async function deleteFiles(captures: readonly BrowserCapture[]): Promise<void> {
  // Best-effort: an unpaired capture has no row pointing at it, so leaving the
  // file behind would leak disk space for a picture nobody can reach.
  await Promise.allSettled(captures.map((capture) => unlink(capture.path)))
}

/**
 * Captures the current page and returns only metadata.
 *
 * The model gets `{ attachmentId, width, height }` and nothing else: it cannot
 * read the image, and handing it base64 would spend tokens on a picture it has
 * no way to interpret.
 */
export async function captureScreenshot(): Promise<{
  attachmentId: string
  width: number
  height: number
  byteSize: number
  shown: true
}> {
  const { png, width, height } = downscale(await takeScreenshot())

  const stored = await storeAttachment(
    // The renderer never sees this id, so it is minted here rather than passed
    // in: `storeAttachment` asserts its id is safe to embed in a path, and a
    // value from a tool argument would not be.
    randomUUID(),
    png,
    "image/png",
    "browser.png",
  )

  // Tools only run inside a turn, so `active` is set. The guard is there so a
  // stray call still gets a valid attachment id rather than a crash.
  if (active) {
    const capture: BrowserCapture = { ...stored, dataBase64: png.toString("base64") }
    active.captures.push(capture)
    active.onCapture?.(capture)
  }

  return { attachmentId: stored.id, width, height, byteSize: stored.byteSize, shown: true }
}