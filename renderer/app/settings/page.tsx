"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId } from "react"
import {
  ArrowLeftIcon,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  KeyRound,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ProviderIcon, providerLabel } from "@/components/provider-icon"
import { isFastModel, useAiSettings } from "@/hooks/use-ai-settings"
import { cn } from "@/lib/utils"

const NO_MODEL = "__none__"

export default function SettingsPage() {
  const router = useRouter()
  const {
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
    load,
    selectProvider,
    selectModel,
    saveKey,
    clearKey,
  } = useAiSettings()

  useEffect(() => {
    load()
  }, [load])

  const keyFieldId = useId()
  const busy = phase === "loading" || phase === "saving"
  const current = config.provider ? providers[config.provider] : undefined
  const modelOptions = liveModels.length
    ? liveModels
    : (models[config.provider ?? ""] ?? [])

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <header className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-3 text-muted-foreground"
            // Settings is a route inside the chat window now, not its own
            // window, so it needs an explicit way back to the transcript.
            render={<button type="button" onClick={() => router.push("/chat")} />}
          >
            <ArrowLeftIcon aria-hidden="true" />
            Back to chat
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            AI Settings
          </h1>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Choose a provider, pick a model, and store the API key on this
            device. Keys are encrypted in the local database and never leave it.
          </p>
        </header>

        {/* Announces loading, saving, and failure states to screen readers. */}
        <div aria-live="polite" aria-atomic="true">
          {message ? (
            <Alert variant="destructive" className="mb-6">
              <CircleAlert />
              <AlertTitle>Couldn&rsquo;t Save</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        {phase === "loading" ? (
          <div className="space-y-6" aria-busy="true">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ) : (
          <div className="space-y-8">
            <section aria-labelledby="provider-heading" className="space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id="provider-heading"
                  className="text-sm font-medium tracking-tight"
                >
                  Provider
                </h2>
                {config.hasKey ? (
                  <Badge variant="secondary" className="gap-1">
                    <CircleCheck className="size-3" aria-hidden="true" />
                    Key Stored
                  </Badge>
                ) : (
                  <Badge variant="outline">No Key</Badge>
                )}
              </div>

              <RadioGroup
                value={config.provider ?? ""}
                onValueChange={(value) => {
                  if (value) selectProvider(value)
                }}
                disabled={busy}
                aria-describedby={config.encryptionAvailable ? undefined : "key-warning"}
                className="grid gap-2 sm:grid-cols-2"
              >
                {Object.values(providers).map((provider) => {
                  const selected = provider.id === config.provider
                  return (
                    <Label
                      key={provider.id}
                      htmlFor={`provider-${provider.id}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                        "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
                        "hover:bg-accent/50",
                        selected ? "border-ring bg-accent" : "border-border"
                      )}
                    >
                      <RadioGroupItem
                        id={`provider-${provider.id}`}
                        value={provider.id}
                      />
                      <ProviderIcon provider={provider.id} className="size-5" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {provider.label}
                      </span>
                    </Label>
                  )
                })}
              </RadioGroup>
            </section>

            <Separator />

            <section aria-labelledby="model-heading" className="space-y-3">
              <h2 id="model-heading" className="text-sm font-medium tracking-tight">
                Model
              </h2>
              <Select
                value={config.model ?? NO_MODEL}
                onValueChange={(value) => {
                  if (value && value !== NO_MODEL) selectModel(value)
                }}
                disabled={busy || !config.provider}
              >
                <SelectTrigger
                  id="model-trigger"
                  aria-label="Model"
                  className="w-full"
                >
                  <SelectValue
                    placeholder={config.provider ? "Select a model" : "Choose a provider first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.length === 0 ? (
                    <SelectItem value={NO_MODEL} disabled>
                      No models available
                    </SelectItem>
                  ) : (
                    modelOptions.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <span className="flex w-full items-center justify-between gap-4">
                          <span className="truncate">{model.label}</span>
                          {isFastModel(model.id) ? (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              Fast
                            </Badge>
                          ) : null}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {modelsLoading ? <Spinner className="size-3" /> : null}
                {modelsNotice || "Fast models suit dictation; the rest suit longer answers."}
              </p>
            </section>

            <Separator />

            <section aria-labelledby="key-heading" className="space-y-3">
              <h2 id="key-heading" className="text-sm font-medium tracking-tight">
                API Key
              </h2>
              {current ? (
                <p className="text-sm text-muted-foreground">
                  {current.keyPlaceholder}
                </p>
              ) : null}
              <Field>
                <FieldLabel htmlFor={keyFieldId}>
                  {current ? `${current.label} API Key` : "API Key"}
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id={keyFieldId}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    name="api-key"
                    placeholder={current?.keyPlaceholder ?? "sk-…"}
                    value={keyDraft}
                    onChange={(event) => setKeyDraft(event.currentTarget.value)}
                    disabled={busy || !config.provider}
                  />
                  <Button
                    type="button"
                    onClick={saveKey}
                    disabled={busy || !config.provider || !keyDraft.trim()}
                  >
                    {phase === "saving" ? <Spinner /> : <KeyRound aria-hidden="true" />}
                    Save Key
                  </Button>
                </div>
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearKey}
                  disabled={busy || !config.hasKey}
                >
                  Remove Key
                </Button>
                {current?.docsUrl ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0"
                    // The trigger is an <a>, so button semantics must be off.
                    nativeButton={false}
                    render={
                      <a
                        href={current.docsUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      />
                    }
                  >
                    {providerLabel(config.provider)} API Docs
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
              {config.encryptionAvailable ? null : (
                <p id="key-warning" className="text-xs text-destructive">
                  The system keychain is unavailable, so the key can&rsquo;t be
                  encrypted on this device. Avoid saving it until that changes.
                </p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
