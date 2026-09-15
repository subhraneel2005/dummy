"use client"

import { Minus, Square, X } from "lucide-react"

export function WindowControls() {
  return (
    <div className="app-region-drag flex items-center justify-end gap-1 px-2 py-1.5 select-none">
      <button
        onClick={() => window.electronAPI?.window.minimize()}
        className="app-region-no-drag p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => window.electronAPI?.window.toggleMaximize()}
        className="app-region-no-drag p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        onClick={() => window.electronAPI?.window.close()}
        className="app-region-no-drag p-1 rounded hover:bg-red-500 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}