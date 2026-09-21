import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// dist/main.js lives at electron/dist, so everything else is one level up.
const WHISPER_BIN = path.join(__dirname, "..", "vendor", "whisper.cpp", "build", "bin", "whisper-cli")
const WHISPER_MODEL = path.join(__dirname, "..", "models", "ggml-base.en.bin")

const TRANSCRIPT_TIMEOUT_MS = 30_000

export function whisperReady(): { ready: boolean; reason?: string } {
  if (!fs.existsSync(WHISPER_BIN)) {
    return { ready: false, reason: `whisper-cli not found at ${WHISPER_BIN}. Run 'npm run setup:whisper'.` }
  }
  if (!fs.existsSync(WHISPER_MODEL)) {
    return { ready: false, reason: `model not found at ${WHISPER_MODEL}. Run 'npm run setup:whisper'.` }
  }
  return { ready: true }
}

export async function transcribeWav(wav: Buffer): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "whisper-"))
  const wavPath = path.join(dir, "audio.wav")
  const outBase = path.join(dir, "out")
  fs.writeFileSync(wavPath, wav)

  try {
    await runWhisper(wavPath, outBase)
    const txtPath = `${outBase}.txt`
    if (!fs.existsSync(txtPath)) return ""
    return fs.readFileSync(txtPath, "utf-8").trim()
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function runWhisper(wavPath: string, outBase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      WHISPER_BIN,
      [
        "-m", WHISPER_MODEL,
        "-f", wavPath,
        "-nt",
        "-np",
        "-otxt",
        "-of", outBase,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    )

    let stderr = ""
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error("Transcription timed out"))
    }, TRANSCRIPT_TIMEOUT_MS)

    proc.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })

    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(stderr.trim() || `whisper-cli exited with code ${code}`))
        return
      }
      resolve()
    })
  })
}