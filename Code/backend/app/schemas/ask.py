

from typing import Any

from pydantic import BaseModel, Field


class RetrievedContext(BaseModel):
    text: str
    source: str | None = None
    page: int | None = None
    score: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PipelineResult(BaseModel):
    pipeline_id: str
    pipeline_name: str
    stage: str
    namespace: str
    answer: str
    contexts: list[RetrievedContext]
    retrieval_ms: int
    generation_ms: int
    latency_ms: int
    debug: dict[str, Any] = Field(default_factory=dict)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    pipeline_ids: list[str] | None = Field(
        default=None,
        description="If null/omitted, runs ALL registered pipelines.",
    )


class AskResponse(BaseModel):
    question: str
    paper_id: str | None = None
    results: list[PipelineResult]


class PipelineInfo(BaseModel):
    pipeline_id: str
    pipeline_name: str
    stage: str
    namespace: str
