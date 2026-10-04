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

/**
 * Byte ceilings are per category rather than one global number. 8MB is generous
 * for a screenshot and stingy for a document, so documents get room to be
 * documents; text is inlined into the request body, so it is held to a cap that
 * keeps one pasted file from swamping the prompt.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_TEXTUAL_BYTES = 1024 * 1024

/**
 * What an accepted media type implies about handling.
 *
 * - `image` and `pdf` are sent to the model as a `FilePart` with these bytes.
 * - `textual` is *not* a file part. It is decoded to text and inlined at
 *   `buildUserContent`, because that is the only encoding every provider here
 *   accepts (see `WORD_UNSUPPORTED` for why the list cannot just be widened).
 */
export type AttachmentKind = "image" | "pdf" | "textual"

const MEDIA_TYPES = new Map<string, { kind: AttachmentKind; ext: string }>([
  ["image/png", { kind: "image", ext: "png" }],
  ["image/jpeg", { kind: "image", ext: "jpg" }],
  ["application/pdf", { kind: "pdf", ext: "pdf" }],
  ["text/markdown", { kind: "textual", ext: "md" }],
  ["text/plain", { kind: "textual", ext: "txt" }],
  ["text/csv", { kind: "textual", ext: "csv" }],
])

const MAX_BYTES: Record<AttachmentKind, number> = {
  image: MAX_IMAGE_BYTES,
  pdf: MAX_PDF_BYTES,
  textual: MAX_TEXTUAL_BYTES,
}

/**
 * `File.type` is empty for plenty of files picked off a disk, so the extension
 * is the fallback that keeps `.md` and `.csv` attachable at all.
 */
const EXTENSION_MEDIA_TYPES = new Map<string, string>([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["pdf", "application/pdf"],
  ["md", "text/markdown"],
  ["markdown", "text/markdown"],
  ["txt", "text/plain"],
  ["csv", "text/csv"],
])

/**
 * Word and OpenDocument are recognised only so they can be refused by name.
 *
 * They cannot be widened into `MEDIA_TYPES`: OpenAI and xAI throw
 * `UnsupportedFunctionalityError` on any inline file part that is not
 * `application/pdf`, and Anthropic accepts only `application/pdf` and
 * `text/plain` — Word reaches Anthropic exclusively through its Files API, which
 * the AI SDK's prompt conversion does not use. Sending the bytes anyway would
 * surface that provider error to the user verbatim, so it is refused here with
 * something they can act on.
 */
const WORD_MEDIA_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/vnd.oasis.opendocument.text",
])

const WORD_EXTENSIONS = new Set(["doc", "docx", "odt"])

const WORD_UNSUPPORTED =
  "Word and OpenDocument files can't be attached — no AI provider here accepts " +
  "them as a file. Export the document to PDF, or paste the text into the message."

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

function extensionOf(fileName: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName.trim())
  return match?.[1]?.toLowerCase() ?? ""
}

/**
 * The single place a media type is decided.
 *
 * Both storing and decoding go through this so a file cannot be accepted under
 * one type and later written under another. A claimed type the registry knows
 * wins; otherwise the extension decides; Word is refused on either signal.
 */
export function resolveMediaType(mediaType: string, fileName: string): string {
  const claimed = (mediaType ?? "").trim().toLowerCase()
  const ext = extensionOf(fileName)
  if (WORD_MEDIA_TYPES.has(claimed) || WORD_EXTENSIONS.has(ext)) {
    throw new Error(WORD_UNSUPPORTED)
  }
  if (MEDIA_TYPES.has(claimed)) return claimed
  const fromExt = EXTENSION_MEDIA_TYPES.get(ext)
  if (fromExt) return fromExt
  throw new Error(`Unsupported attachment type: ${claimed || fileName || "unknown"}`)
}

function entryFor(mediaType: string): { kind: AttachmentKind; ext: string } {
  const entry = MEDIA_TYPES.get(mediaType)
  if (!entry) throw new Error(`Unsupported attachment type: ${mediaType}`)
  return entry
}

