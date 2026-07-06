
from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from ..evaluation.benchmark_loader import load_benchmark
from ..jobs.runner import run_batch
from ..jobs.store import JOBS, JobState, all_jobs, register
from ..pipelines.registry import all_pipeline_ids
from ..schemas.batch import (
    BatchRequest,
    CancelResponse,
    JobResultsResponse,
    JobStatus,
    JobSummary,
)

router = APIRouter(tags=["batch"])

_SSE_POLL_SECONDS = 0.5




def _to_status(job: JobState) -> JobStatus:
    return JobStatus(
        job_id=job.job_id,
        status=job.status,
        paper_id=job.paper_id,
        pipeline_ids=job.pipeline_ids,
        total_units=job.total_units,
        completed_units=job.completed_units,
        current_question_id=job.current_question_id,
        current_pipeline_id=job.current_pipeline_id,
        started_at=job.started_at,
        finished_at=job.finished_at,
        error=job.error,
        summary=job.summary,
    )


def _to_summary(job: JobState) -> JobSummary:
    return JobSummary(
        job_id=job.job_id,
        status=job.status,
        paper_id=job.paper_id,
        total_units=job.total_units,
        completed_units=job.completed_units,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )




@router.post("/batch", response_model=JobStatus, status_code=202)
async def submit_batch(
    payload: BatchRequest,
    background_tasks: BackgroundTasks,
) -> JobStatus:
    available = all_pipeline_ids()
    selected = payload.pipeline_ids or available
    if not selected:
        raise HTTPException(status_code=400, detail="No pipelines registered.")
    unknown = [pid for pid in selected if pid not in available]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown pipeline_id(s): {unknown}. Available: {available}",
        )

    benchmark = load_benchmark(payload.paper_id)
    if benchmark is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No benchmark found for paper_id={payload.paper_id!r}. "
                f"Upload one via POST /benchmark first."
            ),
        )

    job_id = uuid.uuid4().hex
    total_units = len(benchmark.questions) * len(selected)
    job = JobState(
        job_id=job_id,
        paper_id=payload.paper_id,
        paper_title=benchmark.paper_title,
        pipeline_ids=selected,
        total_units=total_units,
    )
    register(job)

    asyncio.create_task(run_batch(job))

    return _to_status(job)


@router.get("/jobs", response_model=list[JobSummary])
def list_all_jobs() -> list[JobSummary]:
    return [_to_summary(j) for j in all_jobs()]


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str) -> JobStatus:
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Unknown job_id={job_id!r}")
    return _to_status(job)


@router.get("/jobs/{job_id}/results", response_model=JobResultsResponse)
def get_job_results(job_id: str) -> JobResultsResponse:
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Unknown job_id={job_id!r}")
    return JobResultsResponse(
        job_id=job.job_id,
        status=job.status,
        results=job.results,
    )


@router.post("/jobs/{job_id}/cancel", response_model=CancelResponse)
def cancel_job(job_id: str) -> CancelResponse:
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Unknown job_id={job_id!r}")
    if job.status in ("completed", "failed", "cancelled"):
        return CancelResponse(
            job_id=job.job_id, cancel_requested=False, status=job.status
        )
    job.cancel_requested = True
    return CancelResponse(
        job_id=job.job_id, cancel_requested=True, status=job.status
    )


@router.get("/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str) -> StreamingResponse:
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail=f"Unknown job_id={job_id!r}")

    async def event_gen() -> AsyncGenerator[str, None]:
        last_signature: tuple | None = None
        while True:
            job = JOBS.get(job_id)
            if job is None:
                break
            signature = (job.completed_units, job.status, job.current_pipeline_id)
            if signature != last_signature:
                payload = {
                    "status": job.status,
                    "completed": job.completed_units,
                    "total": job.total_units,
                    "current_question": job.current_question_id,
                    "current_pipeline": job.current_pipeline_id,
                }
                yield f"event: progress\ndata: {json.dumps(payload)}\n\n"
                last_signature = signature

            if job.status in ("completed", "failed", "cancelled"):
                final = {
                    "status": job.status,
                    "completed": job.completed_units,
                    "total": job.total_units,
                    "error": job.error,
                }
                yield f"event: done\ndata: {json.dumps(final)}\n\n"
                return

            await asyncio.sleep(_SSE_POLL_SECONDS)

    return StreamingResponse(event_gen(), media_type="text/event-stream")
