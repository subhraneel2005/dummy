"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface OpencodeModel {
  providerID: string;
  providerName: string;
  modelID: string;
  name: string;
  vision: boolean;
}

export type OpencodeServerStatus =
  | { state: "connecting" }
  | { state: "ready"; version: string }
  | { state: "error"; message: string };

export type OpencodePickerPhase =
  | "closed"
  | "connecting"
  | "loading"
  | "ready"
  | "saving"
  | "done"
  | "error";

const DONE_HIDE_MS = 1800;

export function useOpencode() {
  const [phase, setPhase] = useState<OpencodePickerPhase>("closed");
  const [models, setModels] = useState<OpencodeModel[]>([]);
  const [selected, setSelected] = useState<OpencodeModel | null>(null);
  const [message, setMessage] = useState("");

  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearHideTimer();
    setPhase("closed");
  }, [clearHideTimer]);

  const open = useCallback(() => {
    clearHideTimer();
    setMessage("");
    setPhase("connecting");

    window.electronAPI?.opencode
      .listModels()
      .then((res) => {
        if (!res.ok) {
          setMessage(res.error);
          setPhase("error");
          return;
        }
        setModels(res.models);
        setPhase("ready");
      })
      .catch(() => {
        setMessage("Failed to reach the OpenCode server.");
        setPhase("error");
      });
  }, [clearHideTimer]);

  const select = useCallback(
    (model: OpencodeModel) => {
      setPhase("saving");
      setMessage("");
      window.electronAPI?.opencode
        .setModel(model)
        .then(() => {
          setSelected(model);
          setPhase("done");
          hideTimerRef.current = window.setTimeout(close, DONE_HIDE_MS);
        })
        .catch(() => {
          setMessage("Failed to save the selected model.");
          setPhase("error");
        });
    },
    [close]
  );

  useEffect(() => {
    const unsubPicker = window.electronAPI?.opencode.onOpenPicker(() => open());
    return () => {
      unsubPicker?.();
    };
  }, [open]);

  useEffect(() => {
    window.electronAPI?.opencode
      .getModel()
      .then((res) => {
        if (res.ok) setSelected(res.model);
      })
      .catch(() => {
        // Ignore; the picker still works without a prior selection.
      });
  }, []);

  useEffect(() => {
    return clearHideTimer;
  }, [clearHideTimer]);

  return {
    phase,
    models,
    selected,
    message,
    open,
    close,
    select,
  };
}