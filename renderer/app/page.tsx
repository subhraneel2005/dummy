"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare, Send, X } from "lucide-react";

import { AudioBars } from "@/components/audio-bars-demo";
import {
  DynamicIsland,
  DynamicIslandProvider,
  DynamicContainer,
  useDynamicIslandSize,
  type SizePresets,
} from "@/components/ui/dynamic-island";
import { Button } from "@/components/ui/button";

function CloseButton() {
  return (
    <Button
      variant={"outline"}
      size={"icon-xs"}
      onClick={() => window.electronAPI?.window.close()}
      className="app-region-no-drag"
      aria-label="Close window"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

function IslandContent({
  open,
  onMouseDown,
}: {
  open: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <DynamicContainer className="flex h-full w-full flex-col bg-background px-4 py-2 backdrop-blur-md">
      <div
        className="flex h-full min-w-0 flex-1 cursor-grab items-center justify-center active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        <AudioBars active={open} />
      </div>
      <div className="flex shrink-0 items-center justify-center gap-1.5">
      <CloseButton />
        <Button
          variant="outline"
          size="xs"
          type="button"
          className="app-region-no-drag gap-1"
        >
          <MessagesSquare className="size-3" />
          Open chat
        </Button>
        <Button
          variant="default"
          size="xs"
          type="button"
          className="app-region-no-drag gap-1"
        >
          <Send className="size-3" />
          Send to chat
        </Button>
      </div>
    </DynamicContainer>
  );
}

function Island() {
  const { setSize } = useDynamicIslandSize();
  const [open, setOpen] = useState(false);

  const openPanel = useCallback(() => {
    setOpen(true);
    setSize("panel" as SizePresets);
  }, [setSize]);

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

  // Global Alt+D opens the panel; it stays open until closed via the X button.
  useEffect(() => {
    window.electronAPI?.ready();
    const unsub = window.electronAPI?.onGlobalShortcut((phase) => {
      if (phase === "down") openPanel();
    });
    return unsub;
  }, [openPanel]);

  // On Windows the transparent window captures input, so toggle click-through
  // based on whether the cursor is over the island. macOS passes input through
  // transparent areas natively, so leave it alone there.
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

  return (
    <DynamicIsland id="audio-bars-island">
      <IslandContent open={open} onMouseDown={startDrag} />
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