
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

JobStatusLiteral = Literal["pending", "running", "completed", "failed", "cancelled"]




class BatchRequest(BaseModel):
    paper_id: str = Field(..., min_length=1, description="Must match a saved benchmark in data/benchmarks/.")
    pipeline_ids: list[str] | None = Field(
        default=None,
        description="If null/omitted, runs ALL registered pipelines.",
    )
    concurrency: int = Field(
        default=5,
        ge=1,
        le=8,
        description="Max units in flight at once; 1 = the old serial behaviour.",
    )




class BatchResultRow(BaseModel):

    run_id: str
    run_timestamp: datetime
    paper_id: str
    paper_title: str
    question_id: str
    question: str
    category: str
    pipeline_id: str
    pipeline_name: str
    stage: str
    namespace: str
    answer: str
    contexts: list[str] = Field(default_factory=list)
    faithfulness: float | None = None
    answer_relevancy: float | None = None
    context_precision: float | None = None
    context_recall: float | None = None
    ragas_skipped: list[str] = Field(default_factory=list)
    ragas_errors: dict[str, str] = Field(default_factory=dict)
    retrieval_ms: int
    generation_ms: int
    latency_ms: int
    ragas_ms: int
    error: str | None = None




class JobStatus(BaseModel):

    job_id: str
    status: JobStatusLiteral
    paper_id: str
    pipeline_ids: list[str]
    total_units: int
    completed_units: int
    current_question_id: str | None = None
    current_pipeline_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None
    summary: dict | None = None


class JobSummary(BaseModel):

    job_id: str
    status: JobStatusLiteral
    paper_id: str
    total_units: int
    completed_units: int
    started_at: datetime | None = None
    finished_at: datetime | None = None


class CancelResponse(BaseModel):
    job_id: str
    cancel_requested: bool
    status: JobStatusLiteral


class JobResultsResponse(BaseModel):

    job_id: str
    status: JobStatusLiteral
    results: list[BatchResultRow]
