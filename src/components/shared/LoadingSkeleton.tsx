import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="panel-card space-y-3 p-5">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-full rounded-md bg-[var(--bg-tertiary)]" />
      ))}
    </div>
  );
}
