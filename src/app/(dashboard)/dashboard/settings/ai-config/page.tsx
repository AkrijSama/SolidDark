import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";

import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { getRequiredEnv } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function testProviderConnection(provider: string, localLlmUrl: string) {
  if (provider === "CLAUDE_API") {
    const anthropic = new Anthropic({
      apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    });

    await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with OK." }],
    });
    return;
  }

  if (provider === "OPENAI_API") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getRequiredEnv("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Reply with OK." }],
        max_tokens: 8,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI test failed with status ${response.status}.`);
    }

    return;
  }

  const response = await fetch(`${localLlmUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3.1",
      stream: false,
      messages: [{ role: "user", content: "Reply with OK." }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Local LLM test failed with status ${response.status}.`);
  }
}

export default async function AiConfigPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { user } = await requireAuthenticatedAppUser();
  const prisma = getPrismaClient();

  async function saveAiConfig(formData: FormData) {
    "use server";

    const { user: currentUser } = await requireAuthenticatedAppUser();
    const prismaClient = getPrismaClient();
    const aiProvider = String(formData.get("aiProvider") ?? "CLAUDE_API");
    const localLlmUrl = String(formData.get("localLlmUrl") ?? "").trim();

    await prismaClient.user.update({
      where: {
        id: currentUser.id,
      },
      data: {
        aiProvider: aiProvider as "CLAUDE_API" | "OPENAI_API" | "LOCAL_LLM",
        localLlmUrl: aiProvider === "LOCAL_LLM" ? localLlmUrl || "http://localhost:11434" : null,
      },
    });

    redirect("/dashboard/settings/ai-config?saved=1");
  }

  async function testConnection(formData: FormData) {
    "use server";

    const provider = String(formData.get("aiProvider") ?? "CLAUDE_API");
    const localLlmUrl = String(formData.get("localLlmUrl") ?? "http://localhost:11434").trim() || "http://localhost:11434";

    try {
      await testProviderConnection(provider, localLlmUrl);
      redirect("/dashboard/settings/ai-config?test=success");
    } catch (error) {
      redirect(`/dashboard/settings/ai-config?testError=${encodeURIComponent(error instanceof Error ? error.message : "Connection test failed.")}`);
    }
  }

  await prisma.user.findUnique({
    where: {
      id: user.id,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="AI configuration"
        description="Choose which provider SolidDark uses by default when it reasons, drafts, and scores risk."
      />

      <div className="panel-card p-6">
        <form action={saveAiConfig} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="aiProvider">Provider</Label>
            <select id="aiProvider" name="aiProvider" defaultValue={user.aiProvider} className="field-base h-10 w-full px-3">
              <option value="CLAUDE_API">Claude API</option>
              <option value="OPENAI_API">OpenAI API</option>
              <option value="LOCAL_LLM">Local LLM</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="localLlmUrl">Local LLM URL</Label>
            <Input id="localLlmUrl" name="localLlmUrl" defaultValue={user.localLlmUrl ?? "http://localhost:11434"} className="field-base" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
              <p className="text-sm font-medium">Claude default</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Claude Sonnet 4.5 for standard work, Claude Opus 4.6 for harder legal reasoning.</p>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
              <p className="text-sm font-medium">OpenAI default</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">GPT-4o as the current fallback model.</p>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
              <p className="text-sm font-medium">Local default</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Ollama-compatible `/api/chat` endpoint using your configured model.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 p-4 text-sm text-[var(--accent-amber)]">
            Local models may miss legal nuances. Use SOTA models for matters with financial or legal consequences.
          </div>

          {typeof resolvedSearchParams.saved === "string" ? <p className="text-sm text-[var(--accent-cyan)]">AI settings saved.</p> : null}
          {typeof resolvedSearchParams.test === "string" ? <p className="text-sm text-[var(--accent-cyan)]">Connection test succeeded.</p> : null}
          {typeof resolvedSearchParams.testError === "string" ? <p className="text-sm text-[var(--accent-red)]">{resolvedSearchParams.testError}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
              Save AI settings
            </Button>
          </div>
        </form>

        <form action={testConnection} className="mt-4">
          <input type="hidden" name="aiProvider" value={user.aiProvider} />
          <input type="hidden" name="localLlmUrl" value={user.localLlmUrl ?? "http://localhost:11434"} />
          <Button type="submit" variant="outline" className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
            Test connection
          </Button>
        </form>
      </div>

      <ApiKeyManager />
    </div>
  );
}
