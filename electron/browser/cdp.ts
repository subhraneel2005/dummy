/**
 * A thin, typed wrapper over the CDP connection Electron already gives us.
 *
 * `webContents.debugger` is not a wrapper around a CDP library — it *is* a CDP
 * client — so driving Chromium needs no npm dependency at all. This module is
 * the only place that knows the raw method names; everything above it works in
 * terms of `snapshot`, `clickRef`, and friends.
 *
 * The alternative, `browser-use`, is a Python implementation of exactly this
 * layer. Its DOM heuristics are genuinely better than a naive AX-tree dump, so
 * the ones worth stealing are reproduced here rather than reinvented — see
 * `interactive.ts` for the provenance of each.
 */
import type { WebContents } from "electron"

import { findInteractiveNodes } from "./interactive.js"

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface PageInfo {
  url: string
  title: string
}

/** One actionable element in a snapshot, addressed by its stable `ref` for that snapshot. */
export interface SnapshotNode {
  ref: number
  role: string
  name: string
  box: Box
  /**
   * The CDP handle every other call uses. Not sent to the model — refs are the
   * model-facing address, and this stays an internal detail.
   */
  backendNodeId: number
  /** Why this node was judged interactive — used to explain odd snapshot entries. */
  via: string
}

export interface Snapshot {
  page: PageInfo
  nodes: SnapshotNode[]
  /** Set when the snapshot was incomplete, so the model is not misled into thinking it saw everything. */
  truncated?: string
}

export interface ReadResult {
  page: PageInfo
  text: string
  truncated: boolean
}

const AX_DOMAIN = "Accessibility"
const DOM_DOMAIN = "DOM"
const INPUT_DOMAIN = "Input"
const PAGE_DOMAIN = "Page"
const RUNTIME_DOMAIN = "Runtime"
const EMULATION_DOMAIN = "Emulation"

/** Roles worth showing the model. Everything else is structural noise. */
const INTERESTING_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "switch",
  "slider",
  "spinbutton",
  "tab",
  "treeitem",
])

/**
 * browser-use caps click-listener detection at 100 elements and skips pages
 * above 10k nodes entirely, because resolving every listener on a framework-heavy
 * page stalls the whole session. Same reasoning, same constants.
 */
const MAX_JS_LISTENER_ELEMENTS = 100
const MAX_JS_LISTENER_NODES = 10_000
const JS_LISTENER_OVERFLOW = "__too_many_click_listeners__"

/**
 * `DOM.describeNode` per detected element. Kept small because each call carries
 * target/session bookkeeping that starves concurrent requests — the same
 * reasoning as browser-use's `_DESCRIBE_NODE_BATCH_SIZE`.
 */
const DESCRIBE_NODE_BATCH = 20

/** Keystrokes per `Input.insertText` chunk. The protocol rejects very long strings. */
const TYPE_CHUNK = 2_000

export class CdpSession {
  #contents: WebContents
  #attached = false

  constructor(contents: WebContents) {
    this.#contents = contents
  }

  get attached() {
    return this.#attached
  }

  get destroyed() {
    return this.#contents.isDestroyed()
  }

  /**
   * Attaches to the DevTools protocol. No port is opened and no external client
   * can reach it — the connection lives inside this process only.
   */
  async attach() {
    if (this.destroyed) throw new Error("Browser page is closed")
    if (this.#attached) return
    try {
      this.#contents.debugger.attach("1.3")
      this.#attached = true
    } catch (err) {
      // A second attach throws rather than being a no-op, which happens if the
      // window was closed and reopened while a call was still in flight.
      if (!isAlreadyAttachedError(err)) throw err
      this.#attached = true
    }
    await this.#enableDomains()
  }

  detach() {
    if (!this.#attached || this.destroyed) return
    this.#attached = false
    try {
      this.#contents.debugger.detach()
    } catch {
      // Already detached because the window went away. Nothing to undo.
    }
  }

  async #enableDomains() {
    await this.#send(AX_DOMAIN, "enable")
    await this.#send(DOM_DOMAIN, "enable")
    await this.#send(PAGE_DOMAIN, "enable")
    // The page is embedded in a panel, so Chromium considers it hidden whenever
    // the panel is collapsed or the window is behind something else — and a
    // hidden page is frozen: timers are throttled and layout is not produced.
    // Two overrides, both read-only with respect to the page's own behaviour:
    // `setWebLifecycleState` keeps it out of the frozen state, and focus
    // emulation keeps it from being treated as unfocused. Without these, a click
    // into a collapsed panel waits seconds for a frame that never comes.
    await this.#send(PAGE_DOMAIN, "setWebLifecycleState", { state: "active" })
    await this.#send(EMULATION_DOMAIN, "setFocusEmulationEnabled", { enabled: true })
  }

  async #send<T>(domain: string, method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.destroyed) throw new Error("Browser page is closed")
    if (!this.#attached) await this.attach()
    // `debugger.sendCommand` takes the *fully qualified* CDP method name. The
    // bare method is what the protocol JSON calls it, which is exactly the
    // mistake that produces `'enable' wasn't found`.
    return (await this.#contents.debugger.sendCommand(
      `${domain}.${method}` as never,
      params as never,
    )) as T
  }

