import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  colorClass?: string;
}

export function StatCard({ label, value, trend = 0, colorClass = "text-cyan-300" }: StatCardProps) {
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-0">
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between pt-4">
        <div>
          <p className={`text-3xl font-semibold tracking-tight ${colorClass}`}>{value}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Last 24h</p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
          <TrendIcon size={14} />
          <span>{Math.abs(trend)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
