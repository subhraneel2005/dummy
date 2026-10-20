"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FitAddon } from "@xterm/addon-fit"
import { Terminal, type ITheme } from "@xterm/xterm"
import { RotateCcwIcon, SquareTerminalIcon, XIcon } from "lucide-react"
import "@xterm/xterm/css/xterm.css"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** A dark terminal even in the light theme, the way editors and IDEs do it. */
const TERMINAL_THEME: ITheme = {
  background: "#0b0b0c",
  foreground: "#e4e4e7",
  cursor: "#a1a1aa",
  cursorAccent: "#0b0b0c",
  selectionBackground: "#3f3f46",
  black: "#18181b",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e4e4e7",
  brightBlack: "#52525b",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde047",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#fafafa",
}

type Status = "idle" | "running" | "exited" | "error"

/** Mirrors main's `TerminalInfoResult`; the bridge d.ts is module-local. */
type TerminalInfoResult =
  | { ok: true; id: string; shell: string; cwd: string }
  | { ok: false; error: string }

interface TerminalPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
}

/**
 * A real PTY-backed terminal.
 *
 * The xterm instance is created on first open and then kept mounted, so hiding
 * the panel does not kill a running build. The PTY is owned by main; this
 * component only forwards keystrokes and dimensions, and disposes its session
 * when it unmounts.
 */
