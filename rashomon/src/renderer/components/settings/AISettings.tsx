import { Button } from "@renderer/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Input } from "@renderer/components/ui/input";
import type { SettingsState } from "@shared/types";

interface AISettingsProps {
  settings: SettingsState;
  onUpdate: (patch: Partial<SettingsState>) => Promise<void>;
}

export function AISettings({ settings, onUpdate }: AISettingsProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>AI Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-400">Provider</span>
          <select
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm"
            value={settings.intentProvider}
            onChange={(event) => void onUpdate({ intentProvider: event.target.value as SettingsState["intentProvider"] })}
          >
            <option value="disabled">Disabled</option>
            <option value="anthropic">Anthropic API</option>
            <option value="ollama">Ollama Local</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-400">Anthropic API Key</span>
          <Input value={settings.anthropicApiKey} onChange={(event) => void onUpdate({ anthropicApiKey: event.target.value })} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-400">Ollama Base URL</span>
          <Input value={settings.ollamaBaseUrl} onChange={(event) => void onUpdate({ ollamaBaseUrl: event.target.value })} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-400">Model</span>
          <Input value={settings.intentModel} onChange={(event) => void onUpdate({ intentModel: event.target.value })} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-400">Analysis Threshold</span>
          <Input
            value={settings.intentThreshold}
            onChange={(event) => void onUpdate({ intentThreshold: Number(event.target.value) })}
          />
        </label>
        <Button variant="secondary" onClick={() => void onUpdate(settings)}>
          Apply AI Settings
        </Button>
      </CardContent>
    </Card>
  );
}