  async pageInfo(): Promise<PageInfo> {
    const url = this.#contents.getURL()
    const title = this.#contents.getTitle()
    return { url, title }
  }

  /**
   * Builds a snapshot of interactive elements and their on-screen boxes.
   *
   * The accessibility tree alone is not enough: it routinely omits clickable
   * `<div>`s and framework widgets. browser-use solves this by also asking the
   * page which elements carry click listeners, so this does too — see
   * `interactive.ts`.
   */
  async snapshot(options: { includeOffscreen?: boolean } = {}): Promise<Snapshot> {
    const page = await this.pageInfo()
    const { nodes: axTree } = await this.#send<{ nodes: AxNode[] }>(AX_DOMAIN, "getFullAXTree")
    const jsClickIds = await this.#jsClickListenerNodeIds()

    // Candidates first, boxes second. `DOM.getBoxModel` takes exactly one node
    // and returns one model — there is no batch form — so asking for a box per
    // AX node would be thousands of round trips on a large page. Deciding what
    // is interactive is free (pure AX data), so boxes are fetched only for the
    // handful of nodes that survived.
    const candidates: Array<{ backendNodeId: number; role: string; name: string; via: string }> = []
    const seen = new Set<number>()

    for (const node of axTree) {
      if (typeof node.backendDOMNodeId !== "number") continue
      if (seen.has(node.backendDOMNodeId)) continue
      seen.add(node.backendDOMNodeId)

      const role = (node.role?.value ?? "").toLowerCase()
      const name = node.name?.value ?? ""
      const via = findInteractiveNodes({
        role,
        name,
        properties: axProperties(node),
        hasJsClickListener: jsClickIds.has(node.backendDOMNodeId),
      }).via
      if (!via) continue

      candidates.push({ backendNodeId: node.backendDOMNodeId, role, name, via })
    }

    const boxes = await this.#boxesFor(candidates.map((candidate) => candidate.backendNodeId))

    const nodes: SnapshotNode[] = []
    for (const candidate of candidates) {
      const box = boxes.get(candidate.backendNodeId)
      if (!box && !options.includeOffscreen) continue
      nodes.push({
        ref: nodes.length + 1,
        role: candidate.role || "element",
        name: candidate.name.slice(0, 200),
        // An offscreen node has no box yet; it gets one once scrolled into view.
        box: box ?? { x: 0, y: 0, width: 0, height: 0 },
        backendNodeId: candidate.backendNodeId,
        via: candidate.via,
      })
    }

    return {
      page,
      nodes,
      ...(nodes.length === 0
        ? { truncated: "No interactive elements found. The page may be canvas-rendered or still loading." }
        : {}),
    }
  }

