import { clampPercent } from "@renderer/lib/format";

interface ThreatScoreProps {
  score: number;
}

export function ThreatScore({ score }: ThreatScoreProps) {
  const clamped = clampPercent(score);
  const color =
    clamped >= 70 ? "from-red-500 to-red-300" : clamped >= 35 ? "from-yellow-500 to-yellow-300" : "from-green-500 to-green-300";

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full bg-gradient-to-r ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="font-code text-sm text-slate-200">{clamped}</span>
    </div>
  );
}
