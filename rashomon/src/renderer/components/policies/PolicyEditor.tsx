import { useMemo, useState } from "react";

import { RuleTestModal } from "@renderer/components/policies/RuleTestModal";
import { Button } from "@renderer/components/ui/button";
import { Badge } from "@renderer/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Input, Textarea } from "@renderer/components/ui/input";
import type { PolicyView } from "@renderer/hooks/usePolicies";

interface PolicyEditorProps {
  policy?: PolicyView;
  onSave: (payload: { id: string; yamlContent: string }) => Promise<void>;
  onCreate: (payload: { name: string; yamlContent: string; priority?: number }) => Promise<void>;
}

export function PolicyEditor({ policy, onSave, onCreate }: PolicyEditorProps) {
  const [draftName, setDraftName] = useState("Local Policy");
  const [draftYaml, setDraftYaml] = useState(policy?.yamlContent ?? "");
  const [validation, setValidation] = useState<"valid" | "invalid">("valid");

  const summary = useMemo(() => {
    const lines = draftYaml
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.slice(0, 6).join(" | ");
  }, [draftYaml]);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Policy Editor</CardTitle>
            <p className="mt-2 text-sm text-slate-400">Edit YAML and keep the plain-language effect visible beside it.</p>
          </div>
          <Badge variant={validation === "valid" ? "safe" : "danger"}>{validation}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Policy name" />
          <Textarea
            className="min-h-[420px] font-code text-xs"
            value={policy ? draftYaml : draftYaml}
            onChange={(event) => {
              const next = event.target.value;
              setDraftYaml(next);
              setValidation(next.includes("global:") ? "valid" : "invalid");
            }}
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <p className="font-code text-xs uppercase tracking-[0.24em] text-slate-500">Plain-English Summary</p>
            <p className="mt-3 text-sm text-slate-300">{summary || "Add YAML rules to generate a concise policy summary."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {policy ? (
              <Button onClick={() => onSave({ id: policy.id, yamlContent: draftYaml })}>Save Policy</Button>
            ) : (
              <Button onClick={() => onCreate({ name: draftName, yamlContent: draftYaml, priority: 100 })}>
                Create Policy
              </Button>
            )}
            <RuleTestModal yamlContent={draftYaml} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
