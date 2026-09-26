"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckIcon, CopyIcon, PlusIcon } from "lucide-react"

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments"
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { AppSidebar, type ChatSession } from "@/components/app-sidebar"
import { ProviderIcon, providerLabel } from "@/components/provider-icon"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useChat, type ChatMessage } from "@/hooks/use-chat"
import { cn } from "@/lib/utils"

/**
 * Streamdown ships its vertical rhythm as `space-y-4` plus `my-4` on the code
 * wrapper, but those class names only exist inside `node_modules`, which
 * Tailwind never scans. The result: the classes land in the DOM with no CSS
 * behind them, so prose and code ended up flush at 16px. This restates the
 * rhythm in app source (where it does get compiled) and zeroes the inherited
 * margins so the spacing is deliberate rather than whatever collapses last.
 */
const MARKDOWN_SPACING = "[&>*]:!my-0 [&>*+*]:!mt-6"

/** Shared measure for the transcript, the hero and the composer. */
const CHAT_COLUMN = "mx-auto w-full max-w-3xl"

export default function ChatWindowPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const { messages, streamingText, sending, error, send, clearLocal } = useChat(activeId)
  const [job, setJob] = useState<{ id: number; text: string } | null>(null)
  const jobIdRef = useRef(0)
  const [draft, setDraft] = useState("")
  const [config, setConfig] = useState<{ provider: string | null; model: string | null }>({
    provider: null,
    model: null,
  })

  // The provider/model shown in the chrome comes from the same settings the
  // send path uses, so it can never drift from what actually answers.
  const refreshConfig = useCallback(async () => {
    const result = await window.electronAPI?.ai.getConfig()
    if (result?.ok) {
      setConfig({ provider: result.config.provider, model: result.config.model })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.electronAPI?.ai.getConfig().then((result) => {
      if (cancelled || !result?.ok) return
      setConfig({ provider: result.config.provider, model: result.config.model })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshSessions = useCallback(async () => {
    const result = await window.electronAPI?.chat.listSessions()
    if (result?.ok) setSessions(result.sessions)
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.electronAPI?.chat.listSessions().then((result) => {
      if (cancelled || !result?.ok) return
      setSessions(result.sessions)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // A finished turn is the moment a thread's auto-title and recency settle, so
  // that is when the sidebar list is worth re-reading.
  const wasSending = useRef(false)
  useEffect(() => {
    if (!wasSending.current || sending) {
      wasSending.current = sending
      return
    }
    wasSending.current = false
    let cancelled = false
    void window.electronAPI?.chat.listSessions().then((result) => {
      if (cancelled || !result?.ok) return
      setSessions(result.sessions)
    })
    // The provider can be switched from settings while a turn is in flight.
    void refreshConfig()
    return () => {
      cancelled = true
    }
  }, [sending, refreshConfig])

  const enqueue = useCallback((text: string) => {
    if (!text.trim()) return
    jobIdRef.current += 1
    setJob({ id: jobIdRef.current, text })
  }, [])

  // `takeInitialText` is non-destructive: main keeps the transcript until we ack
  // it, so an effect torn down mid-flight (HMR, reload) can't lose it.
  useEffect(() => {
    let cancelled = false
    void window.electronAPI?.chat
      .takeInitialText()
      .then((text) => {
        if (cancelled || !text) return
        enqueue(text)
        void window.electronAPI?.chat.ackInitialText()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [enqueue])

  useEffect(() => {
    return window.electronAPI?.chat.onInitialText((text) => enqueue(text))
  }, [enqueue])

  /** Sends into `activeId`, minting an id when this is a brand-new thread. */
  const dispatch = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      const target = activeId ?? crypto.randomUUID()
      if (!activeId) setActiveId(target)
      // `send` appends the prompt to the transcript, so the box can be emptied
      // immediately instead of holding a stale copy that Enter would resend.
      setDraft("")
      await send(trimmed, target)
    },
    [activeId, send, sending]
  )

  // Consume the queued transcript.
  //
  // Guarding on the job id (not just the deps) is essential: `send` is a
  // useCallback keyed on `sending`, so its identity changes every time a request
  // starts and finishes. Depending on it alone made this effect re-send the same
  // transcript on each toggle. Only a genuinely new job may send.
  const handledJobRef = useRef(0)
  useEffect(() => {
    if (!job || job.id === handledJobRef.current) return
    handledJobRef.current = job.id
    void dispatch(job.text)
  }, [job, dispatch])

  const submit = useCallback(
    ({ text }: PromptInputMessage) => {
      void dispatch(text)
    },
    [dispatch]
  )

  const startNewChat = useCallback(() => {
    clearLocal()
    setActiveId(null)
    setDraft("")
  }, [clearLocal])

  const selectSession = useCallback(
    (id: string) => {
      if (id === activeId) return
      clearLocal()
      setActiveId(id)
      setDraft("")
    },
    [activeId, clearLocal]
  )

  const renameSession = useCallback(
    async (id: string, title: string) => {
      const result = await window.electronAPI?.chat.renameSession(id, title)
      if (result?.ok) void refreshSessions()
    },
    [refreshSessions]
  )

  const deleteSession = useCallback(
    async (id: string) => {
      const result = await window.electronAPI?.chat.deleteSession(id)
      if (!result?.ok) return
      if (id === activeId) startNewChat()
      void refreshSessions()
    },
    [activeId, refreshSessions, startNewChat]
  )

  const showThinking = sending && !streamingText
  const isEmpty = !messages.length && !streamingText && !showThinking

  return (
    <SidebarProvider className="h-dvh overflow-hidden bg-background">
      <AppSidebar
        sessions={sessions}
        activeId={activeId}
        provider={config.provider}
        onSelect={selectSession}
        onNewChat={startNewChat}
        onRename={renameSession}
        onDelete={deleteSession}
      />
      <SidebarInset className="min-h-0">
        {/* No custom header: the native title bar owns the top of the window, so
            nothing here has to imitate or make room for window controls. */}
        <Conversation className="min-h-0 flex-1">
          {/* One reading column for the whole surface: the transcript, the hero
              and the composer all resolve to the same width, so the left and
              right edges line up instead of the composer floating in a
              narrower box. The padding lives on the column, not on the
              scroller, so scrolling content keeps its measure. */}
          <ConversationContent
            className={cn(isEmpty && "min-h-full justify-center")}
          >
            <div className={cn(CHAT_COLUMN, "flex flex-col gap-6 px-6 py-6")}>
              {isEmpty ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold tracking-tight text-balance">
                    Lock In
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Hold D to dictate, then send. Or write below.
                  </p>
                </div>
              ) : null}

              {messages.map((message, index) => (
                <ChatRow key={`${message.role}-${index}`} message={message} />
              ))}

              {streamingText ? (
                <Message from="assistant" className="max-w-full">
                  <MessageContent className="max-w-full" aria-live="polite">
                    <MessageResponse className={MARKDOWN_SPACING} isAnimating>
                      {streamingText}
                    </MessageResponse>
                  </MessageContent>
                </Message>
              ) : null}

              {showThinking ? (
                <Message from="assistant" className="max-w-full">
                  <MessageContent className="max-w-full">
                    <p className="text-sm text-muted-foreground motion-safe:animate-pulse">
                      Thinking
                    </p>
                  </MessageContent>
                </Message>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-4 py-3 text-sm leading-relaxed text-destructive"
                >
                  {error}
                </p>
              ) : null}
            </div>
          </ConversationContent>
          <ConversationScrollButton className="size-7" />
        </Conversation>

        {/* No divider: the composer is separated from the transcript by space
            alone, which keeps the surface quiet and avoids a hard edge across
            the full window width. */}
        <footer className={cn(CHAT_COLUMN, "shrink-0 px-6 pt-8 pb-5")}>
          <div className="mb-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <ProviderIcon provider={config.provider} className="size-3.5" />
            <span className="truncate">
              {providerLabel(config.provider)}
              {config.model ? ` · ${config.model}` : ""}
            </span>
          </div>
          {/* `PromptInput` forwards className to its <form>, not to the bordered
              group, so the border, the radius, the row gap and the collapsed
              height all have to be restated against the group itself.
              `border-input` (white/15%) is heavier than the hairline asked for. */}
          <PromptInput
            onSubmit={submit}
            className="w-full shadow-none [&_[data-slot=input-group]]:gap-1 [&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:border-border"
          >
            <PromptAttachmentsHeader />
            <PromptInputTextarea
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              placeholder="Send a message, or hold D to dictate…"
              aria-label="Message"
              // `md:` is required: shadcn's Textarea ships `text-base md:text-sm`,
              // and the responsive variant survives twMerge as its own group.
              // `py-2` (not `py-3.5`) keeps the collapsed box short, and
              // `min-h-0` is the load-bearing part: `PromptInputTextarea` ships
              // `min-h-16`, which alone pinned the box at 64px before any
              // padding was counted. `max-h-32` caps the growth.
              className="min-h-0 max-h-32 px-4 py-1.5 text-[0.9375rem] leading-relaxed md:text-[0.9375rem]"
            />
            <PromptInputFooter className="px-1.5 pt-0 pb-1">
              <PromptInputTools>
                <AddAttachmentsButton />
              </PromptInputTools>
              <PromptInputSubmit
                status={showThinking ? "submitted" : "ready"}
                disabled={!draft.trim() || sending}
              />
            </PromptInputFooter>
          </PromptInput>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * `PromptInputHeader` is an `InputGroupAddon`, so rendering it unconditionally
 * leaves a permanently empty row (6px + 8px padding plus an 4px group gap)
 * inside the composer. Gate it on the files actually being present.
 */
function PromptAttachmentsHeader() {
  const attachments = usePromptInputAttachments()
  if (!attachments.files.length) return null

  return (
    <PromptInputHeader>
      <PromptAttachments />
    </PromptInputHeader>
  )
}

function PromptAttachments() {
  const attachments = usePromptInputAttachments()
  if (!attachments.files.length) return null

  // Composed from the ready-made ai-elements primitives rather than a bespoke
  // list: `Attachments` supplies the layout/variant context, and each
  // `Attachment` gets a real preview, a label, and a remove control.
  return (
    <Attachments>
      {attachments.files.map((file) => (
        <Attachment
          key={file.id}
          data={file}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  )
}

function AddAttachmentsButton() {
  const attachments = usePromptInputAttachments()
  return (
    <PromptInputButton
      variant="ghost"
      tooltip="Add attachments"
      aria-label="Add attachments"
      className="text-muted-foreground hover:text-foreground"
      onClick={() => attachments.openFileDialog()}
    >
      <PlusIcon />
    </PromptInputButton>
  )
}

function ChatRow({ message }: { message: ChatMessage }) {
  return (
    <Message from={message.role} className="max-w-full gap-1.5">
      <MessageContent className="max-w-full break-words text-[0.9375rem] leading-relaxed">
        <MessageResponse className={MARKDOWN_SPACING} isAnimating={false}>
          {message.text}
        </MessageResponse>
      </MessageContent>
      {message.role === "assistant" ? (
        <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyMessageAction text={message.text} />
        </MessageActions>
      ) : null}
    </Message>
  )
}

function CopyMessageAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <MessageAction
      label={copied ? "Copied" : "Copy"}
      tooltip={copied ? "Copied" : "Copy message"}
      variant="ghost"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </MessageAction>
  )
}