export function attachmentKind(mediaType: string): AttachmentKind {
  return entryFor(mediaType).kind
}

export function isImageMediaType(mediaType: string): boolean {
  return MEDIA_TYPES.get(mediaType)?.kind === "image"
}

/** The cap a given type is held to, phrased for an error message. */
export function maxBytesFor(mediaType: string): number {
  return MAX_BYTES[entryFor(mediaType).kind]
}

function maxMb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`
}

/** Keeps a readable name without letting the renderer shape the path. */
function safeFileName(name: string, mediaType: string): string {
  const stem = path
    .basename(name)
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w.-]/g, "_")
    .slice(0, 80)
  return `${stem || "attachment"}.${entryFor(mediaType).ext}`
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

export function isAllowedMediaType(mediaType: string, fileName = ""): boolean {
  try {
    resolveMediaType(mediaType, fileName)
    return true
  } catch {
    return false
  }
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
  const resolved = resolveMediaType(mediaType, fileName)
  const limit = maxBytesFor(resolved)
  if (bytes.byteLength > limit) {
    throw new Error(`Attachment is larger than ${maxMb(limit)}.`)
  }
  const dir = screenshotsDir()
  await fs.mkdir(dir, { recursive: true })

  const id = randomUUID()
  const storedName = safeFileName(fileName, resolved)
  const filePath = path.join(dir, `${id}.${entryFor(resolved).ext}`)
  await fs.writeFile(filePath, bytes)

  // Dimensions only mean something for images. Documents and text are stored as
  // 0x0 rather than a nullable column, because nothing reads width/height for
  // layout and a migration would buy nothing.
  const size = isImageMediaType(resolved)
    ? imageSize(bytes)
    : { width: 0, height: 0 }
  return {
    id,
    mediaType: resolved,
    fileName: storedName,
    path: filePath,
    width: size.width,
    height: size.height,
    byteSize: bytes.byteLength,
  }
}

/** Decodes one renderer-supplied attachment. Callers must have validated the shape. */
export function decodeAttachment(
  id: string,
  mediaType: string,
  fileName: string,
  dataBase64: string,
): { bytes: Buffer; mediaType: string; width: number; height: number } {
  assertSafeId(id, "attachment id")
  const resolved = resolveMediaType(mediaType, fileName)
  if (typeof dataBase64 !== "string" || dataBase64.length === 0) {
    throw new Error("Attachment is empty.")
  }
  const limit = maxBytesFor(resolved)
  // Base64 expands by 4/3, so an oversized payload is rejected from its encoded
  // length instead of being decoded into memory first.
  const maxEncoded = Math.ceil((limit * 4) / 3) + 4
  if (dataBase64.length > maxEncoded) {
    throw new Error(`Attachment is larger than ${maxMb(limit)}.`)
  }

  const bytes = Buffer.from(dataBase64, "base64")
  if (bytes.byteLength === 0) throw new Error("Attachment is empty.")
  if (bytes.byteLength > limit) {
    throw new Error(`Attachment is larger than ${maxMb(limit)}.`)
  }

  if (isImageMediaType(resolved)) {
    // Rejects bytes that are not actually an image: the model would otherwise
    // reject them later with a far less specific error.
    const size = imageSize(bytes)
    if (size.width === 0 || size.height === 0) throw new Error("Attachment is not a readable image.")
    return { bytes, mediaType: resolved, width: size.width, height: size.height }
  }

  if (attachmentKind(resolved) === "pdf" && bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("Attachment is not a readable PDF.")
  }

  // Text is inlined into the prompt, so binary masquerading as `.txt` would put
  // mojibake in front of the model. A NUL in the first chunk is enough to tell.
  if (attachmentKind(resolved) === "textual" && bytes.subarray(0, 2048).includes(0)) {
    throw new Error("Attachment is not a readable text file.")
  }

  return { bytes, mediaType: resolved, width: 0, height: 0 }
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
