import type { PipelineInfo, Stage } from "@/types"

export type StageMeta = {
  label: string
  dot: string
  text: string
  border: string
  tint: string
}

export const STAGE_META: Record<Stage, StageMeta> = {
  baseline: {
    label: "Baseline",
    dot: "bg-stage-baseline",
    text: "text-stage-baseline",
    border: "border-l-stage-baseline",
    tint: "bg-stage-baseline/10",
  },
  pre_retrieval: {
    label: "Pre-retrieval",
    dot: "bg-stage-pre",
    text: "text-stage-pre",
    border: "border-l-stage-pre",
    tint: "bg-stage-pre/10",
  },
  during_retrieval: {
    label: "During-retrieval",
    dot: "bg-stage-during",
    text: "text-stage-during",
    border: "border-l-stage-during",
    tint: "bg-stage-during/10",
  },
  post_retrieval: {
    label: "Post-retrieval",
    dot: "bg-stage-post",
    text: "text-stage-post",
    border: "border-l-stage-post",
    tint: "bg-stage-post/10",
  },
}

export const STAGE_ORDER: Stage[] = [
  "baseline",
  "pre_retrieval",
  "during_retrieval",
  "post_retrieval",
]

const FALLBACK_META: StageMeta = {
  label: "Other",
  dot: "bg-muted-foreground",
  text: "text-muted-foreground",
  border: "border-l-border",
  tint: "bg-muted",
}

export function stageMeta(stage: string): StageMeta {
  return STAGE_META[stage as Stage] ?? FALLBACK_META
}

export function stageIndex(stage: string): number {
  const i = STAGE_ORDER.indexOf(stage as Stage)
  return i === -1 ? STAGE_ORDER.length : i
}

export const DEFAULT_PIPELINES: PipelineInfo[] = [
  { pipeline_id: "naive", pipeline_name: "Naive RAG", stage: "baseline", namespace: "naive" },
  { pipeline_id: "semantic_chunking", pipeline_name: "Semantic Chunking", stage: "pre_retrieval", namespace: "semantic" },
  { pipeline_id: "multi_query", pipeline_name: "Multi-Query Retrieval", stage: "pre_retrieval", namespace: "naive" },
  { pipeline_id: "mmr", pipeline_name: "MMR", stage: "during_retrieval", namespace: "naive" },
  { pipeline_id: "rerank", pipeline_name: "Cross-Encoder Re-rank", stage: "during_retrieval", namespace: "naive" },
  { pipeline_id: "crag", pipeline_name: "CRAG", stage: "during_retrieval", namespace: "naive" },
  { pipeline_id: "compression", pipeline_name: "Contextual Compression", stage: "post_retrieval", namespace: "naive" },
  { pipeline_id: "selfcheck", pipeline_name: "SelfCheckGPT", stage: "post_retrieval", namespace: "naive" },
]
