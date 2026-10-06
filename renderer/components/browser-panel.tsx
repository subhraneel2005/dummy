"use client"

import { useCallback, useEffect, useRef } from "react"
import { ChevronDownIcon, GlobeIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

/**
 * The browser, as a collapsible panel inside the chat window.
 *
 * The page itself is not rendered here. It lives in a native `WebContentsView`
 * that main lays over this panel, so what this component owns is the panel's
 * *rectangle* — reported on every layout change — plus the chrome around it.
 *
 * Collapsing hides the native view but does not unload it, which is the whole
 * point: the model can still be mid-task on a page, and the user can go back to
 * the transcript and come straight back to where they left off.
 */
export interface BrowserPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  page: { url: string; title: string } | null
  className?: string
}

export function BrowserPanel({ open, onOpenChange, page, className }: BrowserPanelProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)

  /**
   * Reports the panel's rectangle to main, in the window's own coordinates.
   *
   * `getBoundingClientRect` is relative to the viewport, which is exactly the
   * coordinate space a `WebContentsView` bounds rect lives in, so no offset
   * arithmetic is needed. A collapsed panel reports `null`, which hides the view
   * without touching the page.
   */
  const reportBounds = useCallback(() => {
    const surface = surfaceRef.current
    const api = window.electronAPI?.browser
    if (!api) return
    if (!open || !surface) {
      void api.setBounds(null)
      return
    }
    const rect = surface.getBoundingClientRect()
    // A zero-sized rect would park the view at a point and swallow clicks that
    // belong to the transcript, so an unlaid-out panel reports nothing.
    if (rect.width < 1 || rect.height < 1) {
      void api.setBounds(null)
      return
    }
    void api.setBounds({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
  }, [open])

  // Re-report whenever the panel opens, the window resizes, or the transcript
  // above it grows: all three move the panel without the user touching it.
  useEffect(() => {
    reportBounds()
    if (!open) return
    const surface = surfaceRef.current
    if (!surface) return
    const observer = new ResizeObserver(reportBounds)
    observer.observe(surface)
    window.addEventListener("resize", reportBounds)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", reportBounds)
    }
  }, [open, reportBounds])

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        // Collapsing hides the page but keeps it loaded; expanding shows it again
        // in the same place, so the user returns to the page they left.
        if (next) void window.electronAPI?.browser.show()
        else void window.electronAPI?.browser.hide()
      }}
      className={cn("shrink-0", className)}
    >
      <CollapsibleTrigger
        className="group flex w-full items-center gap-2 rounded-t-xl border border-b-0 border-border bg-muted/30 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
        aria-label={open ? "Collapse the browser" : "Show the browser"}
      >
        <GlobeIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {page ? page.title || page.url : "Browser"}
        </span>
        {page ? (
          <span className="hidden min-w-0 max-w-[45%] truncate text-xs text-muted-foreground sm:inline">
            {page.url}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No page open</span>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="border border-border bg-background">
        <div className="flex items-center gap-1 border-b border-border px-2 py-1">
          <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">
            {page?.url ?? ""}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Collapse the browser"
            onClick={() => onOpenChange(false)}
          >
            <ChevronDownIcon aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Close the browser"
            onClick={() => {
              onOpenChange(false)
              void window.electronAPI?.browser.close()
            }}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        {/* The native view is drawn over this box, so it must stay empty: any
            content here would sit *behind* the page and only peek out if the
            page failed to paint. The muted background is what shows if the
            model has not opened anything yet. */}
        <div
          ref={surfaceRef}
          className="h-[min(60vh,520px)] w-full bg-muted/40"
          aria-label="Browser page"
        />
      </CollapsibleContent>
    </Collapsible>
  )
}
