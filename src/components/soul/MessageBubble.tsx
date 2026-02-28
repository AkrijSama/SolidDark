import ReactMarkdown from "react-markdown";

import { JurisdictionBadge } from "@/components/soul/JurisdictionBadge";
import type { SoulMessageDTO } from "@/lib/types";

export function MessageBubble({ message }: { message: SoulMessageDTO }) {
  const isUser = message.role === "USER";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-3xl rounded-2xl border px-4 py-3 ${
          isUser
            ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/50 text-white"
            : "border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
        }`}
      >
        {!isUser ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <span>{message.model ?? "SolidDark Soul"}</span>
            <JurisdictionBadge jurisdictions={message.jurisdictions} />
          </div>
        ) : null}
        <div className="prose prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-strong:text-white">
          {isUser ? <p className="m-0 whitespace-pre-wrap">{message.content}</p> : <ReactMarkdown>{message.content}</ReactMarkdown>}
        </div>
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          {new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(message.createdAt))}
        </p>
      </div>
    </div>
  );
}
