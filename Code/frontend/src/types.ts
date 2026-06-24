
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


export interface ResultFileEntry {
  filename: string
  size_bytes: number
  modified_at: string
}

export interface BatchResultRow {
  pipeline_id: string
  pipeline_name: string
  stage: string
  namespace: string
  category: string
  question_id: string
  faithfulness: number | null
  answer_relevancy: number | null
  context_precision: number | null
  context_recall: number | null
  latency_ms: number
  error: string | null
}

export interface ResultRunFile {
  job_id: string
  paper_id: string
  paper_title: string
  exported_at: string
  summary: unknown | null
  results: BatchResultRow[]
}

export interface PipelineMetrics {
  pipeline_id: string
  pipeline_name: string
  stage: string
  n_rows: number
  n_errors: number
  faithfulness: number | null
  answer_relevancy: number | null
  context_precision: number | null
  context_recall: number | null
  latency_ms: number | null
}

export interface StageMetrics {
  stage: string
  n_rows: number
  n_errors: number
  faithfulness: number | null
  answer_relevancy: number | null
  context_precision: number | null
  context_recall: number | null
  latency_ms: number | null
}


export type BenchmarkCategory = "factual" | "synthesis" | "out_of_scope"

export interface BenchmarkQuestion {
  id: string
  category: BenchmarkCategory
  question: string
  ground_truth: string | null
  expected_passages: string[]
}

export interface BenchmarkFile {
  paper_id: string
  paper_title: string
  created_at: string
  questions: BenchmarkQuestion[]
}

export interface BenchmarkSummary {
  paper_id: string
  paper_title: string
  created_at: string | null
  question_count: number
  filename: string
}

export interface PaperMismatchWarning {
  loaded_paper_id: string | null
  benchmark_paper_id: string
}

export interface BenchmarkUploadResponse {
  paper_id: string
  paper_title: string
  question_count: number
  category_counts: Record<string, number>
  saved_path: string
  paper_mismatch_warning: PaperMismatchWarning | null
}


export type JobStatusLiteral =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export interface JobStatus {
  job_id: string
  status: JobStatusLiteral
  paper_id: string
  pipeline_ids: string[]
  total_units: number
  completed_units: number
  current_question_id: string | null
  current_pipeline_id: string | null
  started_at: string | null
  finished_at: string | null
  error: string | null
  summary: unknown | null
}

export interface JobProgressEvent {
  status: JobStatusLiteral
  completed: number
  total: number
  current_question: string | null
  current_pipeline: string | null
}
