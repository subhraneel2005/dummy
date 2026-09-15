"use client"

import { BarVisualizer } from "@/components/ui/bar-visualizer"
import { type AgentState } from "@/components/ui/bar-visualizer"

interface AudioBarsProps {
  active?: boolean
  state?: AgentState
}

export function AudioBars({ active = false, state }: AudioBarsProps) {
  const effectiveState: AgentState = state ?? (active ? "speaking" : "listening")

  return (
    <BarVisualizer
      state={effectiveState}
      demo={true}
      barCount={12}
      minHeight={8}
      maxHeight={85}
      centerAlign={true}
      className="h-14 w-52 items-center gap-1 bg-primary-foreground p-0"
    />
  )
}   