/**
 * The REA skill's tools.
 *
 * Three calls, deliberately small:
 *   - `rea_resolve_target` turns whatever the user said (app name, path, URL)
 *     into a concrete path or URL. Read-only, so it needs no approval.
 *   - `rea_download` acquires a target that is not local: Homebrew cask for a
 *     macOS app, or a streamed download + extract for an archive URL.
 *   - `rea_run` executes one non-blocked REA subcommand and writes the evidence
 *     envelope to `rea_output/`, returning only a capped preview.
 *
 * Nothing here uses `spawnSync`: REA is long-running and a synchronous call
 * would freeze the main process (the exact bug Feature 8 hit). Arguments are
 * passed as an array, never through a shell.
 */
import { execFile as execFileCallback } from "node:child_process"
import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { promisify } from "node:util"

import { tool, type ToolSet } from "ai"
import { app } from "electron"
import { z } from "zod"

const execFile = promisify(execFileCallback)

const PROJECT_ROOT = path.resolve(app.getAppPath(), "..")
const OUTPUT_DIR = path.join(PROJECT_ROOT, "rea_output")
const DOWNLOAD_DIR = path.join(PROJECT_ROOT, "rea_downloads")

const REA_TIMEOUT_MS = 10 * 60_000
const BREW_TIMEOUT_MS = 10 * 60_000
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000

/**
 * Commands that start, install, instrument, or rewrite things. Everything else
 * under `rea` is an analysis command and is allowed. The list is a safety rail,
 * not the only one: `rea_run` still requires the user's approval.
 */
const BLOCKED_EXACT = new Set([
  "setup",
  "uninstall",
  "update",
  "mcp",
  "completions",
  "capabilities",
  "providers",
  "doctor",
  "evidence-export",
  "evidence-import",
  "open-jeb-project",
  "execute-rizin-command",
  "cutter-command",
  "capture-process",
  "capture-electron-scenario",
  "capture-native-ui-scenario",
  "observe-native-calls",
  "instrument-with-frida",
  "debug-with-gdb",
  "debug-with-rizin",
])

const BLOCKED_PREFIXES = [
  "install-",
  "uninstall-",
  "push-",
  "pull-",
  "start-",
  "stop-",
  "import-",
  "write-",
]

const COMMAND = /^[a-z][a-z0-9-]{0,63}$/

export interface ReaProgressEvent {
  sessionId: string
  type: "log" | "done" | "error"
  text: string
}

let progressSink: ((event: ReaProgressEvent) => void) | null = null
let currentSessionId = ""

/** Wired in `main.ts` to the chat window's `rea:event` channel. */
export function setReaProgressSink(sink: ((event: ReaProgressEvent) => void) | null): void {
  progressSink = sink
}

/**
 * Progress is emitted by a tool, and tools get no IPC context. The turn sets
 * the session for its duration so a run started in one chat cannot be rendered
 * in another.
 */
export function setReaSession(sessionId: string): void {
  currentSessionId = sessionId
}

function emit(type: ReaProgressEvent["type"], text: string): void {
  console.log(`[rea:${type}] ${text}`)
  try {
    progressSink?.({ sessionId: currentSessionId, type, text })
  } catch {
    // The chat window can close mid-run. The analysis itself still finishes and
    // its evidence is still written; only the live log is lost.
  }
}

interface ProcessResult {
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
  aborted: boolean
  spawnError: string | null
}

/**
 * Runs one child process, buffering stdout while streaming stderr lines.
 *
 * A partial stderr line is held until its newline arrives, because progress
 * envelopes are split across chunk boundaries often enough to matter.
 */
