import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { formatBytes } from "@renderer/lib/format";

interface RequestDetailProps {
  request?: Record<string, unknown> | null;
}

export function RequestDetail({ request }: RequestDetailProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Request Detail</CardTitle>
      </CardHeader>
      <CardContent>
        {request ? (
          <div className="space-y-5 text-sm text-slate-300">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Destination</p>
                <p className="mt-2 text-white">{String(request.url ?? "unknown")}</p>
              </div>
              <div>
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Decision</p>
                <p className="mt-2 text-white">{String(request.decision ?? "unknown")}</p>
              </div>
              <div>
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Body Size</p>
                <p className="mt-2">{formatBytes(Number(request.requestBodySize ?? 0))}</p>
              </div>
              <div>
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Receipt Hash</p>
                <p className="mt-2 font-code text-xs text-slate-400">{String(request.receiptHash ?? "")}</p>
              </div>
            </div>
            <div>
              <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Headers</p>
              <pre className="mt-3 overflow-auto rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-xs text-slate-300">
                {String(request.requestHeaders ?? "{}")}
              </pre>
            </div>
            <div>
              <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Body Preview</p>
              <pre className="mt-3 overflow-auto rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-xs text-slate-300">
                {String(request.requestBodyPreview ?? "")}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Select a request to inspect its manifest, headers, and receipt.</p>
        )}
      </CardContent>
    </Card>
  );
}
