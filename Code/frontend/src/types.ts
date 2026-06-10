export interface UploadResponse {
  paper_id: string
  filename: string
  pages: number
  naive_chunks: number
  semantic_chunks: number
  namespaces_cleared: string[]
  uploaded_at: string
}

export interface CurrentPaperResponse {
  paper_id: string | null
  filename: string | null
  pages: number | null
  naive_chunks: number | null
  semantic_chunks: number | null
  uploaded_at: string | null
}

export interface DeletePaperResponse {
  cleared_namespaces: string[]
  current_paper: null
}

export interface ValidationErrorItem {
  loc: (string | number)[]
  msg: string
  type: string
}

export interface FastApiError {
  detail?: string | ValidationErrorItem[]
}


export type Stage =
  | "baseline"
  | "pre_retrieval"
  | "during_retrieval"
  | "post_retrieval"

export interface PipelineInfo {
  pipeline_id: string
  pipeline_name: string
  stage: string
  namespace: string
}

export interface RetrievedContext {
  text: string
  source: string | null
  page: number | null
  score: number | null
  metadata: Record<string, unknown>
}

export interface PipelineResult {
  pipeline_id: string
  pipeline_name: string
  stage: string
  namespace: string
  answer: string
  contexts: RetrievedContext[]
  retrieval_ms: number
  generation_ms: number
  latency_ms: number
  debug: Record<string, unknown>
}

export interface AskResponse {
  question: string
  paper_id: string | null
  results: PipelineResult[]
}
