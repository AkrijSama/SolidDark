import { useState } from "react";

import { Button } from "@renderer/components/ui/button";
import { Dialog } from "@renderer/components/ui/dialog";

interface AgentKillSwitchProps {
  agentId: string;
  agentName: string;
  onKill: (agentId: string) => Promise<void>;
}

export function AgentKillSwitch({ agentId, agentName, onKill }: AgentKillSwitchProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Kill Network
      </Button>
      <Dialog open={open} title="Confirm Kill Switch" onClose={() => setOpen(false)}>
        <p className="text-sm text-slate-300">
          This will sever proxy access for <span className="font-semibold text-white">{agentName}</span> until you resume it.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await onKill(agentId);
              setOpen(false);
            }}
          >
            Confirm Kill
          </Button>
        </div>
      </Dialog>
    </>
  );
}
