"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

import { AudioBars } from "@/components/audio-bars-demo";
import { Conversation, ConversationContent } from "@/components/conversation";
import {
  DynamicIsland,
  DynamicIslandProvider,
  DynamicContainer,
  useDynamicIslandSize,
  type SizePresets,
} from "@/components/ui/dynamic-island";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

const DEMO_MESSAGES: Message[] = [
  {
    id: 1,
    role: "assistant",
    content: "Hey! I'm listening what do you need?",
  },
  { id: 2, role: "user", content: "Can you summarize my unread emails?" },
  {
    id: 3,
    role: "assistant",
    content:
      "You have 12 unread. Top 3: a meeting invite for tomorrow, a payment reminder, and a product update from your CI tool.",
  },
  {
    id: 4,
    role: "user",
    content: "Great, please draft a response to the meeting invite.",
  },
  {
    id: 5,
    role: "assistant",
    content: "Done I'll confirm you can make it and ask for the agenda.",
  },
    {
    id: 6,
    role: "user",
    content: "Can you check if I have any important emails I haven't replied to?",
  },

  {
    id: 7,
    role: "assistant",
    content:
      "Yes. I found 3 that may need a reply: a recruiter asking for your availability, a client follow-up from yesterday, and a project update from your teammate.",
  },

  {
    id: 8,
    role: "user",
    content: "Draft a reply to the recruiter saying I'm available tomorrow afternoon.",
  },

  {
    id: 9,
    role: "assistant",
    content:
      "Drafted a short reply saying you're available tomorrow afternoon and asking what time works best for them.",
  },

  {
    id: 10,
    role: "user",
    content: "What meetings do I have tomorrow?",
  },

  {
    id: 11,
    role: "assistant",
    content:
      "You have 3 meetings tomorrow: a team sync at 10:00 AM, a recruiter call at 2:30 PM, and a project review at 5:00 PM.",
  },

  {
    id: 12,
    role: "user",
    content: "Remind me 15 minutes before the recruiter call.",
  },

  {
    id: 13,
    role: "assistant",
    content:
      "Done. I'll remind you 15 minutes before the recruiter call tomorrow.",
  },

  {
    id: 14,
    role: "user",
    content: "Also, are there any emails from today that look urgent?",
  },

  {
    id: 15,
    role: "assistant",
    content:
      "One looks urgent: your payment provider flagged a failed payment and asked you to update your billing details.",
  },
];

function CloseButton() {
  return (
    <Button
      variant={"outline"}
      size={"icon-xs"}
      onClick={() => window.electronAPI?.window.close()}
      className="app-region-no-drag"
      aria-label="Close window"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

function MessageRow({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-white/10 text-white",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function IslandContent({ open }: { open: boolean }) {
  return (
    <DynamicContainer className="flex h-full w-full flex-col bg-background backdrop-blur-md">
      <div className="app-region-drag flex flex-col shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-2">
        <CloseButton />
        <AudioBars active={open} />
      </div>
      <Conversation className="app-region-no-drag min-h-0 bg-black/40">
        <ConversationContent className="flex flex-col gap-3">
          {DEMO_MESSAGES.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
        </ConversationContent>
      </Conversation>
    </DynamicContainer>
  );
}

function Island() {
  const { setSize } = useDynamicIslandSize();
  const [open, setOpen] = useState(false);

  const openPanel = useCallback(() => {
    setOpen(true);
    setSize("chat" as SizePresets);
  }, [setSize]);

  // Global Alt+D opens the panel; it stays open until closed via the X button.
  useEffect(() => {
    window.electronAPI?.ready();
    const unsub = window.electronAPI?.onGlobalShortcut((phase) => {
      if (phase === "down") openPanel();
    });
    return unsub;
  }, [openPanel]);

  return (
    <DynamicIsland id="audio-bars-island">
      <IslandContent open={open} />
    </DynamicIsland>
  );
}

export default function Home() {
  return (
    <DynamicIslandProvider initialSize="empty">
      <main className="app-region-drag flex h-screen w-screen select-none items-center justify-center bg-transparent">
        <div>
          <Island />
        </div>
      </main>
    </DynamicIslandProvider>
  );
}
