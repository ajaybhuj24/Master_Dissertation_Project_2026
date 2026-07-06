
from __future__ import annotations

import json

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import ValidationError

from ..evaluation.benchmark_loader import (
    benchmark_path,
    delete_benchmark,
    list_benchmarks,
    load_benchmark,
    save_benchmark,
)
from ..paths import PROJECT_ROOT
from ..schemas.benchmark import (
    BenchmarkFile,
    BenchmarkSummary,
    BenchmarkUploadResponse,
    PaperMismatchWarning,
)
from ..state import load_current_paper

router = APIRouter(tags=["benchmark"])


@router.post("/benchmark", response_model=BenchmarkUploadResponse)
async def upload_benchmark(
    file: UploadFile = File(..., description="A JSON file conforming to the §7.3 schema."),
) -> BenchmarkUploadResponse:
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        raw = json.loads(raw_bytes.decode("utf-8"))
    except UnicodeDecodeError as e:
        raise HTTPException(status_code=400, detail=f"File is not valid UTF-8: {e}") from e
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}") from e

    try:
        benchmark = BenchmarkFile.model_validate(raw)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail={"validation_errors": e.errors()}) from e

    saved_path = save_benchmark(benchmark)

    current = load_current_paper()
    mismatch: PaperMismatchWarning | None = None
    if current is not None and current.get("paper_id") != benchmark.paper_id:
        mismatch = PaperMismatchWarning(
            loaded_paper_id=current.get("paper_id"),
            benchmark_paper_id=benchmark.paper_id,
        )

    return BenchmarkUploadResponse(
        paper_id=benchmark.paper_id,
        paper_title=benchmark.paper_title,
        question_count=len(benchmark.questions),
        category_counts=benchmark.category_counts(),
        saved_path=str(saved_path.relative_to(PROJECT_ROOT)),
        paper_mismatch_warning=mismatch,
    )


@router.get("/benchmarks", response_model=list[BenchmarkSummary])
def list_all_benchmarks() -> list[BenchmarkSummary]:
    return list_benchmarks()


@router.get("/benchmarks/{paper_id}", response_model=BenchmarkFile)
def get_benchmark(paper_id: str) -> BenchmarkFile:
    benchmark = load_benchmark(paper_id)
    if benchmark is None:
        raise HTTPException(
            status_code=404,
            detail=f"No benchmark found for paper_id={paper_id!r}. "
            f"Expected file: {benchmark_path(paper_id).relative_to(PROJECT_ROOT)}",
        )
    return benchmark


@router.delete("/benchmarks/{paper_id}")
def remove_benchmark(paper_id: str) -> dict:
    if delete_benchmark(paper_id):
        return {"deleted": True, "paper_id": paper_id}
    raise HTTPException(
        status_code=404,
        detail=f"No benchmark found for paper_id={paper_id!r}",
    )
