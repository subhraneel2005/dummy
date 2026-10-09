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
  PlayIcon,
  PauseIcon,
  ShieldAlertIcon,
  TerminalIcon,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { BrowserApproval, DeepCell, ToolActivity } from "@/hooks/use-chat"

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
  browser_deep_task: "Ran deep task",
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
  browser_deep_task: PlayIcon,
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
  if (typeof record.task === "string") {
    const task = record.task
    return task.length > 80 ? `“${task.slice(0, 80)}…”` : `“${task}”`
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

/** A deep task's closing summary, shown as the row's destination line. */
function deepTaskSummary(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null
  const summary = (output as Record<string, unknown>).summary
  if (typeof summary !== "string" || !summary) return null
  return summary.length > 120 ? `${summary.slice(0, 120)}…` : summary
}

/**
 * One live cell inside a running deep task.
 *
 * The code snippet sits above the cell's latest output; both are replaced as
 * the cell progresses, never accumulated — each event already carries the full
 * current text. A height cap keeps a chatty cell from stretching the timeline.
 */
function DeepCellRow({ cell }: { cell: DeepCell }) {
  const statusText = cell.status === "error" ? "Failed" : cell.status === "done" ? "Done" : "Running"
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {cell.kind === "code" ? (
          <TerminalIcon aria-hidden="true" className="size-3 shrink-0" />
        ) : (
          <CheckIcon aria-hidden="true" className="size-3 shrink-0" />
        )}
        <span className="font-medium">{cell.kind === "code" ? "JS cell" : "Finished"}</span>
        {cell.status === "running" ? (
          <Spinner aria-label="Running" className="size-3 text-muted-foreground" />
        ) : null}
        <span
          className={cn("ml-auto shrink-0", cell.status === "error" && "text-destructive")}
        >
          {statusText}
        </span>
      </div>
      {cell.code ? (
        <pre className="truncate rounded bg-muted/40 px-2 py-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {cell.code}
        </pre>
      ) : null}
      {cell.detail ? (
        <pre
          className={cn(
            "max-h-32 overflow-auto rounded bg-muted/40 px-2 py-1 font-mono text-[11px] leading-relaxed",
            cell.status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {cell.detail}
          {cell.truncated ? " …" : ""}
        </pre>
      ) : null}
    </div>
  )
}

/**
 * One tool call in the transcript.
 *
 * The summary line stays visible when collapsed — "Clicked “Sign in”" is the
 * whole point, and hiding it behind a chevron would make the timeline
 * unreadable at a glance. The disclosure only guards the full input/output
 * JSON, which is long and rarely interesting.
 */
function ToolRow({
  activity,
  onControl,
}: {
  activity: ToolActivity
  onControl: (paused: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  const summary = inputSummary(activity.input)
  const destination = outputPage(activity.output) ?? deepTaskSummary(activity.output)
  const denied = activity.approved === false
  const failed = activity.error !== null

  const status = denied
    ? "Denied"
    : failed
      ? "Failed"
      : activity.deepChallenge
        ? "Needs you"
        : activity.deepPaused
          ? "Paused"
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
        {activity.status === "running" && !activity.approvalId && !activity.deepPaused ? (
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
      {activity.cells && activity.cells.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-border/40 pt-2">
          {activity.cells.map((cell) => (
            <DeepCellRow key={cell.cellId} cell={cell} />
          ))}
        </div>
      ) : null}
      {activity.deepChallenge ? (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <ShieldAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">{activity.deepChallenge.reason}</p>
              {activity.deepChallenge.snippet ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {activity.deepChallenge.snippet}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Solve it in the Chrome window, then resume the task.
              </p>
            </div>
            <Button variant="outline" size="sm" type="button" onClick={() => onControl(false)}>
              <PlayIcon aria-hidden="true" />
              Resume
            </Button>
          </div>
        </div>
      ) : activity.deepPaused ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <PauseIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="flex-1">Paused</span>
          <Button variant="outline" size="sm" type="button" onClick={() => onControl(false)}>
            <PlayIcon aria-hidden="true" />
            Resume
          </Button>
        </div>
      ) : activity.status === "running" && activity.toolName === "browser_deep_task" ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onControl(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <PauseIcon aria-hidden="true" className="size-3" />
            Pause
          </button>
        </div>
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
  onDeepControl,
}: {
  toolActivity: Record<string, ToolActivity>
  approvals: BrowserApproval[]
  onRespond: (approvalId: string, approved: boolean) => void
  responding: boolean
  onDeepControl: (paused: boolean) => void
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
            <ToolRow key={activity.toolCallId} activity={activity} onControl={onDeepControl} />
          ))}
        </div>
      ) : null}
    </div>
  )
}