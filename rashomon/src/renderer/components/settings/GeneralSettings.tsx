import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Input } from "@renderer/components/ui/input";
import { Switch } from "@renderer/components/ui/switch";
import type { SettingsState } from "@shared/types";

interface GeneralSettingsProps {
  settings: SettingsState;
  onUpdate: (patch: Partial<SettingsState>) => Promise<void>;
}

export function GeneralSettings({ settings, onUpdate }: GeneralSettingsProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-400">Proxy Port</span>
          <Input
            value={settings.proxyPort}
            onChange={(event) => void onUpdate({ proxyPort: Number(event.target.value) })}
          />
        </label>
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <span className="text-sm text-slate-300">Auto-start on login</span>
          <Switch checked={settings.autoStart} onCheckedChange={(checked) => void onUpdate({ autoStart: checked })} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <span className="text-sm text-slate-300">Desktop notifications</span>
          <Switch
            checked={settings.notificationsEnabled}
            onCheckedChange={(checked) => void onUpdate({ notificationsEnabled: checked })}
          />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <span className="text-sm text-slate-300">TLS interception</span>
          <Switch
            checked={settings.tlsInterceptionEnabled}
            onCheckedChange={(checked) => void onUpdate({ tlsInterceptionEnabled: checked })}
          />
        </div>
        <Button variant="secondary" onClick={() => void onUpdate(settings)}>
          Persist Settings
        </Button>
      </CardContent>
    </Card>
  );
}
