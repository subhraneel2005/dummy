"use client"

import { useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { ArrowUp, Eraser, X } from "lucide-react"

import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { useChat, type ChatMessage } from "@/hooks/use-chat"

export function ChatPanel({
  hidden = false,
  initialText = "",
  onClose,
}: {
  hidden?: boolean
  initialText?: string
  onClose?: () => void
}) {
  const { messages, streamingText, streaming, error, send, reset } = useChat();
  const [draft, setDraft] = useState(initialText);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const submit = () => {
    const text = draft.trim()
    if (!text || streaming) return
    void send(text)
    setDraft("")
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="text-xs font-semibold text-primary">Chat</span>
        {onClose ? (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label="Close chat"
            className="app-region-no-drag"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg, index) => (
          <ChatRow key={index} message={msg} />
        ))}
        {streamingText ? <ChatRow message={{ role: "assistant", text: streamingText }} /> : null}
        {!messages.length && !streamingText ? (
          <p className="pt-8 text-center text-xs text-muted-foreground">
            {hidden ? "" : "Send a prompt or just start talking."}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="shrink-0 px-3 pb-1 text-[11px] text-destructive">{error}</p>
      ) : null}

      <form
        className="flex shrink-0 items-end gap-1.5 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Send a message…"
          rows={2}
          className="min-h-9 flex-1 resize-none"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={() => void reset()}
          aria-label="Reset conversation"
        >
          <Eraser className="size-3" />
        </Button>
        <Button
          type="submit"
          size="icon-sm"
          disabled={!draft.trim() || streaming}
          aria-label="Send message"
        >
          {streaming ? <Spinner /> : <ArrowUp className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

function ChatRow({ message }: { message: ChatMessage }) {
  return (
    <div
      data-role={message.role}
      className={cn(
        "text-sm leading-relaxed",
        message.role === "user" && "text-muted-foreground"
      )}
    >
      <ReactMarkdown>{message.text}</ReactMarkdown>
    </div>
  )
}
