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
      barCount={8}
      minHeight={4}
      maxHeight={84}
      centerAlign={true}
      className="h-8 w-full items-center gap-0.5 bg-transparent p-0"
    />
  )
}   