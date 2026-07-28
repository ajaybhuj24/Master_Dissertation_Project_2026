
from __future__ import annotations

import asyncio
import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pinecone import Pinecone

from ..config import Settings, get_settings
from ..corpus.store import (
    CORPUS_NAMESPACE,
    clear_corpus,
    delete_corpus_pdf,
    ingest_corpus_pdf,
    list_corpus_papers,
    total_word_count,
)
from ..corpus.sweep import (
    DEFAULT_SWEEP_PIPELINES,
    compute_distractor_counts,
    delete_sweep,
    list_sweeps,
    load_sweep,
    run_sweep,
)
from ..deps import get_pinecone_client
from ..evaluation.benchmark_loader import load_benchmark
from ..jobs.store import JobState, register
from ..pipelines.registry import all_pipeline_ids
from ..schemas.batch import JobStatus
from ..schemas.corpus import (
    CorpusListResponse,
    CorpusPaper,
    SweepRequest,
    SweepResult,
    SweepSummary,
)

router = APIRouter(tags=["corpus"])


@router.post("/corpus/papers", response_model=CorpusPaper)
async def add_corpus_paper(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> CorpusPaper:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are accepted.")

    tmp_path: str | None = None
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            entry = ingest_corpus_pdf(
                pinecone_client, settings, tmp_path, file.filename
            )
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
        return CorpusPaper(**entry)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/corpus/papers", response_model=CorpusListResponse)
def get_corpus_papers() -> CorpusListResponse:
    papers = list_corpus_papers()
    return CorpusListResponse(
        papers=[CorpusPaper(**p) for p in papers],
        total_papers=len(papers),
        total_word_count=total_word_count(),
    )


@router.delete("/corpus/papers/{paper_id}")
def remove_corpus_paper(
    paper_id: str,
    settings: Settings = Depends(get_settings),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> dict:
    if delete_corpus_pdf(pinecone_client, settings, paper_id):
        return {"deleted": True, "paper_id": paper_id}
    raise HTTPException(status_code=404, detail=f"No corpus paper {paper_id!r}")


@router.delete("/corpus")
def clear_all_corpus(
    settings: Settings = Depends(get_settings),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> dict:
    n = clear_corpus(pinecone_client, settings)
    return {"cleared": True, "removed_papers": n, "namespace": CORPUS_NAMESPACE}


@router.post("/corpus/sweep", response_model=JobStatus, status_code=202)
async def submit_sweep(payload: SweepRequest) -> JobStatus:
    papers = list_corpus_papers()
    if not any(p["paper_id"] == payload.target_paper_id for p in papers):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Target paper_id={payload.target_paper_id!r} is not in the "
                f"corpus. Add it via POST /corpus/papers first."
            ),
        )

    benchmark = load_benchmark(payload.target_paper_id)
    if benchmark is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No benchmark found for target paper_id="
                f"{payload.target_paper_id!r}. Upload one via POST /benchmark."
            ),
        )

    available = all_pipeline_ids()
    selected = payload.pipeline_ids or [
        pid for pid in DEFAULT_SWEEP_PIPELINES if pid in available
    ]
    if not selected:
        raise HTTPException(status_code=400, detail="No pipelines to run.")
    unknown = [pid for pid in selected if pid not in available]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown pipeline_id(s): {unknown}. Available: {available}",
        )

    n_distractors = len(papers) - 1
    steps = compute_distractor_counts(
        n_distractors, payload.distractor_counts, payload.n_points
    )

    job_id = uuid.uuid4().hex
    total_units = len(steps) * len(benchmark.questions) * len(selected)
    job = JobState(
        job_id=job_id,
        paper_id=payload.target_paper_id,
        paper_title=benchmark.paper_title,
        pipeline_ids=selected,
        total_units=total_units,
    )
    register(job)
    asyncio.create_task(run_sweep(job, steps, payload.concurrency))

    return JobStatus(
        job_id=job.job_id,
        status=job.status,
        paper_id=job.paper_id,
        pipeline_ids=job.pipeline_ids,
        total_units=job.total_units,
        completed_units=job.completed_units,
        started_at=job.started_at,
        finished_at=job.finished_at,
        error=job.error,
        summary=job.summary,
    )




@router.get("/corpus/sweeps", response_model=list[SweepSummary])
def get_sweeps() -> list[SweepSummary]:
    return [SweepSummary(**s) for s in list_sweeps()]


@router.get("/corpus/sweeps/{sweep_id}", response_model=SweepResult)
def get_sweep(sweep_id: str) -> SweepResult:
    result = load_sweep(sweep_id)
    if result is None:
        raise HTTPException(
            status_code=404, detail=f"No sweep with id {sweep_id!r}"
        )
    return result


@router.delete("/corpus/sweeps/{sweep_id}")
def remove_sweep(sweep_id: str) -> dict:
    if delete_sweep(sweep_id):
        return {"deleted": True, "sweep_id": sweep_id}
    raise HTTPException(status_code=404, detail=f"No sweep with id {sweep_id!r}")
