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
      barCount={16}
      minHeight={12}
      maxHeight={85}
      centerAlign={true}
      className="h-20 w-full my-4 items-center gap-1 bg-transparent p-0"
    />
  )
}   