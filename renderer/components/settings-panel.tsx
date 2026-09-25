"use client";

import { useMemo } from "react";
import { CircleAlert, CircleCheck, ExternalLink, KeyRound, X } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isFastModel, type AiConfig, type ModelInfo, type ProviderInfo, type SettingsPhase } from "@/hooks/use-ai-settings";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function SettingsPanel({
  phase,
  config,
  providers,
  models,
  liveModels,
  modelsLoading,
  modelsNotice,
  message,
  keyDraft,
  onKeyDraftChange,
  onClose,
  onSelectProvider,
  onSelectModel,
  onSaveKey,
  onClearKey,
}: {
  phase: SettingsPhase;
  config: AiConfig;
  providers: Record<string, ProviderInfo>;
  models: Record<string, ModelInfo[]>;
  liveModels: ModelInfo[];
  modelsLoading: boolean;
  modelsNotice: string;
  message: string;
  keyDraft: string;
  onKeyDraftChange: (value: string) => void;
  onClose: () => void;
  onSelectProvider: (provider: string) => void;
  onSelectModel: (model: string) => void;
  onSaveKey: () => void;
  onClearKey: () => void;
}) {
  const busy = phase === "loading" || phase === "saving";

  const providerOptions = useMemo(
    () => Object.values(providers).sort((a, b) => a.label.localeCompare(b.label)),
    [providers]
  );

  // Live ids from the provider when available, otherwise the offline seed.
  // Grouped so the cheap/fast models (best for dictation polish) are first.
  const { fastModels, otherModels } = useMemo(() => {
    const source = liveModels.length > 0 ? liveModels : (config.provider ? models[config.provider] ?? [] : []);
    const fast: ModelInfo[] = [];
    const other: ModelInfo[] = [];
    for (const model of source) {
      if (isFastModel(model.id)) fast.push(model);
      else other.push(model);
    }
    return { fastModels: fast, otherModels: other };
  }, [liveModels, models, config.provider]);

  const activeProvider = config.provider ? providers[config.provider] : undefined;

  return (
    <div className="flex h-full w-full flex-col bg-background backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2.5 pb-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary">
          {busy ? <Spinner className="size-3" /> : null}
          {phase === "error" ? <CircleAlert className="size-3 text-destructive" /> : null}
          <span className="truncate">AI settings</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="app-region-no-drag shrink-0"
          aria-label="Close settings"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-2">
        {phase === "error" && message ? (
          <Alert variant="destructive" className="border-0 bg-transparent px-0 py-0">
            <CircleAlert className="size-4" />
            <AlertTitle className="text-xs font-normal leading-snug text-balance">
              {message}
            </AlertTitle>
          </Alert>
        ) : null}

        {phase === "loading" ? null : (
          <>
            <Row label="Provider">
              <Select
                value={config.provider ?? undefined}
                onValueChange={(value) => {
                  if (value) onSelectProvider(value);
                }}
                disabled={busy}
              >
                <SelectTrigger className="h-7! w-full text-xs" size="sm">
                  <SelectValue placeholder="Choose a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id} className="text-xs">
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>

            {config.provider && !config.encryptionAvailable ? (
              <Alert variant="destructive" className="border-0 bg-transparent px-0 py-0">
                <KeyRound className="size-4" />
                <AlertTitle className="text-xs font-normal leading-snug text-balance">
                  OS key encryption is unavailable, so the API key cannot be stored.
                </AlertTitle>
              </Alert>
            ) : null}

            <Row label="API key">
              <div className="flex items-center gap-1.5">
                <Input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => onKeyDraftChange(e.target.value)}
                  placeholder={
                    config.hasKey ? "•••••••• (saved)" : activeProvider?.keyPlaceholder ?? "API key"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!config.provider || busy || !config.encryptionAvailable}
                  className="h-7! text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSaveKey}
                  disabled={
                    !config.provider ||
                    !keyDraft.trim() ||
                    busy ||
                    !config.encryptionAvailable
                  }
                  className="h-7 shrink-0 text-[10px]"
                >
                  Save
                </Button>
                {config.hasKey ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={onClearKey}
                    disabled={busy}
                    aria-label="Remove saved API key"
                    title="Remove saved API key"
                    className="shrink-0"
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </Row>

            <Row label="Model">
              <Select
                value={config.model ?? undefined}
                onValueChange={(value) => {
                  if (value) onSelectModel(value);
                }}
                disabled={!config.provider || busy}
              >
                <SelectTrigger className="h-7! w-full text-xs" size="sm">
                  <SelectValue placeholder="Choose a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelsLoading ? (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
                      <Spinner className="size-3" />
                      Loading models…
                    </div>
                  ) : null}
                  {fastModels.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Fast &amp; small
                      </SelectLabel>
                      {fastModels.map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-xs">
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {otherModels.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        All models
                      </SelectLabel>
                      {otherModels.map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-xs">
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {!modelsLoading && fastModels.length === 0 && otherModels.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No models available. Save an API key to load the live list.
                    </div>
                  ) : null}
                </SelectContent>
              </Select>
            </Row>

            {modelsNotice ? (
              <p className="text-[10px] text-muted-foreground">{modelsNotice}</p>
            ) : null}

            {activeProvider ? (
              <a
                href={activeProvider.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Get a {activeProvider.label} API key
                <ExternalLink className="size-2.5" />
              </a>
            ) : null}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-3 py-1.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {config.provider && config.model && config.hasKey ? (
            <>
              <CircleCheck className="size-3 text-green-600" />
              Ready
            </>
          ) : (
            "Set a provider, key, and model"
          )}
        </span>
        <Separator orientation="vertical" className="h-3! data-vertical:m-0!" />
        <span className="text-[10px] text-muted-foreground">Stored encrypted on this Mac</span>
      </div>
    </div>
  );
}
