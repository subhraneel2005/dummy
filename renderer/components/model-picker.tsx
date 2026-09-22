"use client";

import { CircleCheck, CircleAlert, Eye, X } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  OpencodeModel,
  OpencodePickerPhase,
} from "@/hooks/use-opencode";

const PHASE_LABEL: Record<Exclude<OpencodePickerPhase, "closed">, string> = {
  connecting: "Starting OpenCode server…",
  loading: "Loading models…",
  ready: "Choose a model",
  saving: "Saving model…",
  done: "Model saved",
  error: "Something went wrong",
};

function isSelected(model: OpencodeModel, selected: OpencodeModel | null) {
  return (
    selected !== null &&
    selected.modelID === model.modelID &&
    selected.providerID === model.providerID
  );
}

function GroupedModels({
  models,
  selected,
  onSelect,
}: {
  models: OpencodeModel[];
  selected: OpencodeModel | null;
  onSelect: (model: OpencodeModel) => void;
}) {
  const groups = models.reduce<Record<string, OpencodeModel[]>>((acc, model) => {
    (acc[model.providerName] ??= []).push(model);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(groups).map(([provider, items]) => (
        <CommandGroup key={provider} heading={provider}>
          {items.map((model) => (
            <CommandItem
              key={`${model.providerID}:${model.modelID}`}
              value={`${model.providerName} ${model.name}`}
              onSelect={() => onSelect(model)}
            >
              <span className="min-w-0 flex-1 truncate" title={model.name}>
                {model.name}
              </span>
              {model.vision ? (
                <Badge
                  variant="outline"
                  className="h-4! gap-0.5 px-1 text-[9px] text-muted-foreground"
                  title="Supports image input"
                >
                  <Eye className="size-2.5!" />
                  vision
                </Badge>
              ) : null}
              <CommandShortcut className="text-green-600">
                {isSelected(model, selected) ? (
                  <CircleCheck className="size-3.5 shrink-0 text-green-600" />
                ) : (
                  <span className="size-3.5" aria-hidden="true" />
                )}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </>
  );
}

function ModelPickerContent({
  phase,
  models,
  selected,
  message,
  onClose,
  onSelect,
}: {
  phase: OpencodePickerPhase;
  models: OpencodeModel[];
  selected: OpencodeModel | null;
  message: string;
  onClose: () => void;
  onSelect: (model: OpencodeModel) => void;
}) {
  if (phase === "closed") return null;

  const busy = phase === "connecting" || phase === "loading" || phase === "saving";

  return (
    <div className="flex h-full w-full flex-col bg-background backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2.5 pb-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary">
          {busy ? <Spinner className="size-3" /> : null}
          {phase === "error" ? <CircleAlert className="size-3 text-destructive" /> : null}
          <span className="truncate">{PHASE_LABEL[phase]}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="app-region-no-drag shrink-0"
          aria-label="Close model picker"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 px-1.5 pb-1.5">
        {phase === "ready" ? (
          <Command className="rounded-md! border border-border/60 bg-popover!">
            <CommandInput placeholder="Search models…" className="px-2" />
            <CommandList className="max-h-none flex-1 min-h-0">
              <CommandEmpty>No models found</CommandEmpty>
              <GroupedModels models={models} selected={selected} onSelect={onSelect} />
            </CommandList>
          </Command>
        ) : phase === "error" ? (
          <div className="flex h-full items-center justify-center px-2">
            <Alert variant="destructive" className="border-0 bg-transparent px-1 py-1">
              <CircleAlert className="size-4" />
              <AlertTitle className="text-xs font-normal leading-snug text-balance">
                {message || "The model list could not be loaded."}
              </AlertTitle>
            </Alert>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          {phase === "ready"
            ? "Your OpenCode account's active models"
            : message || "Press Alt+M to reopen"}
        </span>
        <Separator orientation="vertical" className="h-3! data-vertical:m-0!" />
        <span className="text-[10px] text-muted-foreground">
          {phase === "ready" ? "Selecting one saves it for later" : ""}
        </span>
      </div>
    </div>
  );
}

export function ModelPicker(props: Parameters<typeof ModelPickerContent>[0]) {
  return <ModelPickerContent {...props} />;
}

export type { OpencodeModel, OpencodePickerPhase };
export { GroupedModels };