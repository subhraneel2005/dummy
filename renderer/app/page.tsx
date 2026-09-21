"use client";

import { useCallback, useEffect } from "react";
import { CircleCheck, CircleAlert, ClipboardCheck, Mic, X } from "lucide-react";

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

const HINT: Partial<Record<DictationState, string>> = {
  listening: "Release to transcribe…",
  transcribing: "Transcribing…",
  done: "Copied to clipboard",
};

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      variant={"outline"}
      size={"icon-xs"}
      onClick={onClose}
      className="app-region-no-drag"
      aria-label="Dismiss"
    >
      <X className="size-3" />
    </Button>
  );
}

function IslandContent({
  state,
  transcript,
  message,
  mediaStream,
  onMouseDown,
  onClose,
}: {
  state: DictationState;
  transcript: string;
  message: string;
  mediaStream: MediaStream | null;
  onMouseDown: (e: React.MouseEvent) => void;
  onClose: () => void;
}) {
  if (state === "idle") return null;

  return (
    <DynamicContainer className="flex h-full w-full flex-col bg-background px-4 py-2 backdrop-blur-md">
      <div
        className="flex h-full min-w-0 flex-1 cursor-grab items-center justify-center gap-2 active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        {state === "listening" && <AudioBars active mediaStream={mediaStream} />}
        {state === "transcribing" && <AudioBars active state="thinking" />}
        {state === "done" && (
          <span
            className="flex items-center gap-1.5 text-center text-xs leading-snug text-primary"
          >
            <CircleCheck className="size-3.5 shrink-0 text-green-600" />
            <span className="line-clamp-2">{transcript}</span>
          </span>
        )}
        {state === "error" && (
          <span className="flex min-w-0 items-center gap-1.5 text-center text-xs text-destructive">
            <CircleAlert className="size-3.5 shrink-0" />
            <span className="line-clamp-2">{message}</span>
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-1.5">
        {state === "done" ? <ClipboardCheck className="size-3 text-muted-foreground" /> : null}
        {state === "listening" || state === "transcribing" ? (
          <Mic className="size-3 text-muted-foreground" />
        ) : null}
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {HINT[state]}
        </span>
        <span className="mx-0.5" />
        <CloseButton onClose={onClose} />
      </div>
    </DynamicContainer>
  );
}

function Island() {
  const { setSize } = useDynamicIslandSize();
  const { state, text: transcript, message, mediaStream, reset } = useDictation();

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
    setSize(state === "idle" ? ("empty" as SizePresets) : ("panel" as SizePresets));
  }, [setSize, state]);

  return (
    <DynamicIsland id="audio-bars-island" data-state={state}>
      <IslandContent
        state={state}
        transcript={transcript}
        message={message}
        mediaStream={mediaStream}
        onMouseDown={startDrag}
        onClose={reset}
      />
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