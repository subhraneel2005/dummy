"use client"

import { useSyncExternalStore } from "react"

/**
 * The host platform, read from the preload bridge.
 *
 * The value is fixed for the life of the process, so it is exposed as a static
 * external store rather than state: no effect, no cascading render, and the
 * server snapshot keeps SSR and the first client render in agreement.
 */
const subscribe = () => () => {}

const getSnapshot = () => window.electronAPI?.platform ?? ""

const getServerSnapshot = () => ""

export function usePlatform(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
