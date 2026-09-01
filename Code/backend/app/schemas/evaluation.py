
from typing import Any

from pydantic import BaseModel, Field

# The four RAGAS metrics for a single answer,
class RagasScores(BaseModel):

    faithfulness: float | None = None
    answer_relevancy: float | None = None
    context_precision: float | None = None
    context_recall: float | None = None
    skipped: list[str] = Field(default_factory=list)
    errors: dict[str, str] = Field(default_factory=dict)

