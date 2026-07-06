
from __future__ import annotations

from pydantic import BaseModel, Field


class CorpusPaper(BaseModel):

    paper_id: str
    filename: str
    word_count: int
    char_count: int
    pages: int
    n_chunks: int
    added_at: str


class CorpusListResponse(BaseModel):
    papers: list[CorpusPaper]
    total_papers: int
    total_word_count: int




class SweepRequest(BaseModel):

    target_paper_id: str = Field(..., min_length=1)
    pipeline_ids: list[str] | None = Field(
        default=None,
        description="If null/omitted, runs the 4 experiment pipelines "
        "(naive, mmr, rerank, crag).",
    )
    distractor_counts: list[int] | None = Field(
        default=None,
        description="Explicit # of distractors at each sweep step, e.g. "
        "[0, 2, 4]. If null, auto-generated from n_points.",
    )
    n_points: int = Field(
        default=7,
        ge=2,
        le=20,
        description="How many evenly-spaced sweep steps when distractor_counts "
        "is null.",
    )


class SweepPipelineMeans(BaseModel):

    n_rows: int
    n_errors: int
    faithfulness_mean: float | None = None
    answer_relevancy_mean: float | None = None
    context_precision_mean: float | None = None
    context_recall_mean: float | None = None
    latency_ms_mean: float | None = None


class SweepPoint(BaseModel):

    n_distractors: int
    n_papers: int
    paper_ids: list[str]
    cumulative_word_count: int
    by_pipeline: dict[str, SweepPipelineMeans]


class SweepResult(BaseModel):

    sweep_id: str
    target_paper_id: str
    target_paper_title: str
    pipeline_ids: list[str]
    created_at: str
    distractor_counts: list[int]
    n_questions: int
    total_units: int
    total_errors: int
    points: list[SweepPoint]


class SweepSummary(BaseModel):

    sweep_id: str
    target_paper_id: str
    target_paper_title: str
    pipeline_ids: list[str]
    created_at: str
    n_questions: int
    n_points: int
    total_units: int
    total_errors: int
    filename: str
