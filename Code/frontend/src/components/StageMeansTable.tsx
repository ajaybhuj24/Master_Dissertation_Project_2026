import type { StageMetrics } from "@/types"
import { cn } from "@/lib/utils"
import { stageMeta } from "@/lib/stages"
import { METRICS, formatScore } from "@/lib/metrics"

export function StageMeansTable({ stages }: { stages: StageMetrics[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium">Stage</th>
            {METRICS.map((m) => (
              <th key={m.key} className="px-3 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: m.color }}
                  />
                  {m.label}
                </span>
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Latency</th>
            <th className="px-3 py-2 text-right font-medium">n</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => {
            const meta = stageMeta(s.stage)
            return (
              <tr
                key={s.stage}
                className="border-b transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", meta.dot)} />
                    <span className="font-medium">{meta.label}</span>
                  </span>
                </td>
                {METRICS.map((m) => (
                  <td
                    key={m.key}
                    className="px-3 py-2 text-right tabular-nums"
                  >
                    {formatScore(s[m.key])}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {s.latency_ms == null
                    ? "—"
                    : `${Math.round(s.latency_ms).toLocaleString()} ms`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {s.n_rows}
                  {s.n_errors > 0 && (
                    <span className="text-destructive"> (−{s.n_errors})</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
