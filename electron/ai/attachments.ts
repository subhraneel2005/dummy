import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import { app, nativeImage } from "electron"

/**
 * What the renderer needs to stage a capture in the composer. The bytes travel
 * as base64 because the chat renderer cannot read a path inside `userData` (it
 * is a sandboxed http://localhost page), and because one IPC hop is cheaper than
 * teaching the renderer a file:// scheme.
 */
export interface StagedCapture {
  id: string
  mediaType: string
  fileName: string
  dataBase64: string
  width: number
  height: number
  byteSize: number
}

/** What reaches the model. `path` is written by this process, never the renderer. */
export interface StoredAttachment {
  id: string
  mediaType: string
  fileName: string
  path: string
  width: number
  height: number
  byteSize: number
}

export const MAX_ATTACHMENTS_PER_MESSAGE = 10
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

const ALLOWED_MEDIA_TYPES = new Set(["image/png", "image/jpeg"])

/** Zero-padded so a lexicographic sort is the capture order. */
const SEQ_PREFIX = /^(\d{3})-/

/**
 * Ids reach the filesystem, so they are validated against a strict pattern
 * rather than trusted. `holdId` is a UUID minted in main, and renderer-supplied
 * attachment ids are opaque, so neither should ever contain a separator — this
 * only exists so a bug elsewhere cannot turn into a path traversal.
 */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/

function assertSafeId(value: string, label: string): string {
  if (!SAFE_ID.test(value)) throw new Error(`Unsafe ${label}: ${value}`)
  return value
}

function extensionFor(mediaType: string): string {
  return mediaType === "image/jpeg" ? "jpg" : "png"
}

/** Keeps a readable name without letting the renderer shape the path. */
function safeFileName(name: string, mediaType: string): string {
  const stem = path
    .basename(name)
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w.-]/g, "_")
    .slice(0, 80)
  return `${stem || "image"}.${extensionFor(mediaType)}`
}

/** Decoded pixel size, or 0x0 if the bytes are not a readable image. */
function imageSize(bytes: Buffer): { width: number; height: number } {
  try {
    const size = nativeImage.createFromBuffer(bytes).getSize()
    return { width: size.width, height: size.height }
  } catch {
    return { width: 0, height: 0 }
  }
}

export function screenshotsDir(): string {
  return path.join(app.getPath("userData"), "screenshots")
}

function stagingRoot(): string {
  return path.join(screenshotsDir(), "staging")
}

export function isAllowedMediaType(mediaType: string): boolean {
  return ALLOWED_MEDIA_TYPES.has(mediaType)
}

/**
 * Writes one capture into the staging area for a dictation hold.
 *
 * Every selection becomes its own file, even when two selections are pixel
 * identical — taking a screenshot twice is a deliberate act, and a content-hash
 * dedupe here would make the capture counter disagree with the number of
 * attachments the composer eventually shows.
 *
 * Not safe to call concurrently for the same hold: it reads the directory to
 * work out the next sequence number. Main serialises capture work on
 * `captureBusy`, so there is exactly one writer.
 */
export async function stageCapture(
  holdId: string,
  png: Buffer,
  width: number,
  height: number,
): Promise<StagedCapture> {
  assertSafeId(holdId, "hold id")
  const dir = path.join(stagingRoot(), holdId)
  await fs.mkdir(dir, { recursive: true })

  const id = createHash("sha256").update(png).digest("hex").slice(0, 32)
  const entries = await fs.readdir(dir)
  const taken = entries.filter((entry) => entry.endsWith(".png")).length
  // A content hash carries no ordering information, so the zero-padded sequence
  // number is what makes `readStagedCaptures` hand captures back in the order
  // the user took them.
  const fileName = `${String(taken + 1).padStart(3, "0")}-${id}.png`
  await fs.writeFile(path.join(dir, fileName), png)

  return {
    id,
    mediaType: "image/png",
    fileName,
    dataBase64: png.toString("base64"),
    width,
    height,
    byteSize: png.byteLength,
  }
}