export function TerminalPanel({
  open,
  onOpenChange,
  className,
}: TerminalPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const idRef = useRef<string | null>(null)
  const mountedRef = useRef(false)
  const startingRef = useRef(false)
  const openRef = useRef(open)
  const cleanupRef = useRef<(() => void) | null>(null)

  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<{ shell: string; cwd: string } | null>(null)

  const fitAndResize = useCallback(() => {
    const term = termRef.current
    const fit = fitRef.current
    if (!term || !fit) return
    const cols = term.cols
    const rows = term.rows
    fit.fit()
    if (term.cols !== cols || term.rows !== rows) {
      const id = idRef.current
      if (id) {
        void window.electronAPI?.terminal?.resize(id, term.cols, term.rows)
      }
    }
  }, [])

  const start = useCallback(async () => {
    const term = termRef.current
    const fit = fitRef.current
    if (!term || !fit) return
    if (startingRef.current) return

    const api = window.electronAPI?.terminal
    if (!api) {
      setStatus("error")
      setError("The terminal bridge is unavailable in this build.")
      return
    }

    startingRef.current = true
    setStatus("idle")
    setError(null)

    const size = fit.proposeDimensions()
    let result: TerminalInfoResult
    try {
      result = await api.create(size?.cols ?? 80, size?.rows ?? 24)
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : "Could not start the terminal.",
      }
    } finally {
      startingRef.current = false
    }

    // The panel can unmount while the PTY is spawning (route change or reload).
    // Dispose the orphan and do not touch state on the dead component.
    if (termRef.current !== term) {
      if (result.ok) void api.dispose(result.id)
      return
    }

    if (!result.ok) {
      setStatus("error")
      setError(result.error)
      term.write(`\r\n\x1b[31m${result.error}\x1b[0m\r\n`)
      return
    }

    idRef.current = result.id
    setInfo({ shell: result.shell, cwd: result.cwd })
    setStatus("running")
    term.focus()
  }, [])

  const restart = useCallback(() => {
    const term = termRef.current
    if (!term) return
    const id = idRef.current
    idRef.current = null
    if (id) void window.electronAPI?.terminal?.dispose(id)
    term.reset()
    term.write("\x1b[90mRestarting shell…\x1b[0m\r\n")
    setInfo(null)
    void start()
  }, [start])

  // Create xterm on the first open. It stays alive after that so collapsing the
  // panel does not throw away the scrollback.
  useEffect(() => {
    openRef.current = open
    if (!open) {
      termRef.current?.blur()
      return
    }

    if (mountedRef.current) {
      requestAnimationFrame(() => {
        fitAndResize()
        termRef.current?.focus()
      })
      return
    }

    const host = hostRef.current
    if (!host) return
    mountedRef.current = true

    const term = new Terminal({
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Mono", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 5000,
      theme: TERMINAL_THEME,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    termRef.current = term
    fitRef.current = fit
    fit.fit()

    const input = term.onData((data) => {
      const id = idRef.current
      if (id) void window.electronAPI?.terminal?.write(id, data)
    })

    // Cmd+C copies only when there is a selection (otherwise Ctrl+C belongs to
    // the shell). Cmd+V pastes into the PTY. Everything else passes through.
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true
      // Cmd only: on macOS Ctrl+C must always reach the shell as SIGINT.
      if (!event.metaKey) return true
      const key = event.key.toLowerCase()
      if (key === "c" && term.hasSelection()) {
        void navigator.clipboard.writeText(term.getSelection())
        return false
      }
      if (key === "v") {
        void navigator.clipboard
          .readText()
          .then((text) => {
            const id = idRef.current
            if (id && text) void window.electronAPI?.terminal?.write(id, text)
          })
          .catch(() => {
            // Clipboard access can be denied; the shell keeps working.
          })
        return false
      }
      return true
    })

    term.write("\x1b[90mStarting shell…\x1b[0m\r\n")
    void start()

    const offData = window.electronAPI?.terminal?.onData(({ id, data }) => {
      if (id === idRef.current) term.write(data)
    })
    const offExit = window.electronAPI?.terminal?.onExit(({ id, exitCode }) => {
      if (id !== idRef.current) return
      idRef.current = null
      setStatus("exited")
      term.write(
        `\r\n\x1b[90m[process exited with code ${exitCode}]\x1b[0m\r\n`,
      )
    })

    const onBeforeUnload = () => {
      const id = idRef.current
      if (id) void window.electronAPI?.terminal?.dispose(id)
    }
    window.addEventListener("beforeunload", onBeforeUnload)

    // Keep the cleanup off this effect so closing the panel does not run it.
    cleanupRef.current = () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      offData?.()
      offExit?.()
      input.dispose()
      const id = idRef.current
      idRef.current = null
      if (id) void window.electronAPI?.terminal?.dispose(id)
      term.dispose()
      termRef.current = null
      fitRef.current = null
      mountedRef.current = false
    }
  }, [open, fitAndResize, start])

  // Owner-level cleanup (route change, HMR, app shutdown).
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  // Fit when the panel becomes visible and whenever its box changes. `fit()`
  // is coalesced to one animation frame and only sent to the PTY when the
  // dimensions actually changed.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (!openRef.current) return
      if (!host.clientWidth || !host.clientHeight) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fitAndResize)
    })
    observer.observe(host)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [fitAndResize])

  const shellLabel = info ? `${info.cwd} · ${info.shell}` : "PTY · not started"

  return (
    <div
      className={cn("shrink-0", !open && "hidden", className)}
      aria-hidden={!open}
    >
      <div className="overflow-hidden rounded-xl border border-border/60 bg-[#0b0b0c]">
        <div className="flex h-9 items-center gap-2 border-b border-white/10 px-3 text-xs text-muted-foreground">
          <SquareTerminalIcon className="size-3.5" aria-hidden="true" />
          <span className="font-medium text-foreground/80">Terminal</span>
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              status === "running" && "bg-emerald-500",
              status === "exited" && "bg-amber-500",
              status === "error" && "bg-destructive",
              status === "idle" && "bg-muted-foreground/40",
            )}
          />
          <span className="min-w-0 truncate font-mono text-[11px]" title={shellLabel}>
            {shellLabel}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={restart}
              disabled={status === "idle"}
              title="Restart shell"
              aria-label="Restart shell"
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcwIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onOpenChange(false)}
              title="Hide terminal"
              aria-label="Hide terminal"
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            <span className="min-w-0 flex-1 truncate" title={error}>
              {error}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={restart}
              className="text-destructive hover:bg-destructive/20 hover:text-destructive"
            >
              Retry
            </Button>
          </div>
        ) : null}

        <div
          ref={hostRef}
          className="h-[36vh] min-h-[200px] max-h-[480px] px-2 py-1.5"
          onClick={() => termRef.current?.focus()}
        />
      </div>
    </div>
  )
}
