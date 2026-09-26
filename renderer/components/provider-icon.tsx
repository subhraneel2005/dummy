"use client"

import { cn } from "@/lib/utils"

/** Brand marks live in `public/` so they're served as plain static files. */
const PROVIDER_ICONS: Record<string, string> = {
  openai: "/icons8-chatgpt-100.png",
  anthropic: "/icons8-claude-96.png",
  google: "/icons8-google-96.png",
  xai: "/icons8-grok-100.png",
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
}

export function providerLabel(provider: string | null | undefined): string {
  if (!provider) return "No provider"
  return PROVIDER_LABELS[provider] ?? provider
}

export function ProviderIcon({
  provider,
  className,
  size = 16,
}: {
  provider: string | null | undefined
  className?: string
  size?: number
}) {
  const src = provider ? PROVIDER_ICONS[provider] : undefined
  if (!src) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={providerLabel(provider)}
      aria-hidden
      // Intrinsic size is declared so the slot is reserved before the bitmap
      // decodes; without it the footer and composer rows shift on load.
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  )
}
