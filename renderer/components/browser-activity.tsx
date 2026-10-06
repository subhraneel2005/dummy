"use client"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  CheckIcon,
  GlobeIcon,
  MousePointerClickIcon,
  SaveIcon,
  TypeIcon,
  UndoIcon,
  CameraIcon,
  FileTextIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { BrowserApproval, ToolActivity } from "@/hooks/use-chat"

/**
 * Tools are read as sentences, not as identifiers.
 *
 * `browser_click` in a transcript is a leak of the wire format into the UI; the
 * reader cares that something was clicked and where it landed. The raw name is
 * still available one disclosure away for when the user wants to check exactly
 * what the model asked for.
 */
const toolLabels: Record<string, string> = {
  browser_navigate: "Opened page",
  browser_snapshot: "Read page structure",
  browser_read: "Read page text",
  browser_screenshot: "Captured screenshot",
  browser_click: "Clicked",
  browser_type: "Typed",
  browser_go: "Went back or forward",
  browser_save_pdf: "Saved PDF",
}

const toolIcons: Record<string, typeof GlobeIcon> = {
  browser_navigate: GlobeIcon,
  browser_snapshot: FileTextIcon,
  browser_read: FileTextIcon,
  browser_screenshot: CameraIcon,
  browser_click: MousePointerClickIcon,
  browser_type: TypeIcon,
  browser_go: UndoIcon,
  browser_save_pdf: SaveIcon,
}

/** A stable order for back/forward, which arrive as one tool with a direction. */
function goIcon(value: unknown) {
  return value === "forward" ? ArrowRightIcon : ArrowLeftIcon
}

/**
 * The icon for one call, resolved in a helper rather than inside `ToolRow`.
 *
 * The rules that watch for components being built during render only apply
 * inside components, and there is nothing to build here — both branches are
 * imported components being picked between.
 */
function toolIconElement(activity: ToolActivity) {
  const Icon =
    activity.toolName === "browser_go"
      ? goIcon((activity.input as Record<string, unknown> | null)?.direction)
      : toolIcons[activity.toolName] ?? GlobeIcon
  return <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
}

/** The part of a tool input a human needs to confirm an action. */
function inputSummary(input: unknown): string {
  if (typeof input !== "object" || input === null) return ""
  const record = input as Record<string, unknown>
  if (typeof record.ref === "number" || typeof record.ref === "string") {
    const label = typeof record.name === "string" && record.name ? record.name : `ref ${record.ref}`
    const action = typeof record.action === "string" ? record.action : ""
    return action ? `${action} “${label}”` : label
  }
  if (typeof record.url === "string") return record.url
  if (typeof record.direction === "string") return record.direction
  if (typeof record.text === "string") {
    const text = record.text
    return text.length > 60 ? `“${text.slice(0, 60)}…”` : `“${text}”`
  }
  return ""
}

/** The URL a tool ended up on, if its output carries one. */
function outputPage(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null
  const page = (output as Record<string, unknown>).page
  if (typeof page !== "object" || page === null) return null
  const url = (page as Record<string, unknown>).url
  return typeof url === "string" && url ? url : null
}

/**
 * One tool call in the transcript.
 *
 * The summary line stays visible when collapsed — "Clicked “Sign in”" is the
 * whole point, and hiding it behind a chevron would make the timeline
 * unreadable at a glance. The disclosure only guards the full input/output
 * JSON, which is long and rarely interesting.
 */
function ToolRow({ activity }: { activity: ToolActivity }) {
  const [open, setOpen] = useState(false)

  const summary = inputSummary(activity.input)
  const destination = outputPage(activity.output)
  const denied = activity.approved === false
  const failed = activity.error !== null

  const status = denied
    ? "Denied"
    : failed
      ? "Failed"
      : activity.status === "running"
        ? activity.approvalId
          ? "Waiting for you"
          : "Running"
        : "Done"

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {toolIconElement(activity)}
        <span className="shrink-0 font-medium">
          {toolLabels[activity.toolName] ?? activity.toolName}
        </span>
        {summary ? (
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{summary}</span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {activity.status === "running" && !activity.approvalId ? (
          <Spinner aria-label="Running" className="size-3.5 text-muted-foreground" />
        ) : null}
        <span
          className={cn(
            "shrink-0 text-xs",
            denied ? "text-muted-foreground" : failed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status}
          {activity.durationMs !== null && activity.status === "done" && !denied
            ? ` · ${(activity.durationMs / 1000).toFixed(1)}s`
            : ""}
        </span>
      </div>
      {destination ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{destination}</p>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        {open ? "Hide details" : "Details"}
      </button>
      {open ? (
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/60 p-2 text-xs leading-relaxed">
          {JSON.stringify({ input: activity.input, output: activity.output }, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

/**
 * The approve/deny card.
 *
 * Deliberately not dismissible: while this is on screen the turn is parked in
 * main, and dismissing it without answering would leave the user staring at a
 * stuck assistant. Answering either way always resumes the turn.
 */
function ApprovalCard({
  approval,
  onRespond,
  busy,
}: {
  approval: BrowserApproval
  onRespond: (approvalId: string, approved: boolean) => void
  busy: boolean
}) {
  const summary = inputSummary(approval.input)
  return (
    <div
      role="group"
      aria-label={`Approve ${toolLabels[approval.toolName] ?? approval.toolName}`}
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3"
    >
      <p className="text-sm font-medium">
        Allow {toolLabels[approval.toolName] ?? approval.toolName}
        {summary ? ` ${summary}` : ""}?
      </p>
      {approval.reason ? (
        <p className="mt-1 text-sm text-muted-foreground">{approval.reason}</p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          This action changes something outside the app, so it needs your decision.
        </p>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={busy}
          onClick={() => onRespond(approval.approvalId, false)}
        >
          Deny
        </Button>
        <Button
          size="sm"
          type="button"
          disabled={busy}
          onClick={() => onRespond(approval.approvalId, true)}
        >
          <CheckIcon aria-hidden="true" />
          Allow
        </Button>
      </div>
    </div>
  )
}

/**
 * Browser activity for the current turn.
 *
 * Approval cards come before the timeline: an unanswered prompt is the only
 * thing on screen that needs the user, so it must not sit below a list of
 * already-finished work.
 */
export function BrowserActivity({
  toolActivity,
  approvals,
  onRespond,
  responding,
}: {
  toolActivity: Record<string, ToolActivity>
  approvals: BrowserApproval[]
  onRespond: (approvalId: string, approved: boolean) => void
  responding: boolean
}) {
  const rows = Object.values(toolActivity)
  if (rows.length === 0 && approvals.length === 0) return null

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      {approvals.map((approval) => (
        <ApprovalCard
          key={approval.approvalId}
          approval={approval}
          onRespond={onRespond}
          busy={responding}
        />
      ))}
      {rows.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {rows.map((activity) => (
            <ToolRow key={activity.toolCallId} activity={activity} />
          ))}
        </div>
      ) : null}
    </div>
  )
}