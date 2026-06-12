import { useEffect, useRef, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { PipelineMetrics } from "@/types"
import { METRICS, shortPipelineName } from "@/lib/metrics"

const HEIGHT = 320

export function StageGroupedBars({ metrics }: { metrics: PipelineMetrics[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const data = metrics.map((m) => ({
    name: shortPipelineName(m.pipeline_id, m.pipeline_name),
    faithfulness: m.faithfulness,
    answer_relevancy: m.answer_relevancy,
    context_precision: m.context_precision,
    context_recall: m.context_recall,
  }))

  return (
    <div ref={ref} className="w-full" style={{ height: HEIGHT }}>
      {width > 0 && (
        <BarChart
          width={width}
          height={HEIGHT}
          data={data}
          margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            interval={0}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
            formatter={(value) =>
              typeof value === "number" ? value.toFixed(3) : String(value)
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {METRICS.map((m) => (
            <Bar
              key={m.key}
              dataKey={m.key}
              name={m.label}
              fill={m.color}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      )}
    </div>
  )
}