function runProcess(
  command: string,
  args: string[],
  options: {
    timeoutMs?: number
    signal?: AbortSignal | undefined
    onLine?: ((line: string) => void) | undefined
  } = {},
): Promise<ProcessResult> {
  const { timeoutMs = REA_TIMEOUT_MS, signal, onLine } = options
  return new Promise((resolve) => {
    let stdout = ""
    let stderr = ""
    let pending = ""
    let settled = false
    let timedOut = false
    let aborted = false

    const finish = (code: number, spawnError: string | null = null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      resolve({ code, stdout, stderr, timedOut, aborted, spawnError })
    }

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(command, args, {
        cwd: PROJECT_ROOT,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (err) {
      resolve({
        code: -1,
        stdout: "",
        stderr: "",
        timedOut: false,
        aborted: false,
        spawnError: err instanceof Error ? err.message : String(err),
      })
      return
    }

    const kill = () => {
      try {
        child.kill("SIGKILL")
      } catch {
        // Already gone.
      }
    }

    const timer = setTimeout(() => {
      timedOut = true
      kill()
      finish(-1)
    }, timeoutMs)
    timer.unref?.()

    const onAbort = () => {
      aborted = true
      kill()
      finish(-1)
    }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener("abort", onAbort, { once: true })

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      pending += text
      let index = pending.indexOf("\n")
      while (index >= 0) {
        const line = pending.slice(0, index).trim()
        pending = pending.slice(index + 1)
        if (line) onLine?.(line)
        index = pending.indexOf("\n")
      }
    })
    child.on("error", (err) => finish(-1, err.message))
    child.on("close", (code) => {
      const last = pending.trim()
      if (last) onLine?.(last)
      finish(code ?? -1)
    })
  })
}

/** A `rea_progress` envelope is JSON; show its message, not the raw object. */
function formatProgress(line: string): string {
  try {
    const parsed = JSON.parse(line) as {
      rea_progress?: { message?: string; phase?: string; completed?: number; total?: number }
    }
    const progress = parsed.rea_progress
    if (progress) {
      const counter =
        typeof progress.completed === "number" &&
        typeof progress.total === "number" &&
        progress.total > 0
          ? ` [${progress.completed}/${progress.total}]`
          : ""
      return `${progress.message || progress.phase || line}${counter}`
    }
  } catch {
    // Not a progress envelope.
  }
  return line
}

function expandHome(value: string): string {
  if (value === "~") return os.homedir()
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2))
  return value
}

async function isFile(value: string): Promise<boolean> {
  try {
    return (await fs.stat(value)).isFile()
  } catch {
    return false
  }
}

async function isDirectory(value: string): Promise<boolean> {
  try {
    return (await fs.stat(value)).isDirectory()
  } catch {
    return false
  }
}

function appName(query: string): string {
  return path.basename(query.trim()).replace(/\.app$/i, "").trim()
}

function caskSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const APP_DIRS = [
  "/Applications",
  path.join(os.homedir(), "Applications"),
  "/System/Applications",
  "/System/Applications/Utilities",
]

async function findInstalledApp(name: string): Promise<string | null> {
  const wanted = `${name}.app`.toLowerCase()
  for (const root of APP_DIRS) {
    try {
      const entries = await fs.readdir(root)
      const hit = entries.find((entry) => entry.toLowerCase() === wanted)
      if (hit) return path.join(root, hit)
    } catch {
      // Missing or unreadable directory; try the next one.
    }
  }
  // Spotlight catches apps outside the standard roots (e.g. a custom folder).
  try {
    const wantedName = `${name}.app`.replace(/'/g, "")
    const { stdout } = await execFile(
      "mdfind",
      [`kMDItemFSName == '${wantedName}'c`],
      { timeout: 10_000, maxBuffer: 1024 * 1024 },
    )
    const first = stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.toLowerCase().endsWith(".app"))
    if (first && (await isDirectory(first))) return first
  } catch {
    // Spotlight is optional.
  }
  return null
}

type Resolved =
  | { ok: true; kind: "path"; path: string; app: boolean }
  | { ok: true; kind: "download"; url: string }
  | { ok: true; kind: "url"; url: string }
  | { ok: true; kind: "missing"; query: string; slug: string; suggestion: string }
  | { ok: false; error: string }

