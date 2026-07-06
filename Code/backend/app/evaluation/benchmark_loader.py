
from __future__ import annotations

import json
from pathlib import Path

from ..paths import BENCHMARKS_DIR
from ..schemas.benchmark import BenchmarkFile, BenchmarkSummary


def benchmark_path(paper_id: str) -> Path:
    return BENCHMARKS_DIR / f"{paper_id}.json"


def save_benchmark(benchmark: BenchmarkFile) -> Path:
    BENCHMARKS_DIR.mkdir(parents=True, exist_ok=True)
    path = benchmark_path(benchmark.paper_id)
    path.write_text(benchmark.model_dump_json(indent=2), encoding="utf-8")
    return path


def load_benchmark(paper_id: str) -> BenchmarkFile | None:
    path = benchmark_path(paper_id)
    if not path.exists():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    return BenchmarkFile.model_validate(raw)


def list_benchmarks() -> list[BenchmarkSummary]:
    if not BENCHMARKS_DIR.exists():
        return []
    summaries: list[BenchmarkSummary] = []
    for path in sorted(BENCHMARKS_DIR.glob("*.json")):
        if path.name.startswith("_"):
            continue
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            summaries.append(
                BenchmarkSummary(
                    paper_id=raw.get("paper_id", path.stem),
                    paper_title=raw.get("paper_title", path.stem),
                    created_at=raw.get("created_at"),
                    question_count=len(raw.get("questions") or []),
                    filename=path.name,
                )
            )
        except Exception:
            continue
    return summaries


def delete_benchmark(paper_id: str) -> bool:
    path = benchmark_path(paper_id)
    if path.exists():
        path.unlink()
        return True
    return False
