import { useMemo, useState } from "react";

import { Button } from "@renderer/components/ui/button";
import { Dialog } from "@renderer/components/ui/dialog";
import { Textarea } from "@renderer/components/ui/input";

interface RuleTestModalProps {
  yamlContent: string;
}

export function RuleTestModal({ yamlContent }: RuleTestModalProps) {
  const [open, setOpen] = useState(false);
  const [sample, setSample] = useState("POST https://api.openai.com/v1/chat/completions\nAuthorization: Bearer sk_test_example");

  const verdict = useMemo(() => {
    const lowered = sample.toLowerCase();
    if (lowered.includes("sk_test") || lowered.includes("akia")) {
      return "Likely blocked: secret-like content present.";
    }
    if (yamlContent.includes("require_approval") && lowered.includes("webhook.site")) {
      return "Likely review: destination matches approval-oriented policy text.";
    }
    return "Likely allowed: no obvious deny or secret match in the sample.";
  }, [sample, yamlContent]);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Test Rule
      </Button>
      <Dialog open={open} title="Rule Test Modal" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Textarea rows={10} value={sample} onChange={(event) => setSample(event.target.value)} />
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm text-slate-300">{verdict}</div>
        </div>
      </Dialog>
    </>
  );
}
