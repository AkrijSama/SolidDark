import { Badge } from "@renderer/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { PolicyView } from "@renderer/hooks/usePolicies";

interface PolicyListProps {
  policies: PolicyView[];
  selectedPolicyId?: string;
  onSelect: (policyId: string) => void;
}

export function PolicyList({ policies, selectedPolicyId, onSelect }: PolicyListProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Policy Inventory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {policies.map((policy) => (
          <button
            key={policy.id}
            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
              selectedPolicyId === policy.id ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/5 bg-white/[0.03] hover:bg-white/[0.05]"
            }`}
            onClick={() => onSelect(policy.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{policy.name}</p>
                <p className="mt-1 text-sm text-slate-400">{policy.description}</p>
              </div>
              <Badge variant={policy.enabled ? "safe" : "neutral"}>{policy.enabled ? "Enabled" : "Disabled"}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              <span>{policy.ruleCount} rules</span>
              <span>Priority {policy.priority}</span>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
