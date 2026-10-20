/**
 * One interactive shell per chat window, backed by node-pty and driven by
 * xterm.js in the renderer.
 *
 * Trust boundary: the renderer only sends keystrokes and dimensions. The shell,
 * cwd, and environment are chosen here, and there is no IPC argument that lets
 * a page pick a command to run.
 *
 * The PTY is deliberately not exposed to the model. The terminal is a human
 * tool; giving the agent a shell would need its own approval and output policy.
 */

import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { randomUUID } from "node:crypto"
import * as pty from "node-pty"
import { app, type WebContents } from "electron"

export interface TerminalInfo {
  id: string
  shell: string
  cwd: string
}

export interface TerminalDataPayload {
  id: string
  data: string
}

export interface TerminalExitPayload {
  id: string
  exitCode: number
  signal?: number
}

interface Session {
  pty: pty.IPty
  webContents: WebContents
}

const sessions = new Map<string, Session>()

const MAX_WRITE_BYTES = 64 * 1024
const MIN_COLS = 2
const MAX_COLS = 500
const MIN_ROWS = 1
const MAX_ROWS = 300

/**
 * npm tarballs do not preserve the executable bit on node-pty's prebuilt
 * `spawn-helper`, and this machine's npm policy skips install scripts anyway.
 * Without +x, `pty.spawn` fails with the very unhelpful "posix_spawnp failed".
 * Fix it here, once, before the first spawn.
 */
let helperChecked = false
function ensureSpawnHelper(): void {
  if (helperChecked || process.platform === "win32") return
  helperChecked = true

  try {
    const require = createRequire(import.meta.url)
    const root = path.dirname(require.resolve("node-pty/package.json"))
    const candidates = [
      path.join(root, "build", "Release", "spawn-helper"),
      path.join(root, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper"),
    ]
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue
      try {
        fs.chmodSync(file, 0o755)
      } catch (error) {
        console.warn(`[terminal] could not make ${file} executable`, error)
      }
    }
  } catch (error) {
    console.warn("[terminal] could not locate node-pty spawn helper", error)
  }
}

function resolveShell(): string {
  const candidates = [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"]
  for (const candidate of candidates) {
    if (!candidate || !path.isAbsolute(candidate)) continue
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      // Try the next one.
    }
  }
  return "/bin/sh"
}

function resolveCwd(): string {
  if (!app.isPackaged) {
    const root = path.resolve(app.getAppPath(), "..")
    if (fs.existsSync(root)) return root
  }
  return app.getPath("home")
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function clampSize(cols: unknown, rows: unknown): [number, number] {
  return [clamp(cols, MIN_COLS, MAX_COLS, 80), clamp(rows, MIN_ROWS, MAX_ROWS, 24)]
}

function send(webContents: WebContents, channel: string, payload: unknown): void {
  if (webContents.isDestroyed()) return
  try {
    webContents.send(channel, payload)
  } catch {
    // The window can close mid-command. The PTY is killed by dispose/window
    // cleanup; losing the last chunk of output is preferable to throwing here.
  }
}

/** Spawn a shell for this window. Throws with a readable message on failure. */
export function createTerminal(
  webContents: WebContents,
  cols: unknown,
  rows: unknown,
): TerminalInfo {
  ensureSpawnHelper()

  const [safeCols, safeRows] = clampSize(cols, rows)
  const shell = resolveShell()
  const cwd = resolveCwd()
  const id = randomUUID()

  let child: pty.IPty
  try {
    child = pty.spawn(shell, ["-l"], {
      name: "xterm-256color",
      cols: safeCols,
      rows: safeRows,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      } as Record<string, string>,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Could not start ${shell} (${detail}). If node-pty was not built for this Electron app, reinstall dependencies in electron/.`,
    )
  }

  sessions.set(id, { pty: child, webContents })

  child.onData((data) => {
    send(webContents, "terminal:data", { id, data } satisfies TerminalDataPayload)
  })
  child.onExit(({ exitCode, signal }) => {
    sessions.delete(id)
    const payload: TerminalExitPayload = { id, exitCode }
    if (typeof signal === "number") payload.signal = signal
    send(webContents, "terminal:exit", payload)
  })

  return { id, shell, cwd }
}

export function writeTerminal(id: string, data: unknown): void {
  const session = sessions.get(id)
  if (!session) throw new Error("That terminal is no longer running.")
  if (typeof data !== "string") throw new Error("Terminal input must be text.")
  session.pty.write(data.slice(0, MAX_WRITE_BYTES))
}

export function resizeTerminal(id: string, cols: unknown, rows: unknown): void {
  const session = sessions.get(id)
  if (!session) return
  const [safeCols, safeRows] = clampSize(cols, rows)
  if (safeCols === session.pty.cols && safeRows === session.pty.rows) return
  try {
    session.pty.resize(safeCols, safeRows)
  } catch {
    // A shell that exited between the resize and the call is already gone.
  }
}

export function disposeTerminal(id: string): void {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  try {
    session.pty.kill()
  } catch {
    // Already exited.
  }
}

/** Kill every PTY owned by a window (reload, close, renderer crash). */
export function disposeTerminalsFor(webContents: WebContents): void {
  for (const [id, session] of sessions) {
    if (session.webContents === webContents) disposeTerminal(id)
  }
}

/** Best-effort kill on quit so no shell outlives the app. */
export function disposeAllTerminals(): void {
  for (const id of [...sessions.keys()]) disposeTerminal(id)
}
