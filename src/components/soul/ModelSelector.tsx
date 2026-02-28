"use client";

import { AlertTriangle } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ModelSelectorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const localSelected = value === "local-llm";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="model-selector">Model</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id="model-selector" className="field-base border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)]">
            <SelectValue placeholder="Choose a model" />
          </SelectTrigger>
          <SelectContent className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
            <SelectItem value="claude-opus-4-6">Claude Opus 4.5</SelectItem>
            <SelectItem value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</SelectItem>
            <SelectItem value="gpt-4o">OpenAI GPT-4o</SelectItem>
            <SelectItem value="local-llm">Local LLM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {localSelected ? (
        <div className="rounded-xl border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/10 p-3 text-sm text-[var(--accent-amber)]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Local models may miss legal nuances. Use SOTA models for matters with financial or legal consequences.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
