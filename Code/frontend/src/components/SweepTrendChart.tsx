import { useEffect, useRef, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { SweepPoint } from "@/types"
import type { MetricKey } from "@/lib/metrics"
import { pipelineColor, shortPipelineName } from "@/lib/metrics"

const HEIGHT = 340

export function SweepTrendChart({
  points,
  pipelineIds,
  metric,
}: {
  points: SweepPoint[]
  pipelineIds: string[]
  metric: MetricKey
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setWidth(w)
    }
    update()
    const raf = requestAnimationFrame(update)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const meanKey = `${metric}_mean` as `${MetricKey}_mean`
  const data = points.map((pt) => {
    const row: Record<string, number | null> = {
      words: pt.cumulative_word_count,
    }
    for (const pid of pipelineIds) {
      const pm = pt.by_pipeline[pid]
      row[pid] = pm ? pm[meanKey] : null
    }
    return row
  })

  return (
    <div ref={ref} className="w-full" style={{ height: HEIGHT }}>
      {width > 0 && (
        <LineChart
          width={width}
          height={HEIGHT}
          data={data}
          margin={{ top: 8, right: 16, left: -4, bottom: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="words"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => v.toLocaleString()}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            label={{
              value: "Cumulative word count",
              position: "insideBottom",
              offset: -8,
              fill: "var(--muted-foreground)",
              fontSize: 12,
            }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
            labelFormatter={(v) => `${Number(v).toLocaleString()} words`}
            formatter={(value, name) => [
              typeof value === "number" ? value.toFixed(3) : "—",
              shortPipelineName(String(name), String(name)),
            ]}
          />
          <Legend
            content={() => (
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-xs">
                {pipelineIds.map((pid, i) => (
                  <li key={pid} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-0.5 w-3.5 rounded-full"
                      style={{ background: pipelineColor(pid, i) }}
                    />
                    <span className="text-muted-foreground">
                      {shortPipelineName(pid, pid)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          />
          {pipelineIds.map((pid, i) => (
            <Line
              key={pid}
              type="monotone"
              dataKey={pid}
              name={pid}
              stroke={pipelineColor(pid, i)}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      )}
    </div>
  )
}
