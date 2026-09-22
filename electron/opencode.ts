import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { homedir } from "node:os"
import path from "node:path"
import { app } from "electron"
import { createOpencodeClient, type OpencodeClient, type Provider } from "@opencode-ai/sdk"

export interface OpenCodeModel {
  providerID: string
  providerName: string
  modelID: string
  name: string
  vision: boolean
}

export interface OpenCodeError {
  ok: false
  error: string
}

export type OpenCodeResult =
  | { ok: true; models: OpenCodeModel[] }
  | OpenCodeError

export type OpenCodeStatus =
  | { state: "connecting" }
  | { state: "ready"; version: string }
  | { state: "error"; message: string }

interface ProvidersInfo {
  providers: Provider[]
  default: Record<string, string>
}

let child: ChildProcess | null = null
let client: OpencodeClient | null = null
let serverUrl: string | null = null
let starting: Promise<OpenCodeError | null> | null = null
let respawned = false
let stopping = false
const statusListeners = new Set<(status: OpenCodeStatus) => void>()

function emitStatus(status: OpenCodeStatus) {
  for (const listener of statusListeners) listener(status)
}

export function onOpenCodeStatus(listener: (status: OpenCodeStatus) => void) {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

function getBinary(): string | null {
  const fromEnv = process.env.OPENCODE_BIN
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  const where = process.platform === "win32" ? "where" : "which"
  const res = spawnSync(where, ["opencode"], { encoding: "utf8" })
  if (res.status === 0 && res.stdout) {
    const line = res.stdout.split("\n").find((l) => l.trim())
    if (line) return line.trim()
  }
  const candidates = [
    "/opt/homebrew/bin/opencode",
    "/usr/local/bin/opencode",
    path.join(homedir(), ".local", "bin", "opencode"),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

async function fetchVersion(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${url}/global/health`)
    if (!res.ok) return null
    const json = (await res.json()) as { version?: string }
    return json.version ?? null
  } catch {
    return null
  }
}

async function start(): Promise<OpenCodeError | null> {
  if (client) return null
  if (starting) return starting

  starting = (async () => {
    const binary = getBinary()
    if (!binary) {
      return {
        ok: false,
        error: "opencode CLI not found. Install it or set OPENCODE_BIN to its path.",
      }
    }
    stopping = false

    const port = await getFreePort()
    emitStatus({ state: "connecting" })

    const proc = spawn(binary, ["serve", "--port", String(port), "--hostname", "127.0.0.1"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    })

    return await new Promise<OpenCodeError | null>((resolve) => {
      let settled = false
      let output = ""

      const settle = (error: OpenCodeError | null) => {
        if (settled) return
        settled = true
        child = null
        if (error) {
          respawned = false
          emitStatus({ state: "error", message: error.error })
        }
        resolve(error)
      }

      proc.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString()
        const match = output.match(/opencode server listening on (https?:\/\/[^\s]+)/)
        if (!match || settled) return
        const url = match[1]
        if (!url) return
        serverUrl = url
        client = createOpencodeClient({ baseUrl: url })
        child = proc
        settled = true
        respawned = false
        void fetchVersion(url).then((version) =>
          emitStatus({ state: "ready", version: version ?? "" })
        )
        resolve(null)
      })

      proc.on("error", (error) => settle({ ok: false, error: error.message }))

      proc.on("exit", (code, signal) => {
        client = null
        serverUrl = null
        if (stopping) return
        if (settled) {
          if (!respawned) {
            respawned = true
            emitStatus({ state: "connecting" })
            void start()
          } else {
            respawned = false
            emitStatus({
              state: "error",
              message: "opencode server exited unexpectedly.",
            })
          }
          return
        }
        settle({
          ok: false,
          error: `opencode server exited (${signal ?? code ?? "unknown code"}).`,
        })
      })

      setTimeout(() => {
        if (settled) return
        proc.kill()
        settle({ ok: false, error: "Timed out waiting for opencode server to start." })
      }, 10_000)
    })
  })()

  const result = await starting
  starting = null
  return result
}

export async function listModels(): Promise<OpenCodeResult> {
  const error = await start()
  if (error) return error
  if (!client) return { ok: false, error: "opencode server is not available." }

  try {
    const res = (await client.config.providers({
      throwOnError: true,
      responseStyle: "data",
    } as Parameters<typeof client.config.providers>[0])) as unknown as ProvidersInfo

    const models: OpenCodeModel[] = []
    for (const provider of res.providers) {
      if (!provider.key) continue
      for (const model of Object.values(provider.models)) {
        if (model.status !== "active") continue
        models.push({
          providerID: provider.id,
          providerName: provider.name,
          modelID: model.id,
          name: model.name,
          vision: model.capabilities.input.image,
        })
      }
    }

    models.sort(
      (a, b) =>
        a.providerName.localeCompare(b.providerName) || a.name.localeCompare(b.name)
    )

    if (models.length === 0) {
      return { ok: false, error: "No authenticated providers with active models were found." }
    }

    return { ok: true, models }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Failed to load models: ${message}` }
  }
}

function modelStorePath(): string {
  return path.join(app.getPath("userData"), "opencode-model.json")
}

export function getSelectedModel(): OpenCodeModel | null {
  try {
    const raw = readFileSync(modelStorePath(), "utf8")
    const model = JSON.parse(raw) as Partial<OpenCodeModel>
    if (
      typeof model.providerID === "string" &&
      typeof model.providerName === "string" &&
      typeof model.modelID === "string" &&
      typeof model.name === "string"
    ) {
      return {
        providerID: model.providerID,
        providerName: model.providerName,
        modelID: model.modelID,
        name: model.name,
        vision: !!model.vision,
      }
    }
  } catch {
    // ignore unreadable/corrupt store
  }
  return null
}

export function setSelectedModel(model: OpenCodeModel): void {
  mkdirSync(app.getPath("userData"), { recursive: true })
  writeFileSync(modelStorePath(), JSON.stringify(model, null, 2))
}

export function stopOpenCode(): void {
  stopping = true
  respawned = false
  if (child && !child.killed) child.kill()
  child = null
  client = null
  serverUrl = null
}