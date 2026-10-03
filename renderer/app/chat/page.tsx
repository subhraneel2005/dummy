"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckIcon, CopyIcon, MicIcon, PlusIcon } from "lucide-react"

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
import AIVoice from "@/components/kokonutui/ai-voice"
import { ProviderIcon, providerLabel } from "@/components/provider-icon"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  useAttachmentSrc,
  useChat,
  type ChatAttachmentUpload,
  type ChatAttachmentView,
  type ChatMessage,
} from "@/hooks/use-chat"
import { useDictation } from "@/hooks/use-dictation"
import { cn } from "@/lib/utils"

/**
 * A transcript handed over by main when dictation ends. Declared locally rather
 * than shared, matching how the rest of this tree treats bridge types.
 */
type ChatSeed = { text: string | null; holdId: string | null }

/** What `capture.consume` returns. Only the bytes matter to the composer. */
type StagedCapture = { mediaType: string; fileName: string; dataBase64: string }

/**
 * Streamdown ships its vertical rhythm as `space-y-4` plus `my-4` on the code
 * wrapper, but those class names only exist inside `node_modules`, which
 * Tailwind never scans. The result: the classes land in the DOM with no CSS
 * behind them, so prose and code ended up flush at 16px. This restates the
 * rhythm in app source (where it does get compiled) and zeroes the inherited
 * margins so the spacing is deliberate rather than whatever collapses last.
 */
const MARKDOWN_SPACING = "[&>*]:!my-0 [&>*+*]:!mt-6"

/**
 * Lists need their own rules, and they cannot come from the block rhythm above.
 *
 * Tailwind's preflight resets `ol, ul, menu` to `list-style: none; margin: 0;
 * padding: 0`, and Streamdown contributes no list styling of its own, so a
 * bulleted answer arrived with no marker indent and no breathing room inside —
 * visibly out of step with the paragraphs around it. `my-0` in
 * {@link MARKDOWN_SPACING} also strips the list's own block margin, so the
 * indent and item spacing are stated explicitly here.
 */
const MARKDOWN_LISTS = [
  "[&_ul]:list-disc [&_ol]:list-decimal",
  "[&_ul]:!pl-6 [&_ol]:!pl-6",
  "[&_li]:!my-0 [&_li+li]:!mt-1.5",
  "[&_li]:marker:text-muted-foreground",
  // Nested lists sit tight under their parent item, indented a step further.
  "[&_li>ul]:!mt-1.5 [&_li>ol]:!mt-1.5",
  "[&_li>ul]:!pl-5 [&_li>ol]:!pl-5",
].join(" ")

/** Shared measure for the transcript, the hero and the composer. */
const CHAT_COLUMN = "mx-auto w-full max-w-3xl"

// Filled bubbles rather than bare text. The prompt is the action, so it gets the
// `primary` surface; the reply gets the quieter `secondary` one.
//
// The foreground is not symmetric, and that is deliberate. `text-primary-
// foreground` is right on the prompt (6.3:1 light, 8.1:1 dark against
// `--primary`), but it is unusable on the reply: light-mode `--secondary` is
// oklch(0.967 …) and `--primary-foreground` is oklch(0.97 …), so the pairing
// lands at 1.01:1 — white text on a near-white card. The reply therefore uses
// `--secondary-foreground`, the token designed to sit on `--secondary`
// (16.1:1 light, 14.3:1 dark).
const USER_BUBBLE =
  "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
const ASSISTANT_BUBBLE =
  "group-[.is-assistant]:rounded-lg group-[.is-assistant]:bg-secondary group-[.is-assistant]:px-4 group-[.is-assistant]:py-3 group-[.is-assistant]:text-secondary-foreground"

