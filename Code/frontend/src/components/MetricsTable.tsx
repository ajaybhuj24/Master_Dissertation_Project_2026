import type { PipelineMetrics } from "@/types"
import { cn } from "@/lib/utils"
import { stageMeta } from "@/lib/stages"
import { METRICS, bestByMetric, formatScore } from "@/lib/metrics"

export function MetricsTable({ metrics }: { metrics: PipelineMetrics[] }) {
  const best = bestByMetric(metrics)

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium">Pipeline</th>
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
          {metrics.map((row) => {
            const meta = stageMeta(row.stage)
            return (
              <tr
                key={row.pipeline_id}
                className="border-b transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", meta.dot)} />
                    <span className="font-medium">{row.pipeline_name}</span>
                  </span>
                </td>
                {METRICS.map((m) => {
                  const v = row[m.key]
                  const isBest = best[m.key] === row.pipeline_id && v != null
                  return (
                    <td
                      key={m.key}
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        isBest && "font-semibold"
                      )}
                    >
                      {formatScore(v)}
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.latency_ms == null
                    ? "—"
                    : `${Math.round(row.latency_ms).toLocaleString()} ms`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.n_rows}
                  {row.n_errors > 0 && (
                    <span className="text-destructive"> (−{row.n_errors})</span>
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
