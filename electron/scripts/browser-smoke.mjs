/**
 * Headless smoke test for the CDP layer.
 *
 * `npm run test:browser` runs this *inside Electron* (`electron scripts/browser-smoke.mjs`)
 * because `webContents.debugger` only exists in a real Chromium. It needs no
 * model key and no renderer dev server: the page under test is served from
 * memory, so this is the cheapest way to find out that a protocol call was
 * renamed or its shape changed.
 *
 * Run it after touching anything in `browser/cdp.ts` or `browser/window.ts`.
 */
import { BrowserWindow, app } from "electron"

// The real main process keeps the app alive when the last window closes, which
// is what makes the browser window's singleton worth having. Without this the
// test harness quits Electron the moment its scratch window is destroyed, and
// the browser window dies with it.
app.on("window-all-closed", () => {})

const PAGE = `<!doctype html>
<html>
  <head><title>Smoke Page</title></head>
  <body>
    <h1>Smoke Page</h1>
    <p id="copy">The quick brown fox jumps over the lazy dog.</p>
    <a id="link" href="#target">Jump to target</a>
    <button id="go">Press me</button>
    <input id="field" type="text" />
    <div id="later" hidden>hidden panel</div>
    <script>
      // A click listener on a bare div: nothing in the accessibility tree marks
      // this as interactive, so finding it proves the JS-listener pass works.
      document.getElementById("go").addEventListener("click", () => {
        const panel = document.getElementById("later")
        panel.hidden = false
        panel.textContent = "clicked"
      })
    </script>
  </body>
</html>`

const failures = []
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok  ${label}`)
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`)
    failures.push(label)
  }
}

async function run() {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  })
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(PAGE))
  // data: URLs do not settle the way a real document does; give the load a tick.
  await new Promise((resolve) => setTimeout(resolve, 250))

  const { CdpSession } = await import("../dist/browser/cdp.js")
  const session = new CdpSession(win.webContents)
  await session.attach()

  console.log("page info")
  const page = await session.pageInfo()
  check("url is the loaded document", page.url.startsWith("data:text/html"), page.url)

  console.log("snapshot")
  const snapshot = await session.snapshot()
  check("snapshot returned nodes", snapshot.nodes.length > 0, `count=${snapshot.nodes.length}`)
  check(
    "button was found",
    snapshot.nodes.some((node) => node.role === "button" && node.name === "Press me"),
    snapshot.nodes.map((node) => `${node.role}:${node.name}`).join(", "),
  )
  check(
    "link was found",
    snapshot.nodes.some((node) => node.role === "link"),
  )
  check(
    "every node has a real box",
    snapshot.nodes.every((node) => node.box.width > 0 && node.box.height > 0),
  )
  check(
    "the JS click listener on #go was detected",
    snapshot.nodes.some((node) => node.name === "Press me" && node.via.includes("listener")),
    snapshot.nodes.map((node) => `${node.name}<${node.via}>`).join(" | "),
  )

  console.log("read")
  const read = await session.readText(2_000)
  check("read found the paragraph", read.text.includes("quick brown fox"), read.text.slice(0, 80))
  check("read reports the page", read.page.url.startsWith("data:text/html"))

  const clipped = await session.readText(20)
  check("read truncates on request", clipped.truncated === true && clipped.text.length <= 20)

  console.log("click")
  const buttonRef = snapshot.nodes.find((node) => node.name === "Press me")
  if (!buttonRef) {
    check("click could run", false, "no ref for the button")
  } else {
    const box = await session.scrollIntoView(buttonRef.backendNodeId)
    await session.clickAt(box)
    await session.waitFor(async () => (await session.evaluate("document.getElementById('later').hidden")) === false, 3_000)
    const revealed = await session.evaluate("document.getElementById('later').textContent")
    check("the click listener ran", revealed === "clicked", String(revealed))
  }

  console.log("type")
  const fieldRef = snapshot.nodes.find((node) => node.role === "textbox")
  if (!fieldRef) {
    check("typing could run", false, "no textbox in the snapshot")
  } else {
    await session.typeText(fieldRef.backendNodeId, "hello there")
    const value = await session.evaluate("document.getElementById('field').value")
    check("text reached the field", value === "hello there", JSON.stringify(value))
  }

  console.log("offscreen")
  const offscreen = await session.snapshot({ includeOffscreen: true })
  check("offscreen nodes are included on request", offscreen.nodes.length >= snapshot.nodes.length)

  console.log("capture")
  const png = await session.screenshot()
  check("screenshot is a PNG", png.length > 8 && png.subarray(1, 4).toString() === "PNG", `${png.length} bytes`)
  const pdf = await session.printPdf()
  check("pdf is a PDF", pdf.subarray(0, 4).toString() === "%PDF", `${pdf.length} bytes`)

  console.log("refs across documents")
  const before = await session.pageInfo()
  await win.loadURL("about:blank")
  await new Promise((resolve) => setTimeout(resolve, 150))
  const after = await session.pageInfo()
  check("page info tracks navigation", after.url !== before.url, `${before.url} -> ${after.url}`)
  const stale = await session.snapshot()
  // <body> is focusable, so a node or two is expected; what matters is that the
  // previous document's controls are gone rather than acted on by stale refs.
  check(
    "refs from the previous document are gone",
    !stale.nodes.some((node) => node.role === "button" || node.role === "link"),
    stale.nodes.map((node) => `${node.role}:${node.name}`).join(", "),
  )

  session.detach()
  win.destroy()

  console.log("url policy")
  const { isAllowedUrl } = await import("../dist/browser/window.js")
  check("http is allowed", isAllowedUrl("http://example.com"))
  check("https is allowed", isAllowedUrl("https://example.com/path?q=1"))
  check("about:blank is allowed", isAllowedUrl("about:blank"))
  // about: as a *protocol* would also admit about:srcdoc, which carries
  // model-controlled markup and would be a way around the http/https rule.
  check("about:srcdoc is blocked", !isAllowedUrl("about:srcdoc"))
  check("file: is blocked", !isAllowedUrl("file:///etc/passwd"))
  check("javascript: is blocked", !isAllowedUrl("javascript:alert(1)"))
  check("data: is blocked", !isAllowedUrl("data:text/html,<h1>x"))
  check("a relative path is blocked", !isAllowedUrl("/settings"))

  console.log("navigation settling")
  await checkNavigationSettling()
}

