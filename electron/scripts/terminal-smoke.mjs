/**
 * Proves the compiled terminal manager loads node-pty inside Electron (not just
 * Node), spawns a PTY, accepts input, streams output, and exits cleanly.
 *
 *     npm run test:terminal
 *
 * No window is created; a stub WebContents collects the events main would send
 * to xterm. The shell is allowed to exit on its own before the app quits, so
 * the test never kills a PTY it is still reading from.
 */
import { app } from "electron"
import { createTerminal, writeTerminal } from "../dist/terminal/manager.js"

const MARKER = "__DUMMY_PTY_OK__"
let output = ""
let sawMarker = false
let finished = false

function finish(ok, detail) {
  if (finished) return
  finished = true
  clearTimeout(timer)
  if (ok) console.log("terminal smoke: ok")
  else console.error(`terminal smoke: ${detail}`)
  // Give the PTY exit callback a tick to unwind before the process goes away.
  setTimeout(() => app.exit(ok ? 0 : 1), 100)
}

const timer = setTimeout(() => {
  finish(false, `timed out (output ${JSON.stringify(output)})`)
}, 10_000)

const stubWebContents = {
  isDestroyed: () => false,
  send: (channel, payload) => {
    if (channel === "terminal:data") {
      output += payload.data
      if (output.includes(MARKER)) sawMarker = true
      return
    }
    if (channel === "terminal:exit") {
      if (sawMarker) finish(true, "")
      else {
        finish(
          false,
          `shell exited ${payload.exitCode} without the marker (output ${JSON.stringify(output)})`,
        )
      }
    }
  },
}

app
  .whenReady()
  .then(() => {
    const info = createTerminal(stubWebContents, 80, 24)
    setTimeout(() => {
      writeTerminal(info.id, `printf ${MARKER}; exit 0\r`)
    }, 150)
  })
  .catch((error) => {
    finish(false, `failed to start: ${String(error)}`)
  })
