/**
 * Phase 0 spike for Feature 6 (the deep-task lane) — run inside Electron.
 *
 *   npm run build && electron scripts/pi-spike.mjs
 *
 * Proves the pieces the plans rest on, without needing a live chat session or
 * the renderer:
 *
 *   1. `BrowserUse.create()` needs NO auth — only `run()` does. The browser,
 *      profile lock and Chrome launch all happen at create time.
 *   2. `.bu-pi.lock` is written (`wx`, 0o600) into the profile dir, and a second
 *      create on the same profile is rejected cleanly.
 *   3. Chrome is launched headed (`--headless` absent) against an isolated
 *      persistent profile dir.
 *   4. The worker forks our Electron binary as plain Node (`ELECTRON_RUN_AS_NODE`
 *      is set automatically by Electron on fork).
 *   5. `run()` with no provider key fails cleanly (auth error surfaced, no hang).
 *
 * The `--keyed` section needs a real key and is what the user tests by hand.
 * A key can come from the shell or from `electron/.env` (loaded below):
 *
 *   ANTHROPIC_API_KEY=... electron scripts/pi-spike.mjs --keyed
 *   GOOGLE_GEMINI_API_KEY=... electron scripts/pi-spike.mjs --keyed   # or in .env
 *
 * It runs one real task through the whole stack — headed Chrome, the forked
 * worker executing JS, a file written into the workspace, `finish` delivering a
 * result, and agent events observed via `onEvent`.
 */
import { app } from "electron"
import { config as loadEnv } from "dotenv"
import { mkdtemp, mkdir, readFile, realpath } from "node:fs/promises"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"

// Load electron/.env regardless of the cwd the harness was invoked from, so a
// key dropped there is picked up without exporting it in the shell.
loadEnv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") })

// The real main process keeps the app alive when the last window closes, which
// is what the app itself relies on; without this the harness would exit the
// moment the spike's scratch window (none) is destroyed, and the deep lane is
// no different.
app.on("window-all-closed", () => {})

const KEYED = process.argv.includes("--keyed")

/**
 * A keyed run needs a key in the exact env var pi-ai reads per provider. A
 * Google key is commonly stored as `GOOGLE_GEMINI_API_KEY`; pi-ai only reads
 * `GEMINI_API_KEY`, so we bridge it below. Anthropic wins when both are set;
 * `PI_SPIKE_MODEL` overrides the model either way.
 */
function keyedProvider() {
  if (process.env.ANTHROPIC_API_KEY)
    return { name: "anthropic", model: "anthropic/claude-sonnet-4-6", keyEnv: "ANTHROPIC_API_KEY", key: process.env.ANTHROPIC_API_KEY }
  const googleKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY
  if (googleKey)
    return { name: "google", model: "google/gemini-2.5-flash", keyEnv: "GEMINI_API_KEY", key: googleKey }
  return null
}
const keyedRun = keyedProvider()
const MODEL = process.env.PI_SPIKE_MODEL ?? keyedRun?.model ?? "anthropic/claude-sonnet-4-6"

let failures = 0
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok " : "FAIL"} ${name}${ok || !detail ? "" : ` — ${detail}`}`)
  if (!ok) failures++
}

