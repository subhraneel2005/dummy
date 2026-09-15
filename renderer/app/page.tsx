"use client";

import { useCallback, useEffect, useState } from "react";

import { AudioBars } from "@/components/audio-bars-demo";
import {
  DynamicIsland,
  DynamicIslandProvider,
  DynamicContainer,
  useDynamicIslandSize,
  type SizePresets,
} from "@/components/ui/dynamic-island";

function IslandContent({ active }: { active: boolean }) {
  return (
    <DynamicContainer className="flex h-full w-full items-center justify-center bg-primary-foreground">
        <AudioBars active={active} />
    </DynamicContainer>
  );
}

function Island() {
  const { setSize } = useDynamicIslandSize();
  const [active, setActive] = useState(false);

  const setActiveState = useCallback(
    (isActive: boolean) => {
      setActive(isActive);
      setSize((isActive ? "medium" : "empty") as SizePresets);
    },
    [setSize],
  );

  // Activation comes ONLY from the global Space+D shortcut (IPC).
  useEffect(() => {
    const unsub = window.electronAPI?.onGlobalShortcut((phase) => {
      setActiveState(phase === "down");
    });
    return unsub;
  }, [setActiveState]);

  // Deactivate when any key of the Space+D chord is released.
  // (main.ts only sends "down" — the globalShortcut fires once on press.)
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "KeyD") setActiveState(false);
    };
    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, [setActiveState]);

  return (
    <DynamicIsland
      id="audio-bars-island"
      className="bg-black/80 backdrop-blur-md"
    >
      <IslandContent active={active} />
    </DynamicIsland>
  );
}

export default function Home() {
  return (
    <DynamicIslandProvider initialSize="empty">
      <main className="app-region-drag flex h-screen w-screen select-none items-center justify-center bg-transparent">
        <div className="app-region-no-drag">
          <Island />
        </div>
      </main>
    </DynamicIslandProvider>
  );
}