"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { ProjectCard } from "@/components/collective/ProjectCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CollectiveProjectDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function CollectiveProjectsPage() {
  const [projects, setProjects] = useState<CollectiveProjectDTO[]>([]);
  const [form, setForm] = useState({ name: "", clientName: "", contractValue: "", status: "PROPOSED", revenueWaterfall: "Lead:40, Builder:40, Ops:20" });

  async function loadProjects() {
    const response = await fetch("/api/collective/projects");
    const payload = (await response.json()) as { success: boolean; data?: CollectiveProjectDTO[]; error?: string };
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Unable to load projects.");
    }
    setProjects(payload.data);
  }

  const handleInitialLoad = useEffectEvent(async () => {
    try {
      await loadProjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load projects.");
    }
  });

  useEffect(() => {
    void handleInitialLoad();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Collective" title="Projects" description="Create collective projects and define the revenue waterfall that governs payout expectations." />
      <form
        className="panel-card space-y-4 p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/collective/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const payload = (await response.json()) as { success: boolean; error?: string };
          if (!response.ok || !payload.success) {
            toast.error(payload.error ?? "Unable to create project.");
            return;
          }
          toast.success("Project created.");
          await loadProjects();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="field-base" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientName">Client name</Label>
            <Input id="clientName" value={form.clientName} onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))} className="field-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractValue">Contract value</Label>
            <Input id="contractValue" value={form.contractValue} onChange={(event) => setForm((current) => ({ ...current, contractValue: event.target.value }))} className="field-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Input id="status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="field-base" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="revenueWaterfall">Revenue waterfall</Label>
            <Input id="revenueWaterfall" value={form.revenueWaterfall} onChange={(event) => setForm((current) => ({ ...current, revenueWaterfall: event.target.value }))} className="field-base" placeholder="Lead:40, Builder:40, Ops:20" />
          </div>
        </div>
        <Button type="submit" className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">Create project</Button>
      </form>
      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
