
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
# Local: master-CSV reader/writer, the in-memory job store, filesystem paths and the response schema
from ..evaluation.master_reader import read_master_rows
from ..evaluation.results_writer import MASTER_CSV, write_job_results
from ..jobs.store import JOBS
from ..paths import PROJECT_ROOT, RESULTS_DIR
from ..schemas.results import MasterRowsResponse
# Router for results downloads and job-result persistence
router = APIRouter(tags=["results"])



# Download the master append-only CSV of every result row
@router.get("/results/master")
def download_master_csv() -> FileResponse:
    if not MASTER_CSV.exists():
        raise HTTPException(
            status_code=404,
            detail="No master CSV yet. Run a batch via POST /batch first.",
        )
    return FileResponse(
        MASTER_CSV,
        media_type="text/csv",
        filename="all_results.csv",
    )

# Return non duplicate master rows for the all-papers view
@router.get("/results/master/rows", response_model=MasterRowsResponse)
def master_rows(dedup: Literal["latest", "none"] = "latest") -> MasterRowsResponse:
    data = read_master_rows(dedup)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail="No master CSV yet. Run a batch via POST /batch first.",
        )
    return MasterRowsResponse(**data)


@router.get("/results/files")
def list_result_files() -> list[dict]:
    if not RESULTS_DIR.exists():
        return []
    entries: list[dict] = []
    for path in RESULTS_DIR.iterdir():
        if not path.is_file():
            continue
        stat = path.stat()
        entries.append({
            "filename": path.name,
            "size_bytes": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    entries.sort(key=lambda e: e["modified_at"], reverse=True)
    return entries

# Download one result file by name
@router.get("/results/files/{filename}")
def download_result_file(filename: str) -> FileResponse:
    target = RESULTS_DIR / filename
    try:
        target.resolve().relative_to(RESULTS_DIR.resolve())
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail="Invalid filename — path traversal blocked.",
        ) from e
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    media_type = "text/csv" if filename.lower().endswith(".csv") else "application/json"
    return FileResponse(target, media_type=media_type, filename=filename)




@router.post("/jobs/{job_id}/persist")
def persist_job(job_id: str) -> dict:
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Unknown job_id={job_id!r}")
    if job.status != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Job is {job.status!r}, not 'completed'. Refusing to persist a partial run.",
        )
    paths = write_job_results(
        rows=job.results,
        paper_id=job.paper_id,
        paper_title=job.paper_title,
        job_id=job.job_id,
        summary=job.summary,
    )
    return {"job_id": job_id, "written": paths}
