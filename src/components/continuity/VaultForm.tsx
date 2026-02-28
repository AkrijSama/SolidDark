"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_TYPE_LABELS } from "@/lib/constants";
import type { HeirDTO, VaultEntryDetail } from "@/lib/types";

type VaultFormValues = {
  id?: string;
  serviceName: string;
  serviceType: string;
  username: string;
  password: string;
  apiKey: string;
  notes: string;
  expiresAt: string;
  accessibleBy: string[];
};

type VaultFormProps = {
  heirs: HeirDTO[];
  initialValue?: VaultEntryDetail | null;
  isSaving: boolean;
  onSubmit: (values: VaultFormValues) => Promise<void>;
  onCancel: () => void;
};

const defaultValues: VaultFormValues = {
  serviceName: "",
  serviceType: "OTHER",
  username: "",
  password: "",
  apiKey: "",
  notes: "",
  expiresAt: "",
  accessibleBy: [],
};

export function VaultForm({ heirs, initialValue, isSaving, onSubmit, onCancel }: VaultFormProps) {
  const [values, setValues] = useState<VaultFormValues>(() =>
    initialValue
      ? {
          id: initialValue.id,
          serviceName: initialValue.serviceName,
          serviceType: initialValue.serviceType,
          username: initialValue.data.username ?? "",
          password: initialValue.data.password ?? "",
          apiKey: initialValue.data.apiKey ?? "",
          notes: initialValue.data.notes ?? "",
          expiresAt: initialValue.expiresAt ? initialValue.expiresAt.slice(0, 10) : "",
          accessibleBy: initialValue.accessibleBy,
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
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save credential.");
    }
  }

  function toggleHeir(heirId: string) {
    setValues((current) => ({
      ...current,
      accessibleBy: current.accessibleBy.includes(heirId)
        ? current.accessibleBy.filter((value) => value !== heirId)
        : [...current.accessibleBy, heirId],
    }));
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="serviceName">Service Name</Label>
          <Input
            id="serviceName"
            value={values.serviceName}
            onChange={(event) => setValues((current) => ({ ...current, serviceName: event.target.value }))}
            className="field-base"
            placeholder="AWS, Stripe, Vercel"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Service Type</Label>
          <Select
            value={values.serviceType}
            onValueChange={(serviceType) => setValues((current) => ({ ...current, serviceType }))}
          >
            <SelectTrigger className="field-base border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)]">
              <SelectValue placeholder="Choose a type" />
            </SelectTrigger>
            <SelectContent className="border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiresAt">Expiration Date</Label>
          <Input
            id="expiresAt"
            type="date"
            value={values.expiresAt}
            onChange={(event) => setValues((current) => ({ ...current, expiresAt: event.target.value }))}
            className="field-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={values.username}
            onChange={(event) => setValues((current) => ({ ...current, username: event.target.value }))}
            className="field-base"
            placeholder="login name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={values.password}
            onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            className="field-base"
            placeholder="password"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            value={values.apiKey}
            onChange={(event) => setValues((current) => ({ ...current, apiKey: event.target.value }))}
            className="field-base font-mono"
            placeholder="optional token"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={values.notes}
            onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
            className="field-base min-h-28"
            placeholder="What this account controls, where MFA lives, what to rotate first."
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Accessible By</Label>
        {heirs.length === 0 ? (
          <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-3 text-sm text-[var(--text-tertiary)]">
            Add at least one heir before you assign credential access.
          </p>
        ) : (
          <div className="grid gap-2">
            {heirs.map((heir) => (
              <label
                key={heir.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={values.accessibleBy.includes(heir.id)}
                  onChange={() => toggleHeir(heir.id)}
                  className="h-4 w-4 accent-[var(--accent-red)]"
                />
                <span>{heir.fullName}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
          {isSaving ? "Saving..." : initialValue ? "Update Credential" : "Save Credential"}
        </Button>
      </div>
    </form>
  );
}
