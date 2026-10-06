"use client";

import { useCallback, useState } from "react";

export type SettingsPhase = "closed" | "loading" | "ready" | "saving" | "error";

export interface AiConfig {
  provider: string | null;
  model: string | null;
  hasKey: boolean;
  encryptionAvailable: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ProviderInfo {
  id: string;
  label: string;
  keyPlaceholder: string;
  docsUrl: string;
}

/** Which destructive data action is in flight, if any. */
export type DataBusy = "all" | "images" | null;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Cheap/fast families, surfaced first so they are easy to pick for dictation. */
const FAST_PATTERNS = [/mini/i, /nano/i, /lite/i, /haiku/i, /-fast/i, /turbo/i];

export function isFastModel(id: string): boolean {
  return FAST_PATTERNS.some((re) => re.test(id));
}

const EMPTY_CONFIG: AiConfig = {
  provider: null,
  model: null,
  hasKey: false,
  encryptionAvailable: true,
};

// `preload` casts the IPC result to `AiConfigResult`, but a cast is a promise
// the renderer cannot enforce: a stale or mismatched main process can hand back
// a payload with no `config` key, and storing that verbatim leaves the panel
// dereferencing `undefined`. Validate at the boundary instead.
function normalizeConfig(value: unknown): AiConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<AiConfig>;
  if (typeof raw.hasKey !== "boolean") return null;
  return {
    provider: typeof raw.provider === "string" && raw.provider ? raw.provider : null,
    model: typeof raw.model === "string" && raw.model ? raw.model : null,
    hasKey: raw.hasKey,
    encryptionAvailable: raw.encryptionAvailable !== false,
  };
}