async function readCaptureFile(filePath: string): Promise<StagedCapture> {
  const png = await fs.readFile(filePath)
  const fileName = path.basename(filePath)
  const seq = SEQ_PREFIX.exec(fileName)?.[1]
  // Dimensions are not persisted next to the bytes; decoding them on read is
  // cheaper than a second file and cannot drift out of sync with the image.
  const { width, height } = imageSize(png)
  return {
    id: fileName.replace(SEQ_PREFIX, "").replace(/\.png$/, ""),
    mediaType: "image/png",
    fileName: seq ? `${Number(seq)}.png` : fileName,
    dataBase64: png.toString("base64"),
    width,
    height,
    byteSize: png.byteLength,
  }
}

/** Every capture staged during one hold, in capture order. */
export async function readStagedCaptures(holdId: string): Promise<StagedCapture[]> {
  assertSafeId(holdId, "hold id")
  const dir = path.join(stagingRoot(), holdId)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }

  const captures: StagedCapture[] = []
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".png")) continue
    captures.push(await readCaptureFile(path.join(dir, entry)))
  }
  return captures
}

export async function dropStagedCaptures(holdId: string): Promise<void> {
  try {
    await fs.rm(path.join(stagingRoot(), holdId), { recursive: true, force: true })
  } catch {
    // Best effort: a leftover staging dir is swept on the next start.
  }
}

/**
 * Staging survives a crash or a quit mid-hold, so anything left behind is
 * unreachable by definition — no hold id will ever ask for it again.
 */
export async function pruneStaging(): Promise<void> {
  try {
    await fs.rm(stagingRoot(), { recursive: true, force: true })
  } catch {
    // Nothing to prune.
  }
}

/**
 * Moves one attachment into permanent storage and returns its record.
 *
 * The stored id is minted here, not taken from the renderer. A composer id is
 * only unique within one draft, while `chat_attachments.id` is a primary key
 * across every session — reusing the composer's id would break the second time
 * anyone sent the same image.
 */
export async function storeAttachment(
  rendererId: string,
  bytes: Buffer,
  mediaType: string,
  fileName: string,
): Promise<StoredAttachment> {
  assertSafeId(rendererId, "attachment id")
  if (!isAllowedMediaType(mediaType)) {
    throw new Error(`Unsupported attachment type: ${mediaType}`)
  }
  const dir = screenshotsDir()
  await fs.mkdir(dir, { recursive: true })

  const id = randomUUID()
  const storedName = safeFileName(fileName, mediaType)
  const filePath = path.join(dir, `${id}.${extensionFor(mediaType)}`)
  await fs.writeFile(filePath, bytes)

  const { width, height } = imageSize(bytes)
  return {
    id,
    mediaType,
    fileName: storedName,
    path: filePath,
    width,
    height,
    byteSize: bytes.byteLength,
  }
}

/** Decodes one renderer-supplied attachment. Callers must have validated the shape. */
export function decodeAttachment(
  id: string,
  mediaType: string,
  fileName: string,
  dataBase64: string,
): { bytes: Buffer; width: number; height: number } {
  assertSafeId(id, "attachment id")
  if (!isAllowedMediaType(mediaType)) {
    throw new Error(`Unsupported attachment type: ${mediaType}`)
  }
  if (typeof dataBase64 !== "string" || dataBase64.length === 0) {
    throw new Error("Attachment is empty.")
  }
  // Base64 expands by 4/3, so an oversized payload is rejected from its encoded
  // length instead of being decoded into memory first.
  const maxEncoded = Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 4
  if (dataBase64.length > maxEncoded) {
    throw new Error(
      `Attachment is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.`,
    )
  }

  const bytes = Buffer.from(dataBase64, "base64")
  if (bytes.byteLength === 0) throw new Error("Attachment is empty.")
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `Attachment is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB.`,
    )
  }

  // Also rejects non-image bytes that happen to be under the size cap: the model
  // would reject them later with a far less specific error.
  const { width, height } = imageSize(bytes)
  if (width === 0 || height === 0) throw new Error("Attachment is not a readable image.")

  return { bytes, width, height }
}

/** Removes files for deleted messages/sessions. Missing files are not an error. */
export async function deleteAttachmentFiles(paths: readonly string[]): Promise<void> {
  await Promise.all(
    paths.map(async (filePath) => {
      // Only ever unlink inside our own screenshots directory.
      const resolved = path.resolve(filePath)
      if (!resolved.startsWith(path.resolve(screenshotsDir()) + path.sep)) return
      try {
        await fs.rm(resolved, { force: true })
      } catch {
        // Best effort.
      }
    }),
  )
}
