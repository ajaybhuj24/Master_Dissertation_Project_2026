from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class BenchmarkCategory(str, Enum):
    FACTUAL = "factual"
    SYNTHESIS = "synthesis"
    OUT_OF_SCOPE = "out_of_scope"


class BenchmarkQuestion(BaseModel):
    id: str = Field(..., min_length=1, description="Unique within the file (e.g. 'q1', 'q2', ...).")
    category: BenchmarkCategory
    question: str = Field(..., min_length=1)
    ground_truth: str | None = Field(
        default=None,
        description="Required string for factual/synthesis; MUST be null for out_of_scope.",
    )
    expected_passages: list[str] = Field(
        default_factory=list,
        description="Required (>=1) for factual/synthesis; may be empty for out_of_scope.",
    )

    @model_validator(mode="after")
    def _validate_category_invariants(self) -> "BenchmarkQuestion":
        is_oos = self.category == BenchmarkCategory.OUT_OF_SCOPE

        if is_oos and self.ground_truth is not None:
            raise ValueError(
                f"Question {self.id!r}: out_of_scope questions MUST have ground_truth=null; "
                f"got {self.ground_truth!r}"
            )
        if not is_oos and (self.ground_truth is None or not self.ground_truth.strip()):
            raise ValueError(
                f"Question {self.id!r}: {self.category.value} questions REQUIRE a non-empty ground_truth"
            )

        if not is_oos and len(self.expected_passages) == 0:
            raise ValueError(
                f"Question {self.id!r}: {self.category.value} questions REQUIRE at least one expected_passages entry"
            )

        return self


class BenchmarkFile(BaseModel):

    paper_id: str = Field(..., min_length=1)
    paper_title: str = Field(..., min_length=1)
    created_at: datetime
    questions: list[BenchmarkQuestion] = Field(..., min_length=15, max_length=15)

    @model_validator(mode="after")
    def _validate_unique_ids(self) -> "BenchmarkFile":
        ids = [q.id for q in self.questions]
        seen: set[str] = set()
        dupes: list[str] = []
        for q_id in ids:
            if q_id in seen:
                dupes.append(q_id)
            seen.add(q_id)
        if dupes:
            raise ValueError(f"Duplicate question id(s): {sorted(set(dupes))}")
        return self

    def category_counts(self) -> dict[str, int]:
        counts = {c.value: 0 for c in BenchmarkCategory}
        for q in self.questions:
            counts[q.category.value] += 1
        return counts


class BenchmarkSummary(BaseModel):

    paper_id: str
    paper_title: str
    created_at: datetime | None = None
    question_count: int
    filename: str


class PaperMismatchWarning(BaseModel):
    loaded_paper_id: str | None
    benchmark_paper_id: str


class BenchmarkUploadResponse(BaseModel):
    paper_id: str
    paper_title: str
    question_count: int
    category_counts: dict[str, int]
    saved_path: str
    paper_mismatch_warning: PaperMismatchWarning | None = None
