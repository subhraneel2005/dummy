"use client";

/**
 * @author: @kokonutui
 * @description: AI Voice
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Modified: the self-playing `isDemo` loop is gone. The component is now fully
 * controlled — capture state, elapsed time and the stop action all come from
 * the caller's dictation state — so the chat composer can drop the same UI on
 * top of a real recording session. The `black`/`white` utility colours are also
 * now `foreground`/`muted-foreground` tokens, which render identically in this
 * app's two themes but stop hard-coding an assumption about which one is active.
 */

import { Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Deterministic per-bar height for the decorative waveform.
 *
 * `Math.random()` in a render body is impure (and re-jitters every bar on every
 * re-render, so the waveform visibly churns while recording). This is a stable
 * hash of the bar index instead: still organic-looking, but pure and identical
 * on the server and the client.
 */
function barHeight(index: number): number {
  const n = Math.sin(index * 12.9898) * 43758.5453;
  return 20 + (n - Math.floor(n)) * 80;
}

export interface AIVoiceProps {
  /** True while the microphone is capturing. Drives the spinner, timer and waveform. */
  active?: boolean;
  /** Caption under the waveform, e.g. "Listening…", "Transcribing…". */
  status?: string;
  /** Announced politely to assistive tech as the state changes. */
  liveStatus?: string;
  /** Called when the button is pressed while capturing. Omit to render a read-only state. */
  onStop?: () => void;
  className?: string;
}

export default function AIVoice({
  active = false,
  status,
  liveStatus,
  onStop,
  className,
}: AIVoiceProps) {
  const [time, setTime] = useState(0);
  const [counting, setCounting] = useState(active);

  // Reset the readout when capture stops. Done during render rather than in an
  // effect body, because a synchronous setState inside an effect cascades an
  // extra render pass. No visual change: the same 00:00 shows either way.
  if (counting !== active) {
    setCounting(active);
    if (!active) setTime(0);
  }

  useEffect(() => {
    if (!active) return;
    const intervalId = setInterval(() => {
      setTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [active]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const caption = status ?? (active ? "Listening..." : "Working...");

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center gap-2">
        <button
          className={cn(
            "group flex h-16 w-16 items-center justify-center rounded-xl transition-colors",
            !onStop && "cursor-default",
            active
              ? "bg-none"
              : "bg-none hover:bg-black/5 dark:hover:bg-white/5"
          )}
          // While capture is running this is the stop control. Once the audio
          // is captured there is nothing left to stop, so it is disabled rather
          // than left as a button that silently does nothing.
          onClick={active && onStop ? onStop : undefined}
          disabled={!active || !onStop}
          aria-label={active ? "Stop dictation" : "Dictation in progress"}
          type="button"
        >
          {active ? (
            <div
              className="pointer-events-auto h-6 w-6 motion-safe:animate-spin cursor-pointer rounded-sm bg-foreground"
              style={{ animationDuration: "3s" }}
            />
          ) : (
            <Mic className="h-6 w-6 text-foreground/90" />
          )}
        </button>

        <span
          className={cn(
            "font-mono text-sm transition-opacity duration-300",
            active
              ? "text-foreground/70"
              : "text-foreground/30"
          )}
        >
          {formatTime(time)}
        </span>

        <div
          className="flex h-4 w-64 items-center justify-center gap-0.5"
          aria-hidden="true"
        >
          {[...Array(48)].map((_, i) => (
            <div
              className={cn(
                "w-0.5 rounded-full transition-all duration-300",
                active
                  ? "motion-safe:animate-pulse bg-foreground/50"
                  : "h-1 bg-foreground/10"
              )}
              key={i}
              style={
                active
                  ? {
                      height: `${barHeight(i)}%`,
                      animationDelay: `${i * 0.05}s`,
                    }
                  : undefined
              }
            />
          ))}
        </div>

        <p className="h-4 text-xs text-foreground/70">
          {caption}
          {/* Status changes are announced without stealing focus. */}
          <span className="sr-only" role="status" aria-live="polite">
            {liveStatus ?? caption}
          </span>
        </p>
      </div>
    </div>
  );
}
