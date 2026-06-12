import type { BatchResultRow, PipelineMetrics } from "@/types"
import { stageIndex } from "@/lib/stages"

export const METRICS = [
  { key: "faithfulness", label: "Faithfulness", short: "Faith.", color: "#0072b2" },
  { key: "answer_relevancy", label: "Answer relevancy", short: "Ans. rel.", color: "#009e73" },
  { key: "context_precision", label: "Context precision", short: "Ctx prec.", color: "#e69f00" },
  { key: "context_recall", label: "Context recall", short: "Ctx rec.", color: "#cc79a7" },
] as const

export type MetricKey = (typeof METRICS)[number]["key"]

export function formatScore(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(3)
}

const SHORT_PIPELINE_NAME: Record<string, string> = {
  naive: "Naive",
  semantic_chunking: "Semantic",
  multi_query: "Multi-Query",
  mmr: "MMR",
  rerank: "Re-rank",
  crag: "CRAG",
  compression: "Compress",
  selfcheck: "SelfCheck",
}

export function shortPipelineName(id: string, fallback: string): string {
  return SHORT_PIPELINE_NAME[id] ?? fallback
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null
}

export function aggregateByPipeline(rows: BatchResultRow[]): PipelineMetrics[] {
  type Acc = {
    pipeline_name: string
    stage: string
    n_rows: number
    n_errors: number
    faithfulness: number[]
    answer_relevancy: number[]
    context_precision: number[]
    context_recall: number[]
    latency_ms: number[]
  }
  const map = new Map<string, Acc>()

  for (const r of rows) {
    let a = map.get(r.pipeline_id)
    if (!a) {
      a = {
        pipeline_name: r.pipeline_name,
        stage: r.stage,
        n_rows: 0,
        n_errors: 0,
        faithfulness: [],
        answer_relevancy: [],
        context_precision: [],
        context_recall: [],
        latency_ms: [],
      }
      map.set(r.pipeline_id, a)
    }
    a.n_rows += 1
    if (r.error) {
      a.n_errors += 1
      continue
    }
    if (r.faithfulness != null) a.faithfulness.push(r.faithfulness)
    if (r.answer_relevancy != null) a.answer_relevancy.push(r.answer_relevancy)
    if (r.context_precision != null) a.context_precision.push(r.context_precision)
    if (r.context_recall != null) a.context_recall.push(r.context_recall)
    if (typeof r.latency_ms === "number") a.latency_ms.push(r.latency_ms)
  }

  return [...map.entries()]
    .map(([id, a]) => ({
      pipeline_id: id,
      pipeline_name: a.pipeline_name,
      stage: a.stage,
      n_rows: a.n_rows,
      n_errors: a.n_errors,
      faithfulness: mean(a.faithfulness),
      answer_relevancy: mean(a.answer_relevancy),
      context_precision: mean(a.context_precision),
      context_recall: mean(a.context_recall),
      latency_ms: mean(a.latency_ms),
    }))
    .sort((x, y) => stageIndex(x.stage) - stageIndex(y.stage))
}

export function bestByMetric(
  metrics: PipelineMetrics[]
): Record<MetricKey, string | null> {
  const best = {} as Record<MetricKey, string | null>
  for (const m of METRICS) {
    let bestId: string | null = null
    let bestVal = -Infinity
    for (const row of metrics) {
      const v = row[m.key]
      if (v != null && v > bestVal) {
        bestVal = v
        bestId = row.pipeline_id
      }
    }
    best[m.key] = bestId
  }
  return best
}
