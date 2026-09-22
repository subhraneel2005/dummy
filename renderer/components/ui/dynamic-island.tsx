"use client"

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react"
import { motion, AnimatePresence, type HTMLMotionProps } from "motion/react"
import { cn } from "@/lib/utils"

// ── Size presets ────────────────────────────────────────────────────────

type SizePresets =
  | "default"
  | "compact"
  | "compactLong"
  | "compactMedium"
  | "large"
  | "long"
  | "medium"
  | "tall"
  | "ultra"
  | "massive"
  | "chat"
  | "panel"
  | "minimalLeading"
  | "minimalTrailing"
  | "models"
  | "reset"
  | "empty"

interface Preset {
  width: number | string
  height: number | string
}

const PRESETS: Record<SizePresets, Preset> = {
  default:          { width: 120, height: 40 },
  compact:          { width: 160, height: 40 },
  compactLong:      { width: 220, height: 40 },
  compactMedium:    { width: 180, height: 52 },
  large:            { width: 280, height: 120 },
  long:             { width: 320, height: 48 },
  medium:           { width: 280, height: 80 },
  tall:             { width: 200, height: 160 },
  ultra:            { width: 320, height: 200 },
  massive:          { width: 380, height: 280 },
  chat:             { width: 480, height: 620 },
  panel:            { width: 280, height: 84 },
  minimalLeading:   { width: 48,  height: 48 },
  minimalTrailing:  { width: 48,  height: 48 },
  models:           { width: 340, height: 470 },
  reset:            { width: 120, height: 40 },
  empty:            { width: 0,   height: 0 },
}

// ── Context ─────────────────────────────────────────────────────────────

interface AnimationStep {
  size: SizePresets
  delay: number
}

interface IslandState {
  size: SizePresets
  previousSize: SizePresets | undefined
  animationQueue: AnimationStep[]
  isAnimating: boolean
}

interface DynamicIslandContextValue {
  state: IslandState
  setSize: (size: SizePresets) => void
  scheduleAnimation: (steps: AnimationStep[]) => void
  presets: Record<SizePresets, Preset>
}

const DynamicIslandContext = createContext<DynamicIslandContextValue | null>(null)

// ── Provider ────────────────────────────────────────────────────────────

interface DynamicIslandProviderProps {
  children: ReactNode
  initialSize?: SizePresets
  initialAnimation?: AnimationStep[]
}

function DynamicIslandProvider({
  children,
  initialSize = "default",
  initialAnimation = [],
}: DynamicIslandProviderProps) {
  const [state, setState] = useState<IslandState>({
    size: initialSize,
    previousSize: undefined,
    animationQueue: initialAnimation,
    isAnimating: initialAnimation.length > 0,
  })
  const queueRef = useRef<AnimationStep[]>(initialAnimation)
  const runningRef = useRef(false)

  const runQueue = useCallback(async () => {
    if (runningRef.current || queueRef.current.length === 0) return
    runningRef.current = true

    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!
      await new Promise((r) => setTimeout(r, next.delay))
      setState((prev) => ({
        size: next.size,
        previousSize: prev.size,
        animationQueue: [...queueRef.current],
        isAnimating: queueRef.current.length > 0,
      }))
    }

    runningRef.current = false
  }, [])

  const setSize = useCallback(
    (size: SizePresets) => {
      queueRef.current = []
      setState((prev) => ({
        size,
        previousSize: prev.size,
        animationQueue: [],
        isAnimating: false,
      }))
    },
    []
  )

  const scheduleAnimation = useCallback(
    (steps: AnimationStep[]) => {
      queueRef.current = [...steps]
      setState((prev) => ({
        ...prev,
        animationQueue: steps,
        isAnimating: true,
      }))
      runQueue()
    },
    [runQueue]
  )

  const value = useMemo(
    () => ({ state, setSize, scheduleAnimation, presets: PRESETS }),
    [state, setSize, scheduleAnimation]
  )

  return (
    <DynamicIslandContext.Provider value={value}>
      {children}
    </DynamicIslandContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────────

function useDynamicIslandSize() {
  const ctx = useContext(DynamicIslandContext)
  if (!ctx) throw new Error("useDynamicIslandSize must be used within DynamicIslandProvider")
  return ctx
}

// ── Shell ───────────────────────────────────────────────────────────────

interface DynamicIslandProps extends Omit<HTMLMotionProps<"div">, "children"> {
  id: string
  children: ReactNode
}

function DynamicIsland({ id, children, className, ...props }: DynamicIslandProps) {
  const { state } = useDynamicIslandSize()
  const preset = PRESETS[state.size] ?? PRESETS.default
  const isEmpty = state.size === "empty"

  return (
    <motion.div
      id={id}
      data-state={state.size}
      className={cn(
        "relative overflow-hidden rounded-xl text-primary",
        isEmpty
          ? "bg-transparent"
          : "border border-black/10 bg-background shadow-lg dark:border-white/20",
        className
      )}
      initial={false}
      animate={{
        width: preset.width,
        height: preset.height,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ── Content primitives ──────────────────────────────────────────────────

function DynamicContainer({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn("absolute inset-0", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

function DynamicTitle({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className={cn("font-semibold leading-tight", className)}
    >
      {children}
    </motion.div>
  )
}

function DynamicDescription({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className={cn("text-sm opacity-70", className)}
    >
      {children}
    </motion.div>
  )
}

function DynamicDiv({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={className}>{children}</div>
}

// ── Exports ─────────────────────────────────────────────────────────────

export {
  DynamicIslandProvider,
  DynamicIsland,
  DynamicContainer,
  DynamicTitle,
  DynamicDescription,
  DynamicDiv,
  useDynamicIslandSize,
  type SizePresets,
  type Preset,
}