export default function ChatWindowPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const { messages, streamingText, sending, error, send, clearLocal } = useChat(activeId)
  const [job, setJob] = useState<{ id: number; text: string } | null>(null)
  const jobIdRef = useRef(0)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [config, setConfig] = useState<{ provider: string | null; model: string | null }>({
    provider: null,
    model: null,
  })

  // Same STT + polish pipeline the dictation island uses (whisper.cpp, then the
  // technical-spelling pass), driven from a mic button instead of Alt+D. The
  // polished transcript lands in the draft so it can be read before sending.
  const {
    state: voiceState,
    text: voiceText,
    message: voiceError,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
  } = useDictation()
  const voiceBusy =
    voiceState === "listening" ||
    voiceState === "transcribing" ||
    voiceState === "polishing"
  const voiceListening = voiceState === "listening"

  const toggleVoice = useCallback(() => {
    if (voiceState === "listening") stopVoice()
    else if (!voiceBusy) startVoice()
  }, [startVoice, stopVoice, voiceBusy, voiceState])

  // The finished transcript is an event, not derived state, so it is consumed
  // during render (React's documented pattern for "a prop changed, adjust
  // state") instead of being synced from an effect, which costs an extra render
  // pass and trips the set-state-in-effect rule. `consumedTranscript` keeps the
  // same result from being appended twice, and clears on the next recording so
  // dictating identical words twice in a row still works.
  const [consumedTranscript, setConsumedTranscript] = useState("")
  if (voiceListening && consumedTranscript) setConsumedTranscript("")
  if (voiceState === "done" && voiceText && voiceText !== consumedTranscript) {
    setConsumedTranscript(voiceText)
    setDraft((prev) => (prev.trim() ? `${prev.trimEnd()} ${voiceText}` : voiceText))
  }

  // The hook holds a finished transcript on screen for a few seconds. Drop it as
  // soon as it has been consumed so the voice panel closes and the composer
  // returns to its resting height.
  useEffect(() => {
    if (voiceState === "done") resetVoice()
  }, [resetVoice, voiceState])

  // Enter-to-send is handled by the textarea's own keydown, so it only fires
  // while the textarea holds focus. Stopping dictation moves focus to the voice
  // panel's stop button, and that panel unmounts as soon as the session
  // settles, which drops focus to <body> and leaves Enter doing nothing. Hand
  // focus back the moment a session finishes — however it finished, so an
  // error or a dropped recording behaves the same as a good one.
  const voiceSessionRef = useRef(false)
  useEffect(() => {
    if (voiceBusy) {
      voiceSessionRef.current = true
      return
    }
    if (!voiceSessionRef.current) return
    voiceSessionRef.current = false
    inputRef.current?.focus()
  }, [voiceBusy])

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

  /**
   * Screenshots waiting to be dropped into the composer.
   *
   * A hold that captured something stages instead of auto-sending: the whole
   * point of reviewing a screenshot before it reaches the model is that you get
   * to decide it. A hold that captured nothing keeps the old auto-send, so
   * plain dictation is unchanged.
   */
  const [staged, setStaged] = useState<StagedCapture[]>([])

  const applySeed = useCallback(
    (seed: ChatSeed) => {
      if (seed.holdId) {
        if (seed.text) setDraft(seed.text)
        void window.electronAPI?.capture.consume(seed.holdId).then((captures) => {
          if (captures.length > 0) setStaged(captures)
        })
        return
      }
      if (seed.text) enqueue(seed.text)
    },
    [enqueue]
  )

  // `takeInitialText` is non-destructive: main keeps the seed until we ack it,
  // so an effect torn down mid-flight (HMR, reload) can't lose it.
  useEffect(() => {
    let cancelled = false
    void window.electronAPI?.chat
      .takeInitialText()
      .then((seed) => {
        if (cancelled || !seed) return
        applySeed(seed)
        void window.electronAPI?.chat.ackInitialText()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [applySeed])

  useEffect(() => {
    return window.electronAPI?.chat.onInitialText((seed) => applySeed(seed))
  }, [applySeed])

  /** Sends into `activeId`, minting an id when this is a brand-new thread. */
  const dispatch = useCallback(
    async (text: string, uploads: readonly ChatAttachmentUpload[] = []) => {
      const trimmed = text.trim()
      // Images with no caption are a valid message; nothing at all is not.
      if ((!trimmed && uploads.length === 0) || sending) return
      const target = activeId ?? crypto.randomUUID()
      if (!activeId) setActiveId(target)
      // `send` appends the prompt to the transcript, so the box can be emptied
      // immediately instead of holding a stale copy that Enter would resend.
      setDraft("")
      await send(trimmed, target, uploads)
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
    // Auto-sent dictation never carries screenshots — a hold with captures
    // stages for review instead, so `uploads` is always empty on this path.
    void dispatch(job.text)
  }, [job, dispatch])

  /**
   * `PromptInput` strips each part's `id` when it converts blob URLs to data
   * URLs before calling this, so a fresh correlation id is minted here. It only
   * has to be unique within the message being sent.
   */
  const submit = useCallback(
    async ({ text, files }: PromptInputMessage) => {
      const uploads: ChatAttachmentUpload[] = []
      for (const part of files ?? []) {
        // Data URLs are what the component hands over; a blob URL that failed to
        // convert cannot be sent, so it is dropped rather than sent as garbage.
        const comma = part.url?.indexOf(",") ?? -1
        const dataBase64 = comma >= 0 ? part.url.slice(comma + 1) : ""
        if (!dataBase64) continue
        uploads.push({
          id: crypto.randomUUID().replace(/-/g, ""),
          mediaType: part.mediaType,
          fileName: part.filename || "image.png",
          dataBase64,
        })
      }
      await dispatch(text, uploads)
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
                  <h1 className="text-4xl font-bold tracking-tighter text-balance">
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
                  <MessageContent
                    className={cn("max-w-full", ASSISTANT_BUBBLE)}
                    aria-live="polite"
                  >
                    <MessageResponse className={cn(MARKDOWN_SPACING, MARKDOWN_LISTS)} isAnimating>
                      {streamingText}
                    </MessageResponse>
                  </MessageContent>
                </Message>
              ) : null}

              {showThinking ? (
                <Message from="assistant" className="max-w-full">
                  <MessageContent className={cn("max-w-full", ASSISTANT_BUBBLE)}>
                    <p className="text-sm motion-safe:animate-pulse">Thinking</p>
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
            <ComposerHeader
              voiceActive={voiceBusy}
              voiceListening={voiceListening}
              voiceError={voiceState === "error" ? voiceError : ""}
              onStopVoice={stopVoice}
            />
            <StagedCaptureInbox captures={staged} onConsumed={() => setStaged([])} />
            <PromptInputTextarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              placeholder="Send a message, or tap the mic to dictate…"
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
                <VoiceButton
                  listening={voiceListening}
                  busy={voiceBusy}
                  onToggle={toggleVoice}
                />
              </PromptInputTools>
              <ComposerSubmit thinking={showThinking} sending={sending} hasText={Boolean(draft.trim())} />
            </PromptInputFooter>
          </PromptInput>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}

function VoiceButton({
  listening,
  busy,
  onToggle,
}: {
  listening: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <PromptInputButton
      variant="ghost"
      tooltip={listening ? "Stop dictation" : busy ? "Working…" : "Dictate message"}
      aria-label={listening ? "Stop dictation" : "Dictate message"}
      aria-pressed={listening}
      // Busy means the audio is already captured and is being transcribed, so
      // there is nothing left to toggle.
      disabled={busy && !listening}
      onClick={onToggle}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        listening && "text-destructive hover:text-destructive"
      )}
    >
      <MicIcon className={cn(listening && "motion-safe:animate-pulse")} />
    </PromptInputButton>
  )
}

/**
 * The composer's top strip. It is an `InputGroupAddon`, so it is only mounted
 * when it has something to show: rendering it unconditionally would leave a
 * permanently empty row (padding plus a group gap) in the box.
 */
function ComposerHeader({
  voiceActive,
  voiceListening,
  voiceError,
  onStopVoice,
}: {
  voiceActive: boolean
  voiceListening: boolean
  voiceError: string
  onStopVoice: () => void
}) {
  const attachments = usePromptInputAttachments()
  const hasFiles = attachments.files.length > 0
  if (!voiceActive && !voiceError && !hasFiles) return null

  return (
    <PromptInputHeader>
      {voiceActive ? (
        <AIVoice
          // The spinning capture indicator only makes sense while the mic is
          // actually open; transcribing and polishing keep the panel visible
          // but idle, with the stage named in the caption.
          active={voiceListening}
          status={
            voiceListening
              ? "Listening..."
              : voiceError
                ? "Something went wrong"
                : "Transcribing..."
          }
          onStop={voiceListening ? onStopVoice : undefined}
        />
      ) : null}

      {voiceError ? (
        <p
          role="alert"
          className="px-1 py-1.5 text-sm leading-relaxed text-destructive"
        >
          {voiceError}
        </p>
      ) : null}

      {hasFiles ? <PromptAttachments /> : null}
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

/**
 * Moves screenshots staged in main into the composer.
 *
 * They arrive as base64 over IPC, so they are rebuilt as `File`s and handed to
 * the same `add()` the file picker uses — staged captures and picked images then
 * share one preview, one remove control and one submit path. There is no
 * second-class screenshot type anywhere downstream.
 *
 * Renders nothing; it exists only to live inside `PromptInput`'s attachment
 * context.
 */
function StagedCaptureInbox({
  captures,
  onConsumed,
}: {
  captures: StagedCapture[]
  onConsumed: () => void
}) {
  const { add } = usePromptInputAttachments()
  // Effects run twice in development StrictMode, and adding the same batch twice
  // would duplicate every attachment, so the batch is keyed and remembered.
  const addedKey = useRef("")

  useEffect(() => {
    const key = captures.map((capture) => capture.fileName).join("|")
    if (!key || key === addedKey.current) return
    addedKey.current = key
    add(
      captures.map(
        (capture) =>
          new File([base64ToBytes(capture.dataBase64)], capture.fileName, {
            type: capture.mediaType,
          })
      )
    )
    onConsumed()
  }, [captures, add, onConsumed])

  return null
}

/**
 * The send button lives inside `PromptInput` so it can see the attachment
 * context — without that, a message of nothing but screenshots would have no
 * enabled way out of the composer.
 */
function ComposerSubmit({
  thinking,
  sending,
  hasText,
}: {
  thinking: boolean
  sending: boolean
  hasText: boolean
}) {
  const { files } = usePromptInputAttachments()
  return (
    <PromptInputSubmit
      status={thinking ? "submitted" : "ready"}
      disabled={sending || (!hasText && files.length === 0)}
    />
  )
}

/** `Uint8Array<ArrayBuffer>` rather than the default `ArrayBufferLike`, which `Blob` rejects. */
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
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
  const hasText = message.text.trim().length > 0
  const { attachments } = message
  return (
    <Message from={message.role} className="max-w-full gap-1.5">
      <MessageContent
        className={cn(
          "max-w-full break-words text-[0.9375rem] leading-relaxed",
          message.role === "user" ? USER_BUBBLE : ASSISTANT_BUBBLE
        )}
      >
        {attachments.length > 0 ? (
          <div className={cn("flex flex-wrap gap-2", hasText && "mb-2")}>
            {attachments.map((attachment) => (
              <MessageThumbnail key={attachment.id} attachment={attachment} />
            ))}
          </div>
        ) : null}
        {hasText ? (
          <MessageResponse className={cn(MARKDOWN_SPACING, MARKDOWN_LISTS)} isAnimating={false}>
            {message.text}
          </MessageResponse>
        ) : null}
      </MessageContent>
      {message.role === "assistant" ? (
        <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyMessageAction text={message.text} />
        </MessageActions>
      ) : null}
    </Message>
  )
}

/**
 * A sent screenshot. History carries metadata only, so the bytes are fetched
 * on demand — a conversation with a dozen screenshots would otherwise ship
 * megabytes to draw 200px previews. Just-sent attachments already hold their
 * own data URL and never hit the bridge.
 */
function MessageThumbnail({ attachment }: { attachment: ChatAttachmentView }) {
  const src = useAttachmentSrc(attachment)
  if (!src) {
    return <div className="h-32 w-48 animate-pulse rounded-md bg-black/10" aria-hidden="true" />
  }
  return (
    // Data URLs from the bridge have no filesystem path and no intrinsic size
    // for the image optimizer to work from, so next/image cannot be used here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={attachment.fileName || "Screenshot"}
      className="h-auto max-h-64 rounded-md border border-black/10 object-contain"
      loading="lazy"
    />
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
