"use client"

import { BarVisualizer } from "@/components/ui/bar-visualizer"
import { type AgentState } from "@/components/ui/bar-visualizer"

interface AudioBarsProps {
  active?: boolean
  state?: AgentState
  mediaStream?: MediaStream | null
}

export function AudioBars({ active = false, state, mediaStream }: AudioBarsProps) {
  const effectiveState: AgentState = state ?? (active ? "speaking" : "listening")
  const hasLiveStream = !!mediaStream

  return (
    <BarVisualizer
      state={effectiveState}
      mediaStream={mediaStream}
      demo={!hasLiveStream}
      barCount={8}
      minHeight={hasLiveStream ? 30 : 4}
      maxHeight={84}
      centerAlign={true}
      loPass={hasLiveStream ? 60 : 100}
      hiPass={hasLiveStream ? 8000 : 200}
      className="h-8 w-full items-center gap-0.5 bg-transparent p-0"
    />
  )
}   