async function resolveTarget(raw: string): Promise<Resolved> {
  const query = raw.trim()
  if (!query) return { ok: false, error: "Give a path, an app name, or a URL." }

  const expanded = expandHome(query)
  if (await isFile(expanded)) return { ok: true, kind: "path", path: expanded, app: false }
  if (await isDirectory(expanded)) {
    return { ok: true, kind: "path", path: expanded, app: expanded.toLowerCase().endsWith(".app") }
  }

  if (/^https?:\/\//i.test(query)) {
    if (/\.(dmg|zip|ipa|apk|exe|msi|pkg|tar\.gz|tgz)(\?.*)?$/i.test(query)) {
      return { ok: true, kind: "download", url: query }
    }
    return { ok: true, kind: "url", url: query }
  }

  const name = appName(query)
  if (name) {
    const installed = await findInstalledApp(name)
    if (installed) return { ok: true, kind: "path", path: installed, app: true }
  }

  const slug = caskSlug(name || query)
  return {
    ok: true,
    kind: "missing",
    query,
    slug,
    suggestion: slug ? `brew install --cask ${slug}` : "",
  }
}

function safeName(value: string): string {
  return (value || "target").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)
}

async function saveEvidence(label: string, stdout: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const file = path.join(OUTPUT_DIR, `${label}-${stamp}.json`)
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.writeFile(file, stdout, "utf-8")
  return file
}

/** The useful part of an REA envelope, capped so a 10 MB result stays legible. */
function previewOf(stdout: string): { preview: string; byteSize: number } {
  const byteSize = Buffer.byteLength(stdout)
  let parsed: unknown = null
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return {
      preview: `${stdout.slice(0, 4000)}${stdout.length > 4000 ? "\n…(truncated)" : ""}`,
      byteSize,
    }
  }
  const envelope = parsed as {
    normalized_result?: unknown
    raw_result?: unknown
    result?: unknown
  }
  const analysis = envelope?.normalized_result ?? envelope?.raw_result ?? envelope?.result ?? parsed
  let preview: string
  if (Array.isArray(analysis)) {
    preview = `Parsed ${analysis.length} entries.\n\n${JSON.stringify(analysis.slice(0, 2), null, 2)}`
  } else {
    preview = JSON.stringify(analysis, null, 2)
  }
  if (preview.length > 4000) preview = `${preview.slice(0, 4000)}\n…(truncated)`
  return { preview, byteSize }
}

async function downloadFile(url: string, abortSignal?: AbortSignal): Promise<string> {
  // A stalled download must not outlive the turn. `AbortSignal.any` keeps the
  // user's Stop working while the size/duration guard runs alongside it.
  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
  const signal = abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout
  const res = await fetch(url, { signal })
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  }
  const parsed = new URL(url)
  const fromPath = decodeURIComponent(parsed.pathname.split("/").pop() || "")
  const fileName = safeName(fromPath || "download")
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true })
  const dest = path.join(DOWNLOAD_DIR, fileName)
  await pipeline(
    Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream),
    createWriteStream(dest),
  )
  return dest
}

async function findAppBundle(root: string, depth = 4): Promise<string | null> {
  if (depth < 0) return null
  let entries: import("node:fs").Dirent[]
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const full = path.join(root, entry.name)
    if (entry.name.toLowerCase().endsWith(".app")) return full
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = await findAppBundle(path.join(root, entry.name), depth - 1)
    if (found) return found
  }
  return null
}

