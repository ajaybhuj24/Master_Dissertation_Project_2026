
from __future__ import annotations

import csv
import logging

from .results_writer import MASTER_CSV

logger = logging.getLogger(__name__)

_METRIC_FIELDS = (
    "faithfulness",
    "answer_relevancy",
    "context_precision",
    "context_recall",
)


def _to_float(raw: str | None) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _to_int(raw: str | None, default: int = 0) -> int:
    if raw is None or raw == "":
        return default
    try:
        return int(float(raw))
    except ValueError:
        return default


def read_master_rows(dedup: str = "latest") -> dict | None:
    if not MASTER_CSV.exists():
        return None

    with MASTER_CSV.open(newline="", encoding="utf-8-sig") as f:
        raw_rows = [r for r in csv.DictReader(f) if r.get("run_id")]

    total_rows = len(raw_rows)

    if dedup == "latest":
        latest: dict[str, tuple[str, str]] = {}
        for r in raw_rows:
            pid = r.get("paper_id", "")
            ts = r.get("run_timestamp", "")
            if pid not in latest or ts > latest[pid][0]:
                latest[pid] = (ts, r["run_id"])
        keep = {run_id for _, run_id in latest.values()}
        included = [r for r in raw_rows if r["run_id"] in keep]
    else:
        included = raw_rows

    runs: dict[str, dict] = {}
    rows: list[dict] = []
    for r in included:
        meta = runs.setdefault(
            r["run_id"],
            {
                "run_id": r["run_id"],
                "paper_id": r.get("paper_id", ""),
                "paper_title": r.get("paper_title", ""),
                "run_timestamp": r.get("run_timestamp", ""),
                "n_rows": 0,
            },
        )
        meta["n_rows"] += 1
        rows.append(
            {
                "paper_id": r.get("paper_id", ""),
                "run_id": r["run_id"],
                "run_timestamp": r.get("run_timestamp", ""),
                "question_id": r.get("question_id", ""),
                "category": r.get("category", ""),
                "pipeline_id": r.get("pipeline_id", ""),
                "pipeline_name": r.get("pipeline_name", ""),
                "stage": r.get("stage", ""),
                "namespace": r.get("namespace", ""),
                **{m: _to_float(r.get(m)) for m in _METRIC_FIELDS},
                "latency_ms": _to_int(r.get("latency_ms")),
                "error": r.get("error") or None,
            }
        )

    return {
        "dedup": dedup,
        "total_rows": total_rows,
        "included_rows": len(rows),
        "runs": sorted(
            runs.values(), key=lambda m: m["run_timestamp"], reverse=True
        ),
        "rows": rows,
    }
