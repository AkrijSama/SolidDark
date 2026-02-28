"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QuoteFormProps = {
  onSubmit: (values: {
    applicationUrl: string;
    policyType: string;
    techStack: string;
    userCount: string;
    dataTypes: string;
  }) => Promise<void>;
  isSaving: boolean;
};

export function QuoteForm({ onSubmit, isSaving }: QuoteFormProps) {
  const [values, setValues] = useState({
    applicationUrl: "",
    policyType: "AI_SOFTWARE_EO",
    techStack: "",
    userCount: "",
    dataTypes: "",
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="panel-card space-y-4 p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        try {
          await onSubmit(values);
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to generate quote.");
        }
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="applicationUrl">Application URL</Label>
          <Input id="applicationUrl" value={values.applicationUrl} onChange={(event) => setValues((current) => ({ ...current, applicationUrl: event.target.value }))} className="field-base" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="policyType">Policy type</Label>
          <select id="policyType" value={values.policyType} onChange={(event) => setValues((current) => ({ ...current, policyType: event.target.value }))} className="field-base h-10 w-full px-3">
            <option value="AI_SOFTWARE_EO">AI Software E&O</option>
            <option value="CYBER_LIABILITY">Cyber Liability</option>
            <option value="GENERAL_LIABILITY">General Liability</option>
            <option value="BUNDLED">Bundled</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="userCount">User count</Label>
          <Input id="userCount" value={values.userCount} onChange={(event) => setValues((current) => ({ ...current, userCount: event.target.value }))} className="field-base" placeholder="500" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="techStack">Tech stack</Label>
          <Input id="techStack" value={values.techStack} onChange={(event) => setValues((current) => ({ ...current, techStack: event.target.value }))} className="field-base" placeholder="Next.js, Supabase, Anthropic" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataTypes">Data types handled</Label>
          <Input id="dataTypes" value={values.dataTypes} onChange={(event) => setValues((current) => ({ ...current, dataTypes: event.target.value }))} className="field-base" placeholder="PII, health data, payments" />
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}
      <Button type="submit" disabled={isSaving} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
        {isSaving ? "Assessing..." : "Get quote estimate"}
      </Button>
    </form>
  );
}
