"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { KeyboardEvent, MouseEvent } from "react"

/**
 * The full-screen selection surface shown while Alt+D is held.
 *
 * The ellipse is only a targeting gesture — main crops the plain rectangle it
 * inscribes, because an elliptical PNG has transparent corners that every
 * vision model would have to be told to ignore.
 *
 * This window is transparent, unfocusable and covers exactly one display, so the
 * only things drawn here are a scrim, the live selection, and feedback. Every
 * coordinate sent to main is absolute (screenX/screenY) rather than a client
 * coordinate, because main is the one that knows the display origin.
 */

/** Mirrors the `CaptureInfo` shape the bridge sends. Declared locally, as elsewhere. */
type CaptureInfo = {
  holdId: string
  displayId: number
  x: number
  y: number
  width: number
  height: number
  count: number
  max: number
  granted: boolean
  permissionMessage: string
}

type Rect = { left: number; top: number; width: number; height: number }
type Drag = { ax: number; ay: number; cx: number; cy: number }

/** Below this a drag reads as a misclick, and a sub-8px crop is never useful. */
const MIN_SELECTION_PX = 8

function rectBetween(aX: number, aY: number, bX: number, bY: number): Rect {
  return {
    left: Math.min(aX, bX),
    top: Math.min(aY, bY),
    width: Math.abs(bX - aX),
    height: Math.abs(bY - aY),
  }
}

