"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { blobToMono16kWav } from "@/lib/wav";

export type DictationState = "idle" | "listening" | "transcribing" | "polishing" | "done" | "error";

export interface DictationStatus {
  state: "transcribing" | "polishing" | "done" | "error";
  text?: string;
  message?: string;
}

const MAX_RECORD_MS = 60_000;
// Long enough to read the result and click "Send to chat" before it vanishes.
const DONE_HIDE_MS = 5000;
const ERROR_HIDE_MS = 3200;

export function useDictation() {
  const [state, setState] = useState<DictationState>("idle");
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const listeningRef = useRef(false);
  const startedAtRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const finalizingRef = useRef(false);
  const capTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearCapTimer = useCallback(() => {
    if (capTimerRef.current !== null) {
      window.clearTimeout(capTimerRef.current);
      capTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMediaStream(null);
  }, []);

  const resetToIdle = useCallback(() => {
    clearCapTimer();
    clearHideTimer();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
    chunksRef.current = [];
    listeningRef.current = false;
    finalizingRef.current = false;
    stopTracks();
    setText("");
    setMessage("");
    setState("idle");
  }, [clearCapTimer, clearHideTimer, stopTracks]);

  const finalize = useCallback(
    async (blob: Blob) => {
      clearCapTimer();
      listeningRef.current = false;
      stopTracks();
      chunksRef.current = [];
      recorderRef.current = null;

      if (blob.size === 0) {
        setMessage("Nothing heard — try again.");
        setState("error");
        return;
      }

      setState("transcribing");
      try {
        const wav = await blobToMono16kWav(blob);
        window.electronAPI?.dictation.sendAudio(wav);
      } catch {
        setMessage("Failed to process audio.");
        setState("error");
      }
    },
    [clearCapTimer, setMessage, setState, stopTracks]
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else if (listeningRef.current) {
      // Recording hasn't started yet (getUserMedia in flight); make sure that
      // once it resolves, start() aborts rather than recording until timeout.
      stopRequestedRef.current = true;
    }
  }, []);

  const start = useCallback(() => {
    (async () => {
      if (listeningRef.current) {
        // A second press while holding acts as "finish now" — a fallback in
        // case the OS swallows the key-up event of the global shortcut. Only
        // treat a re-press as a finish once the user has held long enough to
        // avoid OS auto-repeat chatter triggering it.
        if (Date.now() - startedAtRef.current >= 500) {
          stop();
        }
        return;
      }

      clearCapTimer();
      clearHideTimer();
      listeningRef.current = true;
      startedAtRef.current = Date.now();
      finalizingRef.current = false;
      stopRequestedRef.current = false;
      chunksRef.current = [];
      setText("");
      setMessage("");
      setState("listening");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (stopRequestedRef.current || !listeningRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          stopRequestedRef.current = false;
          listeningRef.current = false;
          setState("idle");
          return;
        }

        streamRef.current = stream;
        setMediaStream(stream);

        const mimeTypes = ["audio/webm;codecs=opus", "audio/webm"];
        let mimeType = "";
        for (const m of mimeTypes) {
          if (window.MediaRecorder.isTypeSupported(m)) {
            mimeType = m;
            break;
          }
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          if (finalizingRef.current) return;
          if (recorderRef.current !== recorder) return;
          finalizingRef.current = true;
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          void finalize(blob);
        };
        recorder.start();

        capTimerRef.current = window.setTimeout(() => stop(), MAX_RECORD_MS);
      } catch {
        setMessage("Microphone access denied.");
        setState("error");
      }
    })();
  }, [clearCapTimer, clearHideTimer, finalize, setMessage, setState, stop]);

  useEffect(() => {
    const unsub = window.electronAPI?.dictation.onStatus((status: DictationStatus) => {
      if (status.state === "polishing") {
        setState("polishing");
      } else if (status.state === "done") {
        setMessage("");
        setText(status.text ?? "");
        setState("done");
      } else if (status.state === "error") {
        setText("");
        setMessage(status.message ?? "Transcription failed.");
        setState("error");
      }
    });
    return () => unsub?.();
  }, []);

  // Both terminal states auto-hide back to idle. The island no longer has a
  // close button, so without this the done/error island would stay on screen
  // forever with no way to dismiss it.
  useEffect(() => {
    clearHideTimer();
    if (state === "done") {
      hideTimerRef.current = window.setTimeout(resetToIdle, DONE_HIDE_MS);
    } else if (state === "error") {
      hideTimerRef.current = window.setTimeout(resetToIdle, ERROR_HIDE_MS);
    }
    return clearHideTimer;
  }, [clearHideTimer, resetToIdle, state]);

  useEffect(() => {
    const unsub = window.electronAPI?.onGlobalShortcut((phase) => {
      if (phase === "down") start();
      else stop();
    });
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "d" || event.key === "D" || event.key === "Alt" || event.key === "Option") {
        stop();
      }
    };
    window.addEventListener("keyup", onKeyUp);
    return () => {
      unsub?.();
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [start, stop]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        finalizingRef.current = true;
        recorder.stop();
      }
      clearCapTimer();
      clearHideTimer();
      stopTracks();
    };
  }, [clearCapTimer, clearHideTimer, stopTracks]);

  return { state, text, message, mediaStream, reset: resetToIdle };
}