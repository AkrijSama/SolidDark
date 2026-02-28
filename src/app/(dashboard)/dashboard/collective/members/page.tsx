"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { MemberCard } from "@/components/collective/MemberCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CollectiveDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function CollectiveMembersPage() {
  const [collective, setCollective] = useState<CollectiveDTO | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", description: "", entityType: "", entityState: "", skills: "" });
  const [joinForm, setJoinForm] = useState({ collectiveId: "", role: "MEMBER", skills: "" });

  async function loadCollective() {
    const response = await fetch("/api/collective/members");
    const payload = (await response.json()) as { success: boolean; data?: CollectiveDTO | null; error?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? "Unable to load collective.");
    }
    setCollective(payload.data ?? null);
  }

  const handleInitialLoad = useEffectEvent(async () => {
    try {
      await loadCollective();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load collective.");
    }
  });

  useEffect(() => {
    void handleInitialLoad();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Collective" title="Members" description="Create a collective, join an existing one, and manage the people inside it." />
      {!collective ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <form
            className="panel-card space-y-4 p-6"
            onSubmit={async (event) => {
              event.preventDefault();
              const response = await fetch("/api/collective/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "create", ...createForm }),
              });
              const payload = (await response.json()) as { success: boolean; error?: string };
              if (!response.ok || !payload.success) {
                toast.error(payload.error ?? "Unable to create collective.");
                return;
              }
              toast.success("Collective created.");
              await loadCollective();
            }}
          >
            <h2 className="font-heading text-2xl font-semibold">Create collective</h2>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} className="field-base" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} className="field-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entityType">Entity type</Label>
              <Input id="entityType" value={createForm.entityType} onChange={(event) => setCreateForm((current) => ({ ...current, entityType: event.target.value }))} className="field-base" placeholder="LLC, SPV, Partnership" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entityState">Entity state</Label>
              <Input id="entityState" value={createForm.entityState} onChange={(event) => setCreateForm((current) => ({ ...current, entityState: event.target.value }))} className="field-base" placeholder="US-DE" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Your skills</Label>
              <Input id="skills" value={createForm.skills} onChange={(event) => setCreateForm((current) => ({ ...current, skills: event.target.value }))} className="field-base" placeholder="Product, frontend, AI" />
            </div>
            <Button type="submit" className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">Create collective</Button>
          </form>

          <form
            className="panel-card space-y-4 p-6"
            onSubmit={async (event) => {
              event.preventDefault();
              const response = await fetch("/api/collective/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "join", ...joinForm }),
              });
              const payload = (await response.json()) as { success: boolean; error?: string };
              if (!response.ok || !payload.success) {
                toast.error(payload.error ?? "Unable to join collective.");
                return;
              }
              toast.success("Joined collective.");
              await loadCollective();
            }}
          >
            <h2 className="font-heading text-2xl font-semibold">Join collective</h2>
            <div className="space-y-2">
              <Label htmlFor="collectiveId">Collective ID</Label>
              <Input id="collectiveId" value={joinForm.collectiveId} onChange={(event) => setJoinForm((current) => ({ ...current, collectiveId: event.target.value }))} className="field-base" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={joinForm.role} onChange={(event) => setJoinForm((current) => ({ ...current, role: event.target.value }))} className="field-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinSkills">Skills</Label>
              <Input id="joinSkills" value={joinForm.skills} onChange={(event) => setJoinForm((current) => ({ ...current, skills: event.target.value }))} className="field-base" />
            </div>
            <Button type="submit" className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">Join collective</Button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="panel-card p-6">
            <h2 className="font-heading text-2xl font-semibold">{collective.name}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{collective.description || "No description yet."}</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {collective.members.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