export default function CaptureOverlayPage() {
  // Read lazily rather than during render: this route is prerendered at build
  // time, where there is no `window` and no preload to have run.
  const getApi = useCallback(() => window.electronAPI?.capture, [])
  const [info, setInfo] = useState<CaptureInfo | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Every selection released this hold, in order, in local coordinates. */
  const [rects, setRects] = useState<Rect[]>([])
  const [toast, setToast] = useState("")
  // Mirrored so mouse-up reads the live drag rather than the value captured in
  // the last render's closure, which is stale by definition by then.
  const dragRef = useRef<Drag | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setDragBoth = useCallback((next: Drag | null) => {
    dragRef.current = next
    setDrag(next)
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 1600)
  }, [])

  // Main shows this window before it sends `capture:show`, and re-shows it after
  // every capture, so both paths have to be handled.
  useEffect(() => {
    const api = getApi()
    if (!api) return
    let alive = true
    void api.info().then((next) => {
      if (alive && next) setInfo(next)
    })
    const offShow = api.onShow((next) => {
      setInfo((previous) => {
        // A new hold also resets the count to zero, which is indistinguishable
        // from "back to no captures" without the hold id to compare.
        if (previous && previous.holdId !== next.holdId) {
          setRects([])
          setDragBoth(null)
        }
        return next
      })
    })
    return () => {
      alive = false
      offShow()
    }
  }, [getApi, setDragBoth])

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  const onMouseDown = useCallback(
    (event: MouseEvent) => {
      if (event.button !== 0 || dragRef.current) return
      setDragBoth({ ax: event.screenX, ay: event.screenY, cx: event.screenX, cy: event.screenY })
    },
    [setDragBoth],
  )

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      const current = dragRef.current
      if (!current) return
      setDragBoth({ ...current, cx: event.screenX, cy: event.screenY })
    },
    [setDragBoth],
  )

  const onMouseUp = useCallback(
    (event: MouseEvent) => {
      const start = dragRef.current
      if (!start) return
      setDragBoth(null)
      if (!info) return

      const absolute = rectBetween(start.ax, start.ay, event.screenX, event.screenY)
      if (absolute.width < MIN_SELECTION_PX || absolute.height < MIN_SELECTION_PX) return

      if (!info.granted) {
        showToast(info.permissionMessage)
        return
      }
      if (info.count >= info.max) {
        showToast(`Limit reached — ${info.max} screenshots this hold`)
        return
      }

      // Recorded before main confirms, so the flash appears immediately; it
      // becomes a numbered badge once the count catches up.
      setRects((previous) => [
        ...previous,
        {
          left: absolute.left - info.x,
          top: absolute.top - info.y,
          width: absolute.width,
          height: absolute.height,
        },
      ])
      getApi()?.select({
        x: Math.round(absolute.left),
        y: Math.round(absolute.top),
        width: Math.round(absolute.width),
        height: Math.round(absolute.height),
      })
    },
    [getApi, info, setDragBoth, showToast],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        getApi()?.cancel()
      }
    },
    [getApi],
  )

  // Nothing to draw before main has said which display this is.
  if (!info) return null

  const w = info.width
  const h = info.height
  const live = drag
    ? rectBetween(drag.ax - info.x, drag.ay - info.y, drag.cx - info.x, drag.cy - info.y)
    : null
  const ellipse =
    live && drag
      ? {
          cx: live.left + live.width / 2,
          cy: live.top + live.height / 2,
          rx: live.width / 2,
          ry: live.height / 2,
        }
      : null
  // Confirmed captures get a number; the newest one keeps pulsing until main's
  // count catches up, so a slow capture never looks like a failed one.
  const confirmed = rects.slice(0, info.count)
  const inFlight = rects[info.count]
  // Without this permission the scrim is pointless: dimming the screen and then
  // ignoring every drag is worse than saying up front that capture is off.
  const active = info.granted

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-transparent"
      style={{ cursor: "crosshair", userSelect: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg className="absolute inset-0 h-full w-full" width={w} height={h}>
        <defs>
          {/* The scrim is a full-screen rect with the live ellipse punched out,
              so the dimming follows the selection instead of dimming the very
              region the user is trying to read. */}
          <mask id="capture-hole" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect x={0} y={0} width={w} height={h} fill="white" />
            {ellipse ? (
              <ellipse cx={ellipse.cx} cy={ellipse.cy} rx={ellipse.rx} ry={ellipse.ry} fill="black" />
            ) : null}
          </mask>
        </defs>

        {active ? (
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            className="fill-black/20"
            mask="url(#capture-hole)"
          />
        ) : null}

        {active && ellipse ? (
          <ellipse
            cx={ellipse.cx}
            cy={ellipse.cy}
            rx={ellipse.rx}
            ry={ellipse.ry}
            className="fill-none stroke-primary"
            strokeWidth={2}
          />
        ) : null}

        {confirmed.map((rect, index) => (
          <g key={`${rect.left}-${rect.top}-${index}`}>
            <rect
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              className="fill-none stroke-primary opacity-75"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <circle cx={rect.left + rect.width / 2} cy={rect.top + rect.height / 2} r={13} className="fill-primary" />
            <text
              x={rect.left + rect.width / 2}
              y={rect.top + rect.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-primary-foreground text-[13px] font-medium"
            >
              {index + 1}
            </text>
          </g>
        ))}

        {inFlight ? (
          <rect
            x={inFlight.left}
            y={inFlight.top}
            width={inFlight.width}
            height={inFlight.height}
            className="animate-pulse fill-primary/25 stroke-primary"
            strokeWidth={2}
          />
        ) : null}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
        {active ? (
          <div className="rounded-full bg-black/70 px-3 py-1 text-[12px] font-medium text-white">
            {info.count}/{info.max} · drag to capture · Esc to cancel
          </div>
        ) : (
          <div className="max-w-sm rounded-xl bg-black/85 px-4 py-3 text-center text-white">
            <p className="text-[13px] font-semibold">Screenshot capture is off</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/80">
              {info.permissionMessage}
            </p>
            <p className="mt-1.5 text-[11px] text-white/60">
              Dictation still works — release Alt+D to send your transcript.
            </p>
          </div>
        )}
      </div>

      {toast && active ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center">
          <div className="rounded-full bg-primary px-3 py-1 text-[12px] font-medium text-primary-foreground">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  )
}
