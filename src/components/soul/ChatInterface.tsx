"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { MessageBubble } from "@/components/soul/MessageBubble";
import { ModelSelector } from "@/components/soul/ModelSelector";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useSoul } from "@/hooks/useSoul";

export function ChatInterface() {
  const { conversations, error, isLoading, messages, sendMessage, startNewConversation } = useSoul();
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const nextDraft = draft;
    setDraft("");
    await sendMessage(nextDraft, model);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="panel-card hidden h-[calc(100vh-12rem)] flex-col p-4 xl:flex">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold">Conversations</h2>
          <Button type="button" size="sm" onClick={startNewConversation} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
            New
          </Button>
        </div>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No saved conversations yet.</p>
          ) : (
            conversations.map((conversation) => (
              <div key={conversation.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                <p className="truncate text-sm font-medium">{conversation.title}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                  }).format(new Date(conversation.updatedAt))}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="panel-card flex h-[calc(100vh-12rem)] flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-4">
          <div>
            <h2 className="font-heading text-2xl font-semibold">The Soul</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              I am the SolidDark Soul. Ask me anything about law, compliance, insurance, or business protection for your AI-powered software.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] xl:hidden">
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  History
                </Button>
              </SheetTrigger>
              <SheetContent className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                <SheetHeader>
                  <SheetTitle>Conversations</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {conversations.map((conversation) => (
                    <div key={conversation.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-3">
                      <p className="truncate text-sm font-medium">{conversation.title}</p>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="border-b border-[var(--border-default)] px-4 py-4">
          <ModelSelector value={model} onChange={setModel} />
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.length === 0 ? (
              <EmptyState
                title="The Soul is ready"
                description="I am the SolidDark Soul. Ask me anything about law, compliance, insurance, or business protection for your AI-powered software."
              />
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-[var(--border-default)] p-4">
          <div className="space-y-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask the Soul what could break, what the law says, or what document you need next."
              className="field-base min-h-28"
            />
            {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={startNewConversation} className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                New conversation
              </Button>
              <Button
                type="button"
                disabled={isLoading}
                onClick={() => void handleSend()}
                className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90"
              >
                {isLoading ? "Streaming..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
