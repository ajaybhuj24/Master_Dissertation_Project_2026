
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class MasterRow(BaseModel):

    paper_id: str
    run_id: str
    run_timestamp: str
    question_id: str
    category: str
    pipeline_id: str
    pipeline_name: str
    stage: str
    namespace: str
    faithfulness: float | None
    answer_relevancy: float | None
    context_precision: float | None
    context_recall: float | None
    latency_ms: int
    error: str | None


class MasterRunInfo(BaseModel):

    run_id: str
    paper_id: str
    paper_title: str
    run_timestamp: str
    n_rows: int


class MasterRowsResponse(BaseModel):
    dedup: Literal["latest", "none"]
    total_rows: int
    included_rows: int
    runs: list[MasterRunInfo]
    rows: list[MasterRow]
