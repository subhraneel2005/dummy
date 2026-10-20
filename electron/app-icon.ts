/**
 * App icon resolution.
 *
 * The source of truth is `renderer/public/app-icon.png` next to this package.
 * The extra candidates let a future packaged build bundle the same image as
 * `electron/assets/app-icon.png` or as an extra resource without changing code.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { app, nativeImage } from "electron"

// `dist/app-icon.js` → `electron/` → repo root. Resolving from the module
// rather than `app.getAppPath()` also works for script-style launches, where
// Electron points the app path at the script's directory.
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const repoIcon = path.resolve(moduleDir, "..", "..", "renderer", "public", "app-icon.png")

function candidates(): string[] {
  return [
    // Dev / repo layout: electron/ and renderer/ are siblings.
    repoIcon,
    path.resolve(app.getAppPath(), "..", "renderer", "public", "app-icon.png"),
    // Packaged-with-assets layout.
    path.resolve(app.getAppPath(), "assets", "app-icon.png"),
    // electron-builder `extraResources` layout.
    path.resolve(process.resourcesPath, "app-icon.png"),
  ]
}

/** First existing icon path, or null when none of the layouts match. */
export function appIconPath(): string | null {
  for (const candidate of candidates()) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      // Try the next layout.
    }
  }
  return null
}

/**
 * Set the macOS dock icon. `BrowserWindow.icon` is ignored on macOS, so this is
 * the only place the icon shows in development; Linux/Windows get it from the
 * `icon` option on the chat window.
 */
export function applyAppIcon(): void {
  const iconPath = appIconPath()
  if (!iconPath) {
    console.warn("[app] app icon not found; keeping the Electron default")
    return
  }
  if (process.platform !== "darwin") return

  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    console.warn(`[app] could not load app icon at ${iconPath}`)
    return
  }
  app.dock?.setIcon(image)
}
