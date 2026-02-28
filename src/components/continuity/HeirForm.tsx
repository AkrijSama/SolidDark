"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HEIR_ACCESS_LABELS } from "@/lib/constants";
import type { HeirDTO } from "@/lib/types";

type HeirFormValues = {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  relationship: string;
  accessLevel: string;
  instructions: string;
};

type HeirFormProps = {
  initialValue?: HeirDTO | null;
  isSaving: boolean;
  notificationOrder: number;
  onSubmit: (values: HeirFormValues) => Promise<void>;
  onCancel: () => void;
};

const defaultValues: HeirFormValues = {
  fullName: "",
  email: "",
  phone: "",
  relationship: "",
  accessLevel: "OPERATIONAL",
  instructions: "",
};

export function HeirForm({ initialValue, isSaving, notificationOrder, onSubmit, onCancel }: HeirFormProps) {
  const [values, setValues] = useState<HeirFormValues>(() =>
    initialValue
      ? {
          id: initialValue.id,
          fullName: initialValue.fullName,
          email: initialValue.email,
          phone: initialValue.phone ?? "",
          relationship: initialValue.relationship,
          accessLevel: initialValue.accessLevel,
          instructions: initialValue.instructions ?? "",
        }
      : defaultValues,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await onSubmit(values);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save heir.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="heir-full-name">Full Name</Label>
          <Input id="heir-full-name" value={values.fullName} onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))} className="field-base" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="heir-email">Email</Label>
          <Input id="heir-email" type="email" value={values.email} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} className="field-base" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="heir-phone">Phone</Label>
          <Input id="heir-phone" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} className="field-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="heir-relationship">Relationship</Label>
          <Input id="heir-relationship" value={values.relationship} onChange={(event) => setValues((current) => ({ ...current, relationship: event.target.value }))} className="field-base" placeholder="Business partner, spouse, attorney" required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Access Level</Label>
          <Select value={values.accessLevel} onValueChange={(accessLevel) => setValues((current) => ({ ...current, accessLevel }))}>
            <SelectTrigger className="field-base border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)]">
              <SelectValue placeholder="Choose access level" />
            </SelectTrigger>
            <SelectContent className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              {Object.entries(HEIR_ACCESS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="heir-instructions">Instructions</Label>
          <Textarea id="heir-instructions" value={values.instructions} onChange={(event) => setValues((current) => ({ ...current, instructions: event.target.value }))} className="field-base min-h-32" placeholder="Explain what this person should keep running, shut down, or hand to counsel." />
        </div>
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">Notification order for this heir will be set to {initialValue?.notificationOrder ?? notificationOrder}.</p>
      {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
          {isSaving ? "Saving..." : initialValue ? "Update Heir" : "Add Heir"}
        </Button>
      </div>
    </form>
  );
}