  /**
   * Resolves viewport boxes for the given nodes, one `DOM.getBoxModel` each.
   *
   * Sequential rather than parallel: there is no batch form, and firing
   * hundreds of concurrent commands starves the renderer on a page that is
   * already the reason the snapshot is slow. A node with no layout (hidden, or
   * `display: none`) simply has no model, which is not an error.
   */
  async #boxesFor(backendNodeIds: readonly number[]): Promise<Map<number, Box>> {
    const boxes = new Map<number, Box>()
    for (const backendNodeId of backendNodeIds) {
      if (this.destroyed) break
      try {
        const { model } = await this.#send<{ model: BoxModel }>(DOM_DOMAIN, "getBoxModel", { backendNodeId })
        const box = boxFromModel(model)
        if (box) boxes.set(backendNodeId, box)
      } catch {
        // No box for this node: hidden, detached, or owned by a cross-origin
        // frame. It is dropped here and, with `includeOffscreen`, re-measured
        // after `scrollIntoView` when the model acts on it.
      }
    }
    return boxes
  }

  /**
   * Asks the page which elements have click listeners attached.
   *
   * `getEventListeners` only exists in the DevTools context, which is why this
   * needs `includeCommandLineAPI`. Over CDP this is a read-only call — the page
   * is not mutated, unlike the DOM-mutation approach an earlier browser-use
   * revision used.
   */
  async #jsClickListenerNodeIds(): Promise<Set<number>> {
    const ids = new Set<number>()
    try {
      const { result } = await this.#send<{
        result: { value?: unknown; objectId?: string }
      }>(RUNTIME_DOMAIN, "evaluate", {
        expression: `(() => {
          if (typeof getEventListeners !== "function") return null;
          const all = document.querySelectorAll("*");
          if (all.length > ${MAX_JS_LISTENER_NODES}) return null;
          const out = [];
          for (const el of all) {
            try {
              const l = getEventListeners(el);
              if (l.click || l.mousedown || l.mouseup || l.pointerdown || l.pointerup) {
                out.push(el);
                if (out.length > ${MAX_JS_LISTENER_ELEMENTS}) return ${JSON.stringify(JS_LISTENER_OVERFLOW)};
              }
            } catch {}
          }
          return out;
        })()`,
        includeCommandLineAPI: true,
        returnByValue: false,
      })

      if (result.value === JS_LISTENER_OVERFLOW) return ids

      const arrayObjectId = result.objectId
      if (!arrayObjectId) return ids

      const { result: described } = await this.#send<{ result: { objectId?: string } }>(
        RUNTIME_DOMAIN,
        "callFunctionOn",
        {
          objectId: arrayObjectId,
          functionDeclaration: "function () { return this.map(el => el); }",
          returnByValue: false,
        },
      )
      if (!described.objectId) return ids

      const { result: descriptors } = await this.#send<{
        result: Array<{ name: string; value?: { objectId?: string } }>
      }>(RUNTIME_DOMAIN, "getProperties", {
        objectId: described.objectId,
        ownProperties: true,
        generatePreview: false,
      })

      // Array indices are numeric property names; the element objects hang off those.
      const elementObjectIds = descriptors
        .filter((prop) => /^\d+$/.test(prop.name))
        .map((prop) => prop.value?.objectId)
        .filter((id): id is string => typeof id === "string")

      // Resolve each element object to its backendNodeId, the handle every other
      // CDP call (box model, scroll, focus) accepts. Batched because each call
      // carries target bookkeeping that can starve concurrent screenshotting.
      for (let i = 0; i < elementObjectIds.length; i += DESCRIBE_NODE_BATCH) {
        const batch = elementObjectIds.slice(i, i + DESCRIBE_NODE_BATCH)
        const resolved = await Promise.all(
          batch.map(async (objectId) => {
            try {
              const { node } = await this.#send<{ node: { backendNodeId?: number } }>(
                DOM_DOMAIN,
                "describeNode",
                { objectId },
              )
              return node?.backendNodeId
            } catch {
              // Cross-origin element, or one the debugger cannot describe. It
              // stays absent from `jsClickIds` and is found via the AX tree instead.
              return undefined
            }
          }),
        )
        for (const backendNodeId of resolved) {
          if (typeof backendNodeId === "number") ids.add(backendNodeId)
        }
      }

      // Release the remote objects; otherwise the debugger keeps them alive.
      for (const objectId of [arrayObjectId, ...elementObjectIds]) {
        try {
          await this.#send(RUNTIME_DOMAIN, "releaseObject", { objectId })
        } catch {
          // Already collected.
        }
      }
    } catch {
      // Listener detection is an enhancement. A page that blocks evaluate still
      // gets a usable snapshot from the AX tree alone.
    }
    return ids
  }

  /**
   * Scrolls a node into view and returns its box in viewport coordinates.
   *
   * The scroll is done in JS rather than with `DOM.scrollIntoViewIfNeeded`,
   * which looks like the tidier call but blocks until the compositor produces a
   * frame. The embedded page is frequently not producing frames — collapsed
   * panel, occluded window — and every click then stalled for seconds before
   * being dispatched at stale coordinates. `scrollIntoView` on the node is
   * synchronous and needs no frame at all.
   */
  async scrollIntoView(backendNodeId: number): Promise<Box> {
    try {
      const { object } = await this.#send<{ object: { objectId: string } }>(DOM_DOMAIN, "resolveNode", {
        backendNodeId,
      })
      await this.#send(RUNTIME_DOMAIN, "callFunctionOn", {
        objectId: object.objectId,
        functionDeclaration: "function () { this.scrollIntoView({ block: 'center', inline: 'center' }) }",
      })
      await this.#send(RUNTIME_DOMAIN, "releaseObject", { objectId: object.objectId })
    } catch {
      // Already in view, or the node went away between the snapshot and here.
      // The box model below is the real check.
    }
    const { model } = await this.#send<{ model: BoxModel }>(DOM_DOMAIN, "getBoxModel", { backendNodeId })
    const box = boxFromModel(model)
    if (!box) throw new Error("Element has no clickable area — it may be hidden or zero-sized")
    return box
  }

  /** Clicks the centre of a box using real mouse events, as a person would. */
  async clickAt(box: Box): Promise<void> {
    const x = Math.round(box.x + box.width / 2)
    const y = Math.round(box.y + box.height / 2)
    await this.#send(INPUT_DOMAIN, "dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0 })
    await this.#send(INPUT_DOMAIN, "dispatchMouseEvent", {
      type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1,
    })
    await this.#send(INPUT_DOMAIN, "dispatchMouseEvent", {
      type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1,
    })
  }

  /** Focuses a node and types into it, then optionally presses Enter. */
  async typeText(backendNodeId: number, text: string, submit = false): Promise<void> {
    await this.scrollIntoView(backendNodeId)
    await this.#send(DOM_DOMAIN, "focus", { backendNodeId })

    for (let i = 0; i < text.length; i += TYPE_CHUNK) {
      await this.#send(INPUT_DOMAIN, "insertText", { text: text.slice(i, i + TYPE_CHUNK) })
    }

    if (submit) {
      // `text: "\r"` is what makes this a *press* rather than a bare key event.
      // Without it Chromium treats the Enter as a key state change only, and
      // implicit form submission never happens — so typing into a field of a
      // form with no submit button silently did nothing.
      await this.#send(INPUT_DOMAIN, "dispatchKeyEvent", {
        type: "keyDown",
        key: "Enter",
        code: "Enter",
        text: "\r",
        unmodifiedText: "\r",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      })
      await this.#send(INPUT_DOMAIN, "dispatchKeyEvent", {
        type: "keyUp",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      })
    }
  }

  async key(key: string, code: string, windowsVirtualKeyCode: number): Promise<void> {
    for (const type of ["keyDown", "keyUp"] as const) {
      await this.#send(INPUT_DOMAIN, "dispatchKeyEvent", {
        type, key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode,
      })
    }
  }

  /** Visible text of the document, capped so a huge page cannot flood the model. */
  async readText(maxChars = 8_000): Promise<ReadResult> {
    const page = await this.pageInfo()
    const { result } = await this.#send<{ result: { value?: string } }>(RUNTIME_DOMAIN, "evaluate", {
      expression: `(() => {
        const t = document.body ? document.body.innerText : "";
        return t.replace(/\\n{3,}/g, "\\n\\n");
      })()`,
      returnByValue: true,
    })
    const text = (result.value ?? "").trim()
    return {
      page,
      text: text.slice(0, maxChars),
      truncated: text.length > maxChars,
    }
  }

  /** Full-viewport PNG. Callers downscale via `capture.ts`'s `downscale`. */
  async screenshot(): Promise<Buffer> {
    const { data } = await this.#send<{ data: string }>(PAGE_DOMAIN, "captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    })
    return Buffer.from(data, "base64")
  }

  async printPdf(): Promise<Buffer> {
    // `Page.printToPDF` is not in Electron's debugger command set — calling it
    // throws `'Page.printToPDF' wasn't found`. `webContents.printToPDF` is the
    // supported path and gives the same bytes.
    return this.#contents.printToPDF({
      printBackground: true,
      pageSize: "A4",
    })
  }

  /** Runs page JavaScript. Used for polling, not by the model directly. */
  async evaluate<T>(expression: string): Promise<T> {
    const { result, exceptionDetails } = await this.#send<{
      result: { value?: T }
      exceptionDetails?: { text?: string }
    }>(RUNTIME_DOMAIN, "evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (exceptionDetails) throw new Error(exceptionDetails.text ?? "Page evaluation failed")
    return result.value as T
  }

  /**
   * Polls until `predicate` returns true or the budget runs out.
   *
   * Deliberately condition-based rather than a fixed sleep: a fixed wait is
   * either too short (flaky) or too long (slow), and sites vary enormously.
   */
  async waitFor(predicate: () => Promise<boolean>, timeoutMs = 10_000, intervalMs = 150): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await predicate()) return true
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    return false
  }
}

interface AxNode {
  backendDOMNodeId?: number
  role?: { value?: string }
  name?: { value?: string }
  properties?: Array<{ name: string; value?: { value?: unknown } }>
}

/** `border` is 8 ordered numbers: 4 corners then 4 edges, as [x1,y1,x2,y2,x3,y3,x4,y4]. */
interface BoxModel {
  border: number[]
}

/** Extracts the viewport rect from a box model, or null when it has no area. */
function boxFromModel(model: BoxModel | undefined): Box | null {
  const border = model?.border
  if (!border || border.length < 8) return null
  const [x1, y1, , , x2, y2] = border
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return null
  if (x2 <= x1 || y2 <= y1) return null
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

function axProperties(node: AxNode) {
  const out: Record<string, unknown> = {}
  for (const prop of node.properties ?? []) {
    if (prop.value && "value" in prop.value) out[prop.name] = prop.value.value
  }
  return out
}

function isAlreadyAttachedError(err: unknown): boolean {
  return err instanceof Error && /already attached/i.test(err.message)
}