async function extractArchive(file: string): Promise<string> {
  const lower = file.toLowerCase()
  if (lower.endsWith(".zip")) {
    const out = `${file.replace(/\.zip$/i, "")}-extracted`
    await fs.mkdir(out, { recursive: true })
    const result = await runProcess("unzip", ["-q", "-o", file, "-d", out], {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    })
    if (result.code !== 0) {
      throw new Error(`unzip failed: ${result.stderr.trim() || result.spawnError || result.code}`)
    }
    return (await findAppBundle(out)) ?? out
  }

  if (lower.endsWith(".dmg")) {
    const mount = `${file.replace(/\.dmg$/i, "")}-mount`
    await fs.mkdir(mount, { recursive: true })
    const attach = await runProcess(
      "hdiutil",
      ["attach", "-nobrowse", "-readonly", "-mountpoint", mount, file],
      { timeoutMs: DOWNLOAD_TIMEOUT_MS },
    )
    if (attach.code !== 0) {
      throw new Error(
        `hdiutil attach failed: ${attach.stderr.trim() || attach.spawnError || attach.code}`,
      )
    }
    try {
      const bundle = await findAppBundle(mount)
      if (!bundle) throw new Error("No .app bundle found in the mounted image.")
      const dest = path.join(DOWNLOAD_DIR, path.basename(bundle))
      await fs.rm(dest, { recursive: true, force: true })
      const copy = await runProcess("cp", ["-R", bundle, dest], { timeoutMs: DOWNLOAD_TIMEOUT_MS })
      if (copy.code !== 0) {
        throw new Error(`cp failed: ${copy.stderr.trim() || copy.spawnError || copy.code}`)
      }
      return dest
    } finally {
      await runProcess("hdiutil", ["detach", mount, "-quiet"], { timeoutMs: 60_000 })
      await fs.rm(mount, { recursive: true, force: true })
    }
  }

  // .ipa, .apk, .exe, .pkg: they are already the artifact REA wants.
  return file
}

