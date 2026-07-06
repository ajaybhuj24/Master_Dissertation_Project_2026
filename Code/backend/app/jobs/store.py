
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from ..schemas.batch import BatchResultRow, JobStatusLiteral


@dataclass
class JobState:

    job_id: str
    paper_id: str
    paper_title: str
    pipeline_ids: list[str]
    total_units: int
    status: JobStatusLiteral = "pending"
    completed_units: int = 0
    current_question_id: str | None = None
    current_pipeline_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None
    results: list[BatchResultRow] = field(default_factory=list)
    cancel_requested: bool = False
    summary: dict | None = None

    def mark_started(self) -> None:
        self.status = "running"
        self.started_at = datetime.now(timezone.utc)

    def mark_completed(self) -> None:
        self.status = "completed"
        self.finished_at = datetime.now(timezone.utc)

    def mark_failed(self, error: str) -> None:
        self.status = "failed"
        self.error = error
        self.finished_at = datetime.now(timezone.utc)

    def mark_cancelled(self) -> None:
        self.status = "cancelled"
        self.finished_at = datetime.now(timezone.utc)



JOBS: dict[str, JobState] = {}


def register(job: JobState) -> None:
    JOBS[job.job_id] = job


def get(job_id: str) -> JobState | None:
    return JOBS.get(job_id)


def all_jobs() -> list[JobState]:
    return sorted(
        JOBS.values(),
        key=lambda j: j.started_at or datetime.now(timezone.utc),
        reverse=True,
    )
