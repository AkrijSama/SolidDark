import { Button } from "@renderer/components/ui/button";

interface ExportButtonProps {
  onExport: (format: "json" | "csv") => Promise<void>;
}

export function ExportButton({ onExport }: ExportButtonProps) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => onExport("json")}>
        Export JSON
      </Button>
      <Button variant="secondary" onClick={() => onExport("csv")}>
        Export CSV
      </Button>
    </div>
  );
}
