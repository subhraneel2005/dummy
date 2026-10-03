"use client";

import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Send } from "lucide-react";

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

function responsibleLabel(path: string): string {
  const match = /\/([^/]+)\.app\//.exec(path)
  return match?.[1] ?? path
}

function IslandContent({
  state,
  message,
  chatError,
  mediaStream,
  captureCount,
  onSend,
  onMouseDown,
  needsScreenPermission,
  screenPermissionStatus,
  responsibleProcess,
  onGrantScreenPermission,
  onRecheckScreenPermission,
}: {
  state: DictationState;
  message: string;
  chatError: string;
  mediaStream: MediaStream | null;
  captureCount: number;
  onSend: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  needsScreenPermission: boolean;
  screenPermissionStatus: string;
  responsibleProcess: string;
  onGrantScreenPermission: () => void;
  onRecheckScreenPermission: () => void;
}) {
  if (state === "idle" && !chatError && !needsScreenPermission) return null;

  const failure = chatError || message;

  return (
    <DynamicContainer className="flex h-full w-full flex-col bg-background px-2 py-2 backdrop-blur-md">
      {needsScreenPermission && state === "idle" && !chatError ? (
        <div className="flex flex-1 flex-col justify-center gap-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="text-[11px] font-medium">
              Screenshot capture is off
            </span>
            {screenPermissionStatus ? (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[9px] font-medium text-muted-foreground">
                macOS: {screenPermissionStatus}
              </span>
            ) : null}
          </div>
          <p className="line-clamp-4 text-[10px] leading-snug text-muted-foreground">
            In System Settings → Privacy &amp; Security → Screen &amp; System Audio Recording,
            turn on{" "}
            <b>{responsibleProcess ? responsibleLabel(responsibleProcess) : "your terminal"}</b>
            , not Electron — macOS blames whichever app launched dummy. Then fully quit
            and reopen.
          </p>
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              size="sm"
              className="h-5 shrink-0 rounded-full px-2 text-[10px]"
              onClick={onGrantScreenPermission}
            >
              Open Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-5 shrink-0 rounded-full px-2 text-[10px]"
              onClick={onRecheckScreenPermission}
            >
              Re-check
            </Button>
          </div>
        </div>
      ) : null}
      <div
        className="flex h-full min-w-0 flex-1 cursor-grab items-center justify-center active:cursor-grabbing"
        onMouseDown={onMouseDown}
      >
        {state === "listening" && <AudioBars active mediaStream={mediaStream} />}
        {state === "transcribing" && <AudioBars active state="thinking" />}
        {state === "polishing" && <AudioBars active state="thinking" />}
        {captureCount > 0 ? (
          <span className="ml-1.5 flex shrink-0 items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            <ImageIcon className="size-2.5" />
            {captureCount}
          </span>
        ) : null}
        {state === "done" && !chatError && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSend}
            className="h-6 shrink-0 rounded-full px-2 text-[10px]"
          >
            <Send className="size-2.5" />
            Send to chat
          </Button>
        )}
        {failure ? (
          <span className="line-clamp-2 px-1 text-center text-[11px] leading-snug text-destructive">
            {failure}
          </span>
        ) : null}
      </div>
    </DynamicContainer>
  );
}

function Island() {
  const { setSize } = useDynamicIslandSize();
  const { state, text: transcript, message, mediaStream } = useDictation({ pushToTalk: true });
  const settings = useAiSettings();
  const [chatError, setChatError] = useState("");
  const [captureCount, setCaptureCount] = useState(0);
  const [needsScreenPermission, setNeedsScreenPermission] = useState(false);
  const [screenPermissionStatus, setScreenPermissionStatus] = useState("");
  const [responsibleProcess, setResponsibleProcess] = useState("");

  const checkScreenPermission = useCallback(() => {
    void window.electronAPI?.capture
      .permission()
      .then((res) => {
        setNeedsScreenPermission(!res.granted)
        setScreenPermissionStatus(res.status)
        setResponsibleProcess(res.responsible)
      })
      .catch(() => setNeedsScreenPermission(false));
  }, []);

  // Ask on startup. Capture silently doing nothing is far worse than asking.
  useEffect(() => {
    checkScreenPermission();
    const onFocus = () => checkScreenPermission();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkScreenPermission]);

  const settingsOpen = settings.phase !== "closed";

  // Screenshots taken during the current hold. Main announces a count of zero
  // when a hold opens, which is what makes the previous hold's tally go away
  // without the island having to watch for the hold itself.
  useEffect(() => {
    const off = window.electronAPI?.capture.onStaged((event) => {
      setCaptureCount(event.count);
    });
    return () => off?.();
  }, []);

  // A chat window that can't be created or can't load used to fail silently and
  // leave a blank rectangle, so surface it in the island instead.
  useEffect(() => {
    const unsub = window.electronAPI?.chat.onEvent((event) => {
      if (event.type !== "error") return;
      setChatError(event.message || "Chat failed to open.");
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!chatError) return;
    const t = window.setTimeout(() => setChatError(""), 4000);
    return () => window.clearTimeout(t);
  }, [chatError]);

  const grantScreenPermission = useCallback(() => {
    void window.electronAPI?.capture.openSettings();
  }, []);

  const sendToChat = useCallback(() => {
    setChatError("");
    window.electronAPI?.chat.open(transcript);
  }, [transcript]);

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
    } else if (state === "idle") {
      setSize(
        (needsScreenPermission ? "panelPermission" : "empty") as SizePresets,
      );
    } else if (state === "error" || chatError) {
      // The tiny panel can't fit a readable failure message.
      setSize("panelError" as SizePresets);
    } else {
      setSize("panel" as SizePresets);
    }
  }, [setSize, state, settingsOpen, chatError, needsScreenPermission]);

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
      ) : (
        <IslandContent
          state={state}
          message={message}
          chatError={chatError}
          mediaStream={mediaStream}
          captureCount={state === "listening" ? captureCount : 0}
          needsScreenPermission={needsScreenPermission}
          screenPermissionStatus={screenPermissionStatus}
          responsibleProcess={responsibleProcess}
          onGrantScreenPermission={grantScreenPermission}
          onRecheckScreenPermission={checkScreenPermission}
          onSend={sendToChat}
          onMouseDown={startDrag}
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