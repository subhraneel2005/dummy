"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  BotIcon,
  MessageSquareIcon,
  PanelLeftIcon,
  PencilIcon,
  PlugIcon,
  SettingsIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react"

import { ModeToggle } from "@/components/mode-toggle"
import { ProviderIcon, providerLabel } from "@/components/provider-icon"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

interface AppSidebarProps {
  sessions: ChatSession[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  provider: string | null
  /** Whether the browser panel is expanded. The panel lives in the chat page. */
  browserOpen: boolean
  browserPage: { url: string; title: string } | null
  onToggleBrowser: () => void
}

export function AppSidebar({
  sessions,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  provider,
  browserOpen,
  browserPage,
  onToggleBrowser,
}: AppSidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ChatSession | null>(null)
  const { toggleSidebar, state } = useSidebar()
  const router = useRouter()

  return (
    <>
      <Sidebar
        collapsible="icon"
        // The user asked for no dividers, so drop the sidebar's edge. The
        // override repeats the container's own variants because twMerge only
        // dedupes utilities that share a variant.
        className="group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0"
      >
        {/* The collapse control lives in the sidebar itself, so it stays put
            instead of drifting out to the far edge of the window. The window
            uses the standard native title bar, so the web contents already
            begin below it and the header needs no extra top padding to clear
            the traffic lights. */}
        <SidebarHeader className="px-2 pb-1 pt-3">
          <div className="flex items-center gap-2 px-1.5 pb-1">
            <Image
              src="/bloub-nuage-excite-bleu-anime.svg"
              alt=""
              width={22}
              height={22}
              aria-hidden="true"
              className="size-5.5 shrink-0"
            />
            {/* Hidden in the collapsed rail, where the icon alone stands in
                for the wordmark. */}
            <span className="truncate text-[0.9375rem] leading-none font-bold tracking-tighter group-data-[collapsible=icon]:hidden">
              dummy
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
            title={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
            className="text-muted-foreground hover:text-foreground"
          >
            <PanelLeftIcon className="size-4" aria-hidden="true" />
          </Button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="New chat"
                    isActive={activeId === null}
                    onClick={onNewChat}
                  >
                    <SquarePenIcon aria-hidden="true" />
                    <span>New chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="App connectors" aria-disabled="true" disabled>
                    <PlugIcon aria-hidden="true" />
                    <span>App Connectors</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={
                      browserPage
                        ? `Browser — ${browserPage.title || browserPage.url}`
                        : "Show the browser the assistant is driving"
                    }
                    isActive={browserOpen}
                    onClick={onToggleBrowser}
                  >
                    <BotIcon aria-hidden="true" />
                    <span>Browser automation</span>
                  </SidebarMenuButton>
                  {/* A dot rather than a label: the page is visible in the
                      browser panel itself, and the sidebar has no room for a
                      URL without pushing the session list down. */}
                  {browserPage ? (
                    <span
                      aria-label={`On page: ${browserPage.title || browserPage.url}`}
                      className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                    />
                  ) : null}
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="AI Settings"
                    onClick={() => router.push("/settings")}
                  >
                    <SettingsIcon aria-hidden="true" />
                    <span>AI Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupContent>
              <SidebarMenu>
                {sessions.map((session) =>
                  renamingId === session.id ? (
                    <SidebarMenuItem key={session.id}>
                      <RenameInput
                        initialValue={session.title}
                        onCommit={(title) => {
                          onRename(session.id, title)
                          setRenamingId(null)
                        }}
                        onCancel={() => setRenamingId(null)}
                      />
                    </SidebarMenuItem>
                  ) : (
                    <SidebarMenuItem key={session.id}>
                      <SidebarMenuButton
                        isActive={session.id === activeId}
                        onClick={() => onSelect(session.id)}
                        className="pr-14"
                      >
                        <MessageSquareIcon aria-hidden="true" />
                        <span className="truncate">{session.title}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        showOnHover
                        aria-label={`Rename ${session.title}`}
                        onClick={() => setRenamingId(session.id)}
                      >
                        <PencilIcon aria-hidden="true" />
                      </SidebarMenuAction>
                      <SidebarMenuAction
                        showOnHover
                        className="right-7"
                        aria-label={`Delete ${session.title}`}
                        onClick={() => setPendingDelete(session)}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="flex-row items-center gap-1 px-2 py-2">
          <ModeToggle className="text-muted-foreground hover:text-foreground" />
          <div className="group-data-[collapsible=icon]:hidden flex min-w-0 flex-1 items-center gap-2 pl-1 text-sm text-muted-foreground">
            <ProviderIcon provider={provider} />
            <span className="truncate">{providerLabel(provider)}</span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `“${pendingDelete.title}” and its messages will be removed from this device.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RenameInput({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string
  onCommit: (title: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <Input
      ref={inputRef}
      value={value}
      name="chat-name"
      autoComplete="off"
      aria-label="Chat name"
      className="h-7"
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={() => {
        const next = value.trim()
        if (next && next !== initialValue) onCommit(next)
        else onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          inputRef.current?.blur()
        } else if (e.key === "Escape") {
          e.preventDefault()
          onCancel()
        }
      }}
    />
  )
}
