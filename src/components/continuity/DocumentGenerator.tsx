"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import type { GeneratedDocumentDTO } from "@/lib/types";

type DocumentFormState = {
  businessName: string;
  heirNames: string;
  extraContext: string;
};

const defaultFormState: DocumentFormState = {
  businessName: "",
  heirNames: "",
  extraContext: "",
};

export function DocumentGenerator() {
  const [selectedType, setSelectedType] = useState<string>("BUSINESS_CONTINUITY_PLAN");
  const [formState, setFormState] = useState<DocumentFormState>(defaultFormState);
  const [documents, setDocuments] = useState<GeneratedDocumentDTO[]>([]);
  const [preview, setPreview] = useState<GeneratedDocumentDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDocuments() {
      try {
        const response = await fetch("/api/continuity/documents");
        const payload = (await response.json()) as { success: boolean; data?: GeneratedDocumentDTO[]; error?: string };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? "Unable to load documents.");
        }

        if (mounted) {
          setDocuments(payload.data);
          setPreview(payload.data[0] ?? null);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load documents.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedLabel = useMemo(() => DOCUMENT_TYPE_LABELS[selectedType] ?? selectedType, [selectedType]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);

    try {
      const context = {
        businessName: formState.businessName,
        heirNames: formState.heirNames,
        extraContext: formState.extraContext,
      };

      const response = await fetch("/api/continuity/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentType: selectedType,
          context,
        }),
      });
      const payload = (await response.json()) as { success: boolean; data?: GeneratedDocumentDTO; error?: string };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Unable to generate document.");
      }

      setPreview(payload.data);
      setDocuments((current) => [payload.data!, ...current]);
      toast.success(`${selectedLabel} generated.`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to generate document.";
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadMarkdown() {
    if (!preview) {
      return;
    }

    const blob = new Blob([preview.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${preview.title.toLowerCase().replaceAll(" ", "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyMarkdown() {
    if (!preview) {
      return;
    }

    await navigator.clipboard.writeText(preview.content);
    toast.success("Markdown copied.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="panel-card space-y-5 p-6">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Generate a document</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Pick a template, describe the business context, and generate a draft you can review with counsel.
          </p>
        </div>

        <div className="grid gap-2">
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedType(value)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                selectedType === value
                  ? "border-[var(--accent-red)] bg-[var(--accent-red)]/10 text-[var(--text-primary)]"
                  : "border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="document-business-name">Business name</Label>
            <Input id="document-business-name" value={formState.businessName} onChange={(event) => setFormState((current) => ({ ...current, businessName: event.target.value }))} className="field-base" placeholder="Studio or product name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-heirs">Heir names</Label>
            <Input id="document-heirs" value={formState.heirNames} onChange={(event) => setFormState((current) => ({ ...current, heirNames: event.target.value }))} className="field-base" placeholder="Comma-separated names" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-context">Additional context</Label>
            <Textarea id="document-context" value={formState.extraContext} onChange={(event) => setFormState((current) => ({ ...current, extraContext: event.target.value }))} className="field-base min-h-32" placeholder="What should this document accomplish? What constraints matter?" />
          </div>
        </div>

        {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}

        <Button type="button" onClick={() => void handleGenerate()} disabled={isGenerating} className="w-full bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
          {isGenerating ? "Generating..." : `Generate ${selectedLabel}`}
        </Button>
      </div>

      <div className="space-y-6">
        <div className="panel-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-heading text-2xl font-semibold">{preview?.title ?? "Document preview"}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{preview ? `Jurisdiction: ${preview.jurisdiction}` : "Generate a document to preview it here."}</p>
            </div>
            {preview ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void copyMarkdown()} className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                  Copy markdown
                </Button>
                <Button type="button" variant="outline" onClick={downloadMarkdown} className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                  Download markdown
                </Button>
              </div>
            ) : null}
          </div>
          <div className="mt-6 max-h-[32rem] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
            {preview ? <pre className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">{preview.content}</pre> : <p className="text-sm text-[var(--text-tertiary)]">No document generated yet.</p>}
          </div>
        </div>

        <div className="panel-card p-6">
          <h3 className="font-heading text-xl font-semibold">Previous documents</h3>
          {isLoading ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">No documents generated yet.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {documents.map((document) => (
                <button key={document.id} type="button" onClick={() => setPreview(document)} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3 text-left transition-all hover:border-[var(--border-hover)]">
                  <p className="font-medium">{document.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {document.jurisdiction} • {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(document.createdAt))}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
