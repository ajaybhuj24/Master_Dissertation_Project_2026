
from __future__ import annotations

import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from ..paths import PROJECT_ROOT, RESULTS_DIR
from ..schemas.batch import BatchResultRow

logger = logging.getLogger(__name__)

MASTER_CSV: Path = RESULTS_DIR / "all_results.csv"

CSV_COLUMNS: list[str] = [
    "run_id",
    "run_timestamp",
    "paper_id",
    "paper_title",
    "question_id",
    "question",
    "category",
    "pipeline_id",
    "pipeline_name",
    "stage",
    "namespace",
    "answer",
    "faithfulness",
    "answer_relevancy",
    "context_precision",
    "context_recall",
    "ragas_skipped",
    "ragas_errors",
    "retrieval_ms",
    "generation_ms",
    "latency_ms",
    "ragas_ms",
    "error",
]


def _row_to_csv_dict(row: BatchResultRow) -> dict:
    return {
        "run_id": row.run_id,
        "run_timestamp": row.run_timestamp.isoformat(),
        "paper_id": row.paper_id,
        "paper_title": row.paper_title,
        "question_id": row.question_id,
        "question": row.question,
        "category": row.category,
        "pipeline_id": row.pipeline_id,
        "pipeline_name": row.pipeline_name,
        "stage": row.stage,
        "namespace": row.namespace,
        "answer": row.answer,
        "faithfulness": "" if row.faithfulness is None else row.faithfulness,
        "answer_relevancy": "" if row.answer_relevancy is None else row.answer_relevancy,
        "context_precision": "" if row.context_precision is None else row.context_precision,
        "context_recall": "" if row.context_recall is None else row.context_recall,
        "ragas_skipped": json.dumps(row.ragas_skipped) if row.ragas_skipped else "",
        "ragas_errors": json.dumps(row.ragas_errors) if row.ragas_errors else "",
        "retrieval_ms": row.retrieval_ms,
        "generation_ms": row.generation_ms,
        "latency_ms": row.latency_ms,
        "ragas_ms": row.ragas_ms,
        "error": row.error or "",
    }


def _append_to_master(rows: list[BatchResultRow]) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    file_existed = MASTER_CSV.exists() and MASTER_CSV.stat().st_size > 0
    with MASTER_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        if not file_existed:
            writer.writeheader()
        for row in rows:
            writer.writerow(_row_to_csv_dict(row))
    return MASTER_CSV


def _write_per_run_csv(rows: list[BatchResultRow], path: Path) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(_row_to_csv_dict(row))


def _write_per_run_json(
    rows: list[BatchResultRow],
    summary: dict | None,
    paper_id: str,
    paper_title: str,
    job_id: str,
    path: Path,
) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "job_id": job_id,
        "paper_id": paper_id,
        "paper_title": paper_title,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "results": [r.model_dump(mode="json") for r in rows],
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_job_results(
    rows: list[BatchResultRow],
    paper_id: str,
    paper_title: str,
    job_id: str,
    summary: dict | None = None,
) -> dict[str, str]:
    if not rows:
        return {"master_csv": "", "per_run_csv": "", "per_run_json": ""}

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    per_run_csv = RESULTS_DIR / f"{paper_id}_{ts}.csv"
    per_run_json = RESULTS_DIR / f"{paper_id}_{ts}.json"

    master_path = _append_to_master(rows)
    _write_per_run_csv(rows, per_run_csv)
    _write_per_run_json(rows, summary, paper_id, paper_title, job_id, per_run_json)

    return {
        "master_csv": str(master_path.relative_to(PROJECT_ROOT)),
        "per_run_csv": str(per_run_csv.relative_to(PROJECT_ROOT)),
        "per_run_json": str(per_run_json.relative_to(PROJECT_ROOT)),
    }