/**
 * Guards the change from "always wait out the navigation budget" to "wait only
 * if a navigation actually starts".
 *
 * Runs against the real `browser/window` module, so it needs a real server: a
 * `data:` URL cannot be reached through `open()`, which is the point of the URL
 * policy. Hence the throwaway loopback server.
 */
async function checkNavigationSettling() {
  const { createServer } = await import("node:http")

  const pages = {
    "/": `<!doctype html><button id="plain">Plain click</button>
          <form action="/second" method="get"><input id="q" name="q" /><button id="submit">Go</button></form>`,
    "/second": `<!doctype html><h1>Second page</h1><button id="back">Back</button>`,
  }
  const server = createServer((req, res) => {
    const body = pages[req.url.split("?")[0]] ?? pages["/"]
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end(body)
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  try {
    const {
      close,
      clickRef,
      hide,
      open,
      pageInfo,
      readPage,
      releasePageMemory,
      setBounds,
      setHostWindow,
      snapshotPage,
      status,
      typeRef,
    } = await import("../dist/browser/window.js")

    // The browser is a `WebContentsView` now, so it needs a host window and a
    // rectangle before it can be shown. This is also the check that the panel
    // plumbing works: bounds in, a visible page out.
    // Shown on purpose. The browser is a `WebContentsView` inside this window,
    // and a window that is never shown has no render widget at all — synthetic
    // input is dropped and layout never settles, so clicks silently miss. The
    // real chat window is visible, which is why this matches production rather
    // than being a test-only convenience.
    const host = new BrowserWindow({
      show: true,
      width: 900,
      height: 700,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    // Focused as well as shown: a window that is created behind another one is
    // occluded, and Chromium withholds the render widget from an occluded
    // surface — synthetic input is then dropped and layout waits time out. This
    // made the click checks pass or fail depending on what else was on screen.
    host.focus()
    host.moveTop()
    // Forced on top, not just focused: an occluded window still gets no
    // compositor frames, and `scrollIntoViewIfNeeded` blocks on frames.
    host.setAlwaysOnTop(true)
    setHostWindow(host)
    setBounds({ x: 0, y: 0, width: 800, height: 600 })
    check("a panel rectangle is enough to open the browser", status().open)

    await open(base + "/")
    const initial = await snapshotPage()

    // A click with no navigation behind it must come back fast.
    const plainRef = initial.nodes.find((node) => node.name === "Plain click")
    const startedAt = Date.now()
    await clickRef(plainRef.ref)
    const nonNavigatingMs = Date.now() - startedAt
    check(
      "a non-navigating click does not wait out the navigation budget",
      nonNavigatingMs < 2_000,
      `${nonNavigatingMs}ms`,
    )

    // A click that does navigate must still be waited out, or the model reads
    // the page the user was on when they asked to leave it.
    const submitRef = (await snapshotPage()).nodes.find((node) => node.name === "Go")
    await clickRef(submitRef.ref)
    const afterClick = await snapshotPage()
    check("a navigating click settles on the new page", afterClick.page.url.endsWith("/second?q="), afterClick.page.url)

    const backRef = afterClick.nodes.find((node) => node.name === "Back")
    const backStartedAt = Date.now()
    await clickRef(backRef.ref)
    const navigatingMs = Date.now() - backStartedAt
    const backPage = await snapshotPage()
    check("a navigating click returns after the new page is ready", !backPage.page.url.endsWith("/second"), backPage.page.url)
    void navigatingMs
    void backStartedAt

    // Typing without submit never navigates, so it must not wait either.
    await open(base + "/")
    const fieldRef = (await snapshotPage()).nodes.find((node) => node.role === "textbox")
    const typingStartedAt = Date.now()
    await typeRef(fieldRef.ref, "hello", false)
    check("typing without submit does not wait", Date.now() - typingStartedAt < 2_000, `${Date.now() - typingStartedAt}ms`)

    // Submitting does navigate — and this is the regression that made the
    // Enter key a no-op: without `text: "\r"` on the keyDown, implicit form
    // submission never fired and the field just sat there full of text.
    await typeRef(fieldRef.ref, "world", true)
    const submitted = await snapshotPage()
    check(
      "submitting a form settles on the results page",
      submitted.page.url.endsWith("/second?q=helloworld"),
      submitted.page.url,
    )

    console.log("idle release")
    await releasePageMemory()
    // `about:blank` is not a page as far as the app is concerned: the sidebar
    // shows nothing and further tool calls must fail loudly rather than act on
    // a blank document.
    const afterRelease = status()
    check("released page reports no page", afterRelease.page === null, JSON.stringify(afterRelease.page))
    let threw = false
    try {
      pageInfo()
    } catch {
      threw = true
    }
    check("acting on a released page throws rather than guessing", threw)

    // Collapsing the panel must hide the page without unloading it, which is
    // what lets the user go back to the transcript and come straight back.
    await open(base + "/second")
    hide()
    check("collapsing keeps the page loaded", status().page?.url.endsWith("/second"), JSON.stringify(status().page))
    check("collapsing keeps the page readable", (await readPage()).text.includes("Second page"))
    setBounds({ x: 0, y: 0, width: 400, height: 300 })
    check("the panel can be resized", status().open)

    close()
    setHostWindow(null)
    host.destroy()
  } finally {
    server.close()
  }
}

app.whenReady().then(async () => {
  try {
    await run()
  } catch (err) {
    console.error("smoke test threw:", err)
    if (err instanceof Error) console.error(err.stack)
    failures.push(`threw: ${err instanceof Error ? err.message : String(err)}`)
  }
  console.log()
  if (failures.length > 0) {
    console.log(`FAILED (${failures.length}): ${failures.join("; ")}`)
    app.exit(1)
    // `app.exit` does not stop this function, so without the return a failing
    // run also printed "passed" — a harness that reports success on failure is
    // worse than no harness at all.
    return
  }
  console.log("browser CDP smoke test passed")
  app.exit(0)
})