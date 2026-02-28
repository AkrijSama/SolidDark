"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RegisterFormProps = {
  onSubmit: (values: {
    projectName: string;
    description: string;
    deploymentUrl: string;
    repositoryUrl: string;
    platform: string;
    techStack: string;
    metrics: string;
  }) => Promise<void>;
  isSaving: boolean;
};

export function RegisterForm({ onSubmit, isSaving }: RegisterFormProps) {
  const [values, setValues] = useState({
    projectName: "",
    description: "",
    deploymentUrl: "",
    repositoryUrl: "",
    platform: "",
    techStack: "",
    metrics: "",
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
          setValues({
            projectName: "",
            description: "",
            deploymentUrl: "",
            repositoryUrl: "",
            platform: "",
            techStack: "",
            metrics: "",
          });
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to register work.");
        }
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="projectName">Project name</Label>
          <Input id="projectName" value={values.projectName} onChange={(event) => setValues((current) => ({ ...current, projectName: event.target.value }))} className="field-base" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform">Platform</Label>
          <Input id="platform" value={values.platform} onChange={(event) => setValues((current) => ({ ...current, platform: event.target.value }))} className="field-base" placeholder="Vercel, AWS, Railway" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} className="field-base min-h-28" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deploymentUrl">Deployment URL</Label>
          <Input id="deploymentUrl" value={values.deploymentUrl} onChange={(event) => setValues((current) => ({ ...current, deploymentUrl: event.target.value }))} className="field-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="repositoryUrl">Repository URL</Label>
          <Input id="repositoryUrl" value={values.repositoryUrl} onChange={(event) => setValues((current) => ({ ...current, repositoryUrl: event.target.value }))} className="field-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="techStack">Tech stack</Label>
          <Input id="techStack" value={values.techStack} onChange={(event) => setValues((current) => ({ ...current, techStack: event.target.value }))} className="field-base" placeholder="Next.js, TypeScript, Postgres" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="metrics">Metrics JSON</Label>
          <Input id="metrics" value={values.metrics} onChange={(event) => setValues((current) => ({ ...current, metrics: event.target.value }))} className="field-base font-mono" placeholder='{"users":500,"uptime":"99.9%"}' />
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}
      <Button type="submit" disabled={isSaving} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
        {isSaving ? "Registering..." : "Register work"}
      </Button>
    </form>
  );
}
