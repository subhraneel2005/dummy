"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";

import { AudioBars } from "@/components/audio-bars-demo";
import {
  DynamicIsland,
  DynamicIslandProvider,
  DynamicContainer,
  useDynamicIslandSize,
  type SizePresets,
} from "@/components/ui/dynamic-island";
import { Button } from "@/components/ui/button";
import { useDictation, type DictationState } from "@/hooks/use-dictation";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { SettingsPanel } from "@/components/settings-panel";
import { ChatPanel } from "@/components/chat-panel";

function IslandContent({
  state,
  transcript,
  message,
  mediaStream,
  onMouseDown,
  onOpenChat,
}: {
  state: DictationState;
  transcript: string;
  message: string;
  mediaStream: MediaStream | null;
  onMouseDown: (e: React.MouseEvent) => void;
  onOpenChat: (initialText: string) => void;
}) {
  if (state === "idle") return null;

  return (
    <DynamicContainer className="flex h-full w-full flex-col bg-background px-2 py-2 backdrop-blur-md">
      <div
        className="flex h-full min-w-0 flex-1 cursor-grab items-center justify-center active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        {state === "listening" && <AudioBars active mediaStream={mediaStream} />}
        {state === "transcribing" && <AudioBars active state="thinking" />}
        {state === "polishing" && <AudioBars active state="thinking" />}
        {state === "done" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChat(transcript)}
            className="h-6 shrink-0 rounded-full px-2 text-[10px]"
          >
            <Send className="size-2.5" />
            Send to chat
          </Button>
        )}
        {state === "error" ? (
          <span className="line-clamp-2 px-1 text-center text-[11px] leading-snug text-destructive">
            {message}
          </span>
        ) : null}
      </div>
    </DynamicContainer>
  );
}

function Island() {
  const { setSize } = useDynamicIslandSize();
  const { state, text: transcript, message, mediaStream } = useDictation();
  const settings = useAiSettings();

  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const settingsOpen = settings.phase !== "closed";

  // ChatPanel lives inside the same island; opening it swaps the island size
  // to the "chat" preset and renders the conversation in its place.

  const startDrag = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const move = () => window.electronAPI?.window.moveDrag();
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.electronAPI?.window.endDrag();
    };
    window.electronAPI?.window.startDrag();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, []);

  // Toggle click-through on Windows based on whether the cursor is over the
  // island (macOS passes through transparent areas natively).
  useEffect(() => {
    if (window.electronAPI?.platform === "darwin") return;
    let ignoring = true;
    const onMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const overIsland = !!el?.closest("#audio-bars-island");
      const next = !overIsland;
      if (next !== ignoring) {
        ignoring = next;
        window.electronAPI?.window.setIgnoreMouseEvents(next);
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  // Keep the native window sized to the island so there's no oversized
  // transparent area to block clicks/scroll on the screen behind.
  useEffect(() => {
    const el = document.getElementById("audio-bars-island");
    if (!el) return;
    let lastW = -1;
    let lastH = -1;
    const report = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      window.electronAPI?.window.setIslandSize(w, h);
    };
    const observer = new ResizeObserver(report);
    observer.observe(el);
    report();
    return () => observer.disconnect();
  }, []);

  // Ready handshake on mount, then keep the window hidden when idle.
  useEffect(() => {
    window.electronAPI?.ready();
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      setSize("settings" as SizePresets);
    } else if (chatOpen) {
      setSize("chat" as SizePresets);
    } else if (state === "idle") {
      setSize("empty" as SizePresets);
    } else if (state === "error") {
      // The tiny panel can't fit a readable failure message.
      setSize("panelError" as SizePresets);
    } else {
      setSize("panel" as SizePresets);
    }
  }, [setSize, state, settingsOpen, chatOpen]);

  return (
    <DynamicIsland id="audio-bars-island" data-state={state}>
      {settingsOpen ? (
        <SettingsPanel
          phase={settings.phase}
          config={settings.config}
          providers={settings.providers}
          models={settings.models}
          liveModels={settings.liveModels}
          modelsLoading={settings.modelsLoading}
          modelsNotice={settings.modelsNotice}
          message={settings.message}
          keyDraft={settings.keyDraft}
          onKeyDraftChange={settings.setKeyDraft}
          onClose={settings.close}
          onSelectProvider={settings.selectProvider}
          onSelectModel={settings.selectModel}
          onSaveKey={settings.saveKey}
          onClearKey={settings.clearKey}
        />
      ) : chatOpen ? (
        <ChatPanel
          initialText={chatDraft}
          onClose={() => setChatOpen(false)}
        />
      ) : (
        <IslandContent
          state={state}
          transcript={transcript}
          message={message}
          mediaStream={mediaStream}
          onMouseDown={startDrag}
          onOpenChat={(initialText) => {
            setChatDraft(initialText);
            setChatOpen(true);
          }}
        />
      )}
    </DynamicIsland>
  );
}

export default function Home() {
  return (
    <DynamicIslandProvider initialSize="empty">
      <main className="flex h-screen w-screen select-none items-center justify-center bg-transparent">
        <div>
          <Island />
        </div>
      </main>
    </DynamicIslandProvider>
  );
}