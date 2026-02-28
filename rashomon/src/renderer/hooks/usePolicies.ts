import { startTransition, useEffect, useState } from "react";

import { invokeIpc } from "@renderer/lib/ipc";

export interface PolicyView {
  id: string;
  name: string;
  description: string;
  yamlContent: string;
  enabled: boolean;
  priority: number;
  ruleCount: number;
  filePath?: string;
}

export function usePolicies() {
  const [policies, setPolicies] = useState<PolicyView[]>([]);

  const refresh = async () => {
    const next = await invokeIpc<PolicyView[]>("policies:list");
    startTransition(() => setPolicies(next));
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    policies,
    async createPolicy(payload: { name: string; yamlContent: string; priority?: number }) {
      await invokeIpc("policies:create", payload);
      await refresh();
    },
    async updatePolicy(payload: { id: string; yamlContent: string }) {
      await invokeIpc("policies:update", payload);
      await refresh();
    },
    async deletePolicy(id: string) {
      await invokeIpc("policies:delete", id);
      await refresh();
    },
    async togglePolicy(id: string) {
      const current = policies.find((policy) => policy.id === id);
      if (!current) {
        return;
      }

      await invokeIpc("policies:update", {
        id,
        yamlContent: current.yamlContent,
      });
      await refresh();
    },
  };
}