export function useAiSettings() {
  const [phase, setPhase] = useState<SettingsPhase>("closed");
  const [config, setConfig] = useState<AiConfig>(EMPTY_CONFIG);
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [models, setModels] = useState<Record<string, ModelInfo[]>>({});
  const [message, setMessage] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [liveModels, setLiveModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsNotice, setModelsNotice] = useState("");
  const [dataBusy, setDataBusy] = useState<DataBusy>(null);
  const [dataNote, setDataNote] = useState("");

  // Asks the provider for its real model list. Falls back to the seed catalog
  // already in `models` when the call fails, so the picker is never empty.
  const refreshModels = useCallback(async (provider: string) => {
    const api = window.electronAPI?.ai;
    if (!api || !provider) return;
    setModelsLoading(true);
    try {
      const res = await api.listModels(provider);
      if (res.ok) {
        setLiveModels(res.models ?? []);
        setModelsNotice("");
      } else {
        setLiveModels(res.models ?? []);
        setModelsNotice(res.error ?? "Could not load the live model list.");
      }
    } catch {
      setLiveModels([]);
      setModelsNotice("Could not load the live model list.");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const load = useCallback(() => {
    const api = window.electronAPI?.ai;
    if (!api) return;
    setPhase("loading");
    Promise.all([api.getConfig(), api.getCatalog()])
      .then(([cfg, catalog]) => {
        if (!cfg.ok) {
          setMessage(cfg.error);
          setPhase("error");
          return;
        }
        const next = normalizeConfig(cfg.config);
        if (!next) {
          setMessage("The AI configuration came back in an unexpected shape.");
          setPhase("error");
          return;
        }
        setConfig(next);
        setProviders(catalog.providers ?? {});
        setModels(catalog.models ?? {});
        setKeyDraft("");
        setMessage("");
        setPhase("ready");
        if (next.provider) void refreshModels(next.provider);
      })
      .catch(() => {
        setMessage("Could not read the AI configuration.");
        setPhase("error");
      });
  }, [refreshModels]);

  const close = useCallback(() => {
    setPhase("closed");
    setKeyDraft("");
    setMessage("");
  }, []);

  const apply = useCallback(
    (
      call: Promise<
        { ok: true; config: AiConfig } | { ok: false; error: string }
      >,
      // Re-fetch the live list when the change affects which models exist.
      reloadModels?: boolean,
    ) => {
      setPhase("saving");
      setMessage("");
      call
        .then((res) => {
          if (!res.ok) {
            setMessage(res.error);
            setPhase("error");
            return;
          }
          const next = normalizeConfig(res.config);
          if (!next) {
            setMessage("The AI configuration came back in an unexpected shape.");
            setPhase("error");
            return;
          }
          setConfig(next);
          setKeyDraft("");
          setPhase("ready");
          if (reloadModels && next.provider) void refreshModels(next.provider);
        })
        .catch(() => {
          setMessage("Failed to save the AI configuration.");
          setPhase("error");
        });
    },
    [refreshModels]
  );

  const selectProvider = useCallback(
    (provider: string) => {
      const api = window.electronAPI?.ai;
      if (!api) return;
      setLiveModels([]);
      apply(api.setProvider(provider), true);
    },
    [apply]
  );

  const selectModel = useCallback(
    (model: string) => {
      const api = window.electronAPI?.ai;
      if (!api) return;
      apply(api.setModel(model));
    },
    [apply]
  );

  const saveKey = useCallback(() => {
    const api = window.electronAPI?.ai;
    if (!api || !config.provider) return;
    const key = keyDraft.trim();
    if (!key) return;
    apply(api.setKey(config.provider, key), true);
  }, [apply, config.provider, keyDraft]);

  const clearKey = useCallback(() => {
    const api = window.electronAPI?.ai;
    if (!api || !config.provider) return;
    setLiveModels([]);
    setModelsNotice("");
    apply(api.clearKey(config.provider));
  }, [apply, config.provider]);

  // Both destructive actions end in a reload: this window holds the transcript,
  // sessions list, staged captures and preview blobs in memory, all of which
  // are stale (or pointing at deleted bytes) the moment the wipe commits.
  // `message` carries failures to the page's error banner; `dataNote` carries
  // the success summary into the Data & privacy section while it waits out the
  // 1.2 s reload timer.
  const deleteAllData = useCallback(() => {
    const api = window.electronAPI?.ai;
    if (!api) return;
    setDataBusy("all");
    setMessage("");
    setDataNote("");
    api
      .wipeAllData()
      .then((res) => {
        if (!res.ok) {
          setMessage(res.error);
          return;
        }
        const { counts } = res;
        const total =
          counts.messages +
          counts.sessions +
          counts.attachments +
          counts.toolCalls +
          counts.savedKeys;
        setDataNote(
          `Removed ${total} saved items from this device — ${counts.messages} messages, ${counts.sessions} sessions, ${counts.attachments} images, ${counts.savedKeys} saved keys — and freed ${formatBytes(res.freedBytes)}. Reloading…`,
        );
        window.setTimeout(() => window.location.reload(), 1200);
      })
      .catch(() => {
        setMessage("Failed to delete all data.");
      })
      .finally(() => setDataBusy(null));
  }, []);

  const deleteAllImages = useCallback(() => {
    const api = window.electronAPI?.ai;
    if (!api) return;
    setDataBusy("images");
    setMessage("");
    setDataNote("");
    api
      .deleteAllImages()
      .then((res) => {
        if (!res.ok) {
          setMessage(res.error);
          return;
        }
        const label = res.deleted === 1 ? "image" : "images";
        setDataNote(
          `Deleted ${res.deleted} uploaded ${label} and freed ${formatBytes(res.freedBytes)}. Reloading…`,
        );
        window.setTimeout(() => window.location.reload(), 1200);
      })
      .catch(() => {
        setMessage("Failed to delete images.");
      })
      .finally(() => setDataBusy(null));
  }, []);

  return {
    phase,
    config,
    providers,
    models,
    liveModels,
    modelsLoading,
    modelsNotice,
    message,
    keyDraft,
    setKeyDraft,
    close,
    load,
    selectProvider,
    selectModel,
    saveKey,
    clearKey,
    dataBusy,
    dataNote,
    deleteAllData,
    deleteAllImages,
  };
}