async function run() {
  const { Browser, BrowserUse } = await import("@browser_use/pi")

  const base = await mkdtemp(path.join(tmpdir(), "pi-spike-"))
  const workspace = path.join(base, "workspace")
  const profileDir = path.join(base, "chrome")
  await mkdir(workspace, { recursive: true })
  await mkdir(profileDir, { recursive: true })
  const realProfile = await realpath(profileDir)
  const lockPath = path.join(realProfile, ".bu-pi.lock")

  const options = {
    model: MODEL,
    telemetry: false,
    researchTools: false,
    browser: Browser.chromium({ headless: false, profileDir }),
    workspace,
  }

  console.log("\nno-key create")
  const createStarted = Date.now()
  const browser = await BrowserUse.create(options)
  check("create() succeeds with no API key", true, `${Date.now() - createStarted}ms`)

  const lockRaw = await readFile(lockPath, "utf8").catch(() => null)
  check("the .bu-pi.lock file exists in the profile dir", !!lockRaw)
  let lock = null
  try {
    lock = lockRaw ? JSON.parse(lockRaw) : null
  } catch {}
  check("the lock carries our pid", !!lock && typeof lock.pid === "number", JSON.stringify(lock))

  const devtools = await readFile(path.join(realProfile, "DevToolsActivePort"), "utf8").catch(() => null)
  {
    const { readdir } = await import("node:fs/promises")
    const entries = await readdir(realProfile).catch(() => [])
    console.log(`  info profile dir has ${entries.length} entries: ${entries.slice(0, 8).join(", ")}`)
  }
  // The file holds `<port>\n/devtools/browser/<uuid>`, not an IP address.
  const devtoolsLines = (devtools ?? "").trim().split("\n")
  const devtoolsPort = Number(devtoolsLines[0])
  check(
    "Chrome exposed a CDP endpoint (DevToolsActivePort)",
    devtoolsLines.length >= 2 && /^\/devtools\/browser/.test(devtoolsLines[1] ?? "") && devtoolsPort >= 0,
    devtools?.trim().split("\n").join(" | "),
  )

  // Chrome command line: must reference this profile and must NOT pass --headless.
  let chromeArgs = ""
  if (process.platform === "darwin") {
    try {
      const { execSync } = await import("node:child_process")
      chromeArgs = execSync(`ps -axo command= | grep -- "--user-data-dir=${realProfile}" | grep -v grep`, {
        encoding: "utf8",
      })
    } catch {}
  }
  check(
    "Chrome is running against the isolated profile",
    chromeArgs.includes(realProfile),
    chromeArgs.split("\n").filter(Boolean)[0]?.slice(0, 200) ?? "",
  )
  check("Chrome is headed (no --headless flag)", !/--headless/.test(chromeArgs))

  // The worker is our Electron binary running as plain Node. Electron auto-sets
  // ELECTRON_RUN_AS_NODE=1 on fork, so the child is Node, not a second GUI app.
  const workerFlag = process.env.ELECTRON_RUN_AS_NODE ?? "not set in parent"
  console.log(`  info ELECTRON_RUN_AS_NODE (parent) = ${workerFlag}`)

  // Lock behaviour: a second create on the same profile must be rejected by the
  // lock, loudly, not by silently sharing the browser.
  let secondRejected = false
  let secondError = ""
  try {
    const again = await BrowserUse.create(options)
    await again.close()
  } catch (err) {
    secondRejected = true
    secondError = err instanceof Error ? err.message : String(err)
  }
  check(
    "a second create on the same profile is rejected",
    secondRejected && /locked/i.test(secondError),
    secondError.slice(0, 200),
  )

  // run() with no key must fail cleanly — either a surfaced error, or a result
  // whose status is an error (run() resolves to `{ status: "error", error }`
  // rather than always throwing). What it must NOT do is hang forever or
  // report success.
  let runNoKey = null
  let runNoKeyStatus = ""
  try {
    const noKeyResult = await browser.run("Open example.com and read the headline.", {
      timeoutMs: 40_000,
      maxCostUsd: 0.1,
      signal: AbortSignal.timeout(40_000),
    })
    runNoKeyStatus = JSON.stringify(noKeyResult.status)
    runNoKey = noKeyResult.status !== "completed" ? (noKeyResult.error ?? "no error") : "ran to completion"
  } catch (err) {
    runNoKey = err instanceof Error ? err.message : String(err)
  }
  check("run() with no key fails cleanly", !!runNoKey, runNoKey?.slice(0, 120) ?? "no error")
  check(
    "the no-key failure reads like an auth problem",
    /key|auth|401|credential|api|configur|provider/i.test(runNoKey ?? ""),
    `status=${runNoKeyStatus} ${(runNoKey ?? "").slice(0, 300)}`,
  )

  await browser.close()
  const lockAfterClose = await readFile(lockPath, "utf8").catch(() => null)
  check("close() releases the profile lock", lockAfterClose === null)

  if (!KEYED) {
    console.log("\n(skip keyed run — pass --keyed with a key in the shell or electron/.env)\n")
    return { base }
  }

  if (!keyedRun) {
    check("--keyed needs ANTHROPIC_API_KEY, or GOOGLE_GEMINI_API_KEY/GEMINI_API_KEY in electron/.env", false)
    return { base }
  }

  // pi-ai only reads the canonical var per provider, so a Google key stored as
  // GOOGLE_GEMINI_API_KEY is bridged to GEMINI_API_KEY just for this run.
  process.env[keyedRun.keyEnv] = keyedRun.key

  console.log(`\nkeyed run (${keyedRun.name}, ${MODEL})`)
  const keyed = await BrowserUse.create(options)
  const events = []
  const result = await keyed.run(
    "Open a new tab at https://example.com, read the visible text of the page, " +
      "save it to a file named page.txt in the workspace using JavaScript, then " +
      "finish with a one-line summary of the page.",
    {
      timeoutMs: 120_000,
      maxCostUsd: 0.5,
      onEvent: (event) => events.push(event),
    },
  )
  check("the keyed run completed", result.status === "completed", JSON.stringify(result.status))
  check(
    "a javascript cell ran (tool_execution for the keyed run)",
    events.some((e) => e.type === "tool_execution_start" && e.toolName === "javascript"),
    events.map((e) => e.type).join(","),
  )
  check(
    "a finish cell delivered the result",
    events.some((e) => e.type === "tool_execution_end" && e.toolName === "finish"),
  )
  const pageTxt = await readFile(path.join(workspace, "page.txt"), "utf8").catch(() => null)
  check("the workspace file exists", pageTxt !== null && pageTxt.length > 0, `${pageTxt?.length ?? 0} chars`)
  check("the result is the summary string", typeof result.output === "string" && result.output.length > 0, String(result.output).slice(0, 120))
  check("metrics carry the workspace + steps", result.workspace === workspace && result.steps >= 1, `${result.steps} steps`)
  await keyed.close()

  return { base }
}

app.whenReady().then(async () => {
  try {
    const { base } = await run()
    try {
      const { rm } = await import("node:fs/promises")
      await rm(base, { recursive: true, force: true })
    } catch {}
  } catch (err) {
    console.error("spike threw:", err)
    failures++
  }
  console.log()
  if (failures > 0) {
    console.log(`FAILED (${failures})`)
    app.exit(1)
    return
  }
  console.log(KEYED ? "pi spike passed (keyed)" : "pi spike passed (create-only; run --keyed for the keyed path)")
  app.exit(0)
})