export const reaTools: ToolSet = {
  rea_resolve_target: tool({
    description:
      "Resolve whatever the user named into a concrete local path or URL. Accepts an app name " +
      "(Discord), an absolute or ~ path, or an http(s) URL. Returns kind=path with the local " +
      "path, kind=download for an archive URL, kind=url for a web page, or kind=missing with a " +
      "Homebrew cask suggestion. Call this first; never ask the user for a path before trying it.",
    inputSchema: z.object({
      query: z.string().min(1).max(500).describe("App name, path, or URL exactly as the user said it"),
    }),
    execute: async ({ query }) => resolveTarget(query),
  }),

  rea_download: tool({
    description:
      "Acquire a target that is not available locally. A bare app name installs its Homebrew " +
      "cask; an archive URL (.dmg, .zip, .ipa, .apk, .exe) is downloaded and extracted. Returns " +
      "the local path. This writes to disk and installs software, so it requires approval.",
    inputSchema: z.object({
      query: z.string().min(1).max(500).describe("App name or archive URL to acquire"),
      method: z
        .enum(["auto", "brew", "url"])
        .default("auto")
        .describe("auto picks brew for a name and url for a link"),
    }),
    execute: async ({ query, method }, { abortSignal }) => {
      const resolved = await resolveTarget(query)
      if (!resolved.ok) return resolved
      if (resolved.kind === "path") {
        return { ok: true, path: resolved.path, alreadyPresent: true }
      }
      if (resolved.kind === "url") {
        return {
          ok: false,
          error:
            "That is a web page, not an installable artifact. Use rea_run with inspect-web-page " +
            "or analyze-web-bundle against a CDP endpoint instead.",
        }
      }

      if (resolved.kind === "download") {
        if (method === "brew") {
          return { ok: false, error: "Homebrew installs app names, not archive URLs." }
        }
        emit("log", `Downloading ${resolved.url}`)
        try {
          const file = await downloadFile(resolved.url, abortSignal)
          emit("log", `Downloaded to ${file}`)
          const target = await extractArchive(file)
          emit("done", `Target ready at ${target}`)
          return { ok: true, path: target, downloaded: true }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          emit("error", message)
          return { ok: false, error: message }
        }
      }

      if (resolved.kind === "missing") {
        if (!resolved.slug) {
          return { ok: false, error: "Could not derive a Homebrew cask name from that query." }
        }
        emit("log", `Installing ${resolved.slug} with Homebrew`)
        const result = await runProcess("brew", ["install", "--cask", resolved.slug], {
          timeoutMs: BREW_TIMEOUT_MS,
          signal: abortSignal,
          onLine: (line) => emit("log", line),
        })
        if (result.timedOut) {
          const message = "Homebrew install timed out."
          emit("error", message)
          return { ok: false, error: message }
        }
        if (result.spawnError) {
          emit("error", `Homebrew is unavailable: ${result.spawnError}`)
          return { ok: false, error: `Homebrew is unavailable: ${result.spawnError}` }
        }
        if (result.code !== 0) {
          const message = result.stderr.trim() || `brew exited with code ${result.code}`
          emit("error", message)
          return { ok: false, error: message }
        }
        const after = await resolveTarget(query)
        if (after.ok && after.kind === "path") {
          emit("done", `Target ready at ${after.path}`)
          return { ok: true, path: after.path, installed: true }
        }
        const message = "Homebrew finished but no matching .app was found."
        emit("error", message)
        return { ok: false, error: message }
      }

      return { ok: false, error: "Nothing to download." }
    },
  }),

  rea_run: tool({
    description:
      "Run one REA analysis command, for example analyze, analyze-javascript-application, " +
      "inspect, decompile, search, xrefs, trace, or function. Arguments are passed as an array " +
      "(no shell). Progress streams to the user; the full JSON envelope is saved under " +
      "rea_output/ and only a capped preview is returned. Requires approval.",
    inputSchema: z.object({
      command: z
        .string()
        .regex(COMMAND)
        .describe("REA subcommand, e.g. analyze-javascript-application"),
      args: z
        .array(z.string().max(2000))
        .max(40)
        .default([])
        .describe("Arguments after the subcommand; the target path/URL usually comes first"),
    }),
    execute: async ({ command, args }, { abortSignal }) => {
      if (BLOCKED_EXACT.has(command)) {
        return { ok: false, error: `The ${command} command is not available to the agent.` }
      }
      if (BLOCKED_PREFIXES.some((prefix) => command.startsWith(prefix))) {
        return { ok: false, error: `The ${command} command is not available to the agent.` }
      }
      if (args.some((arg) => arg.includes("\u0000"))) {
        return { ok: false, error: "Arguments cannot contain null bytes." }
      }

      // Evidence lives on disk, so ask for the whole envelope rather than a
      // token-limited view: the renderer only ever sees the capped preview.
      const hasFormat = args.some((arg) => arg === "--format" || arg.startsWith("--format="))
      const hasJson = args.includes("--json")
      const finalArgs = [
        "-y",
        "rea-agents@latest",
        command,
        ...args,
        ...(hasFormat || hasJson ? [] : ["--format", "json"]),
        ...(args.includes("--full-output") ? [] : ["--full-output"]),
      ]

      emit("log", `$ npx ${finalArgs.join(" ")}`)
      const result = await runProcess("npx", finalArgs, {
        timeoutMs: REA_TIMEOUT_MS,
        signal: abortSignal,
        onLine: (line) => emit("log", formatProgress(line)),
      })

      if (result.aborted) {
        return { ok: false, error: "The REA command was stopped." }
      }
      if (result.timedOut) {
        const message = "REA timed out after 10 minutes."
        emit("error", message)
        return { ok: false, error: message }
      }
      if (result.spawnError) {
        const message = `Could not start REA: ${result.spawnError}`
        emit("error", message)
        return { ok: false, error: message }
      }
      if (result.code !== 0) {
        const message =
          result.stderr.trim() || result.stdout.trim().slice(0, 2000) || `REA exited with code ${result.code}`
        emit("error", message)
        return { ok: false, error: message, exitCode: result.code }
      }

      const label = safeName(
        `${command}-${args.find((arg) => !arg.startsWith("-")) ?? "output"}`,
      )
      let file = ""
      try {
        file = await saveEvidence(label, result.stdout)
      } catch (err) {
        emit("log", `Could not save REA output: ${err instanceof Error ? err.message : String(err)}`)
      }

      const { preview, byteSize } = previewOf(result.stdout)
      emit("done", file ? `Saved evidence to ${file}` : "REA command finished.")
      return { ok: true, command, file, byteSize, preview, exitCode: 0 }
    },
  }),
}
