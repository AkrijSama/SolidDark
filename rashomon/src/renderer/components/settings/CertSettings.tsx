import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";

interface CertSettingsProps {
  caPath: string;
  instructions: string[];
}

export function CertSettings({ caPath, instructions }: CertSettingsProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Certificate Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">CA Certificate Path</p>
          <p className="mt-3 font-code text-xs text-slate-300">{caPath || "Not generated yet"}</p>
        </div>
        <div className="space-y-2 text-sm text-slate-300">
          {instructions.map((instruction) => (
            <p key={instruction}>{instruction}</p>
          ))}
        </div>
        <Button variant="secondary">Regenerate Certificate</Button>
      </CardContent>
    </Card>
  );
}
