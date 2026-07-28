
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone

from ..config import get_settings
from ..corpus.store import CORPUS_NAMESPACE, list_corpus_papers
from ..deps import get_openai_client, get_pinecone_client
from ..evaluation.benchmark_loader import load_benchmark
from ..evaluation.ragas_runner import evaluate_one
from ..paths import CORPUS_SWEEPS_DIR
from ..pipelines.base import PipelineCtx
from ..pipelines.registry import get_pipeline
from ..schemas.benchmark import BenchmarkQuestion
from ..schemas.corpus import (
    SweepPipelineMeans,
    SweepPoint,
    SweepResult,
)
from ..jobs.store import JobState

logger = logging.getLogger(__name__)

DEFAULT_SWEEP_PIPELINES = ["naive", "mmr", "rerank", "crag"]

_METRICS = (
    "faithfulness",
    "answer_relevancy",
    "context_precision",
    "context_recall",
)


def compute_distractor_counts(
    n_available: int,
    explicit: list[int] | None = None,
    n_points: int = 7,
) -> list[int]:
    if explicit is not None:
        vals = sorted({c for c in explicit if 0 <= c <= n_available})
        return vals or [0]
    if n_available <= 0:
        return [0]
    steps = {round(i * n_available / (n_points - 1)) for i in range(n_points)}
    return sorted(steps)


async def run_sweep(
    job: JobState, distractor_counts: list[int], concurrency: int = 5
) -> None:
    try:
        await _run_sweep_impl(job, distractor_counts, concurrency)
    except Exception as e:
        logger.exception("Sweep %s crashed", job.job_id)
        job.mark_failed(repr(e))


async def _run_sweep_impl(
    job: JobState, distractor_counts: list[int], concurrency: int = 5
) -> None:
    settings = get_settings()

    benchmark = load_benchmark(job.paper_id)
    if benchmark is None:
        job.mark_failed(
            f"No benchmark found for target paper_id={job.paper_id!r}."
        )
        return

    papers = list_corpus_papers()
    target = next((p for p in papers if p["paper_id"] == job.paper_id), None)
    if target is None:
        job.mark_failed(
            f"Target paper_id={job.paper_id!r} is not in the corpus. "
            f"Add it via POST /corpus/papers first."
        )
        return
    distractors = [p for p in papers if p["paper_id"] != job.paper_id]

    ctx = PipelineCtx(
        settings=settings,
        openai_client=get_openai_client(),
        pinecone_client=get_pinecone_client(),
        top_k=settings.top_k,
        namespace_override=CORPUS_NAMESPACE,
    )

    job.mark_started()
    created_at = datetime.now(timezone.utc)
    points: list[SweepPoint] = []

    sem = asyncio.Semaphore(max(1, concurrency))

    async def _bounded_unit(
        pipeline_id: str, question: BenchmarkQuestion
    ) -> dict | None:
        async with sem:
            if job.cancel_requested:
                return None
            job.current_question_id = question.id
            job.current_pipeline_id = pipeline_id
            unit = await _run_unit(pipeline_id, question, ctx)
            job.completed_units += 1
            return unit

    for k in distractor_counts:
        if job.cancel_requested:
            job.mark_cancelled()
            return

        included = [target] + distractors[:k]
        paper_ids = [p["paper_id"] for p in included]
        cumulative_words = sum(p["word_count"] for p in included)
        ctx.retrieval_filter = {"paper_id": {"$in": paper_ids}}

        results = await asyncio.gather(
            *(
                _bounded_unit(pipeline_id, question)
                for question in benchmark.questions
                for pipeline_id in job.pipeline_ids
            )
        )
        if job.cancel_requested:
            job.mark_cancelled()
            return
        units = [u for u in results if u is not None]

        points.append(
            SweepPoint(
                n_distractors=k,
                n_papers=len(paper_ids),
                paper_ids=paper_ids,
                cumulative_word_count=cumulative_words,
                by_pipeline=_aggregate(units),
            )
        )

    job.current_question_id = None
    job.current_pipeline_id = None

    total_errors = sum(
        pm.n_errors for pt in points for pm in pt.by_pipeline.values()
    )
    result = SweepResult(
        sweep_id=job.job_id,
        target_paper_id=job.paper_id,
        target_paper_title=benchmark.paper_title,
        pipeline_ids=job.pipeline_ids,
        created_at=created_at.isoformat(),
        distractor_counts=distractor_counts,
        n_questions=len(benchmark.questions),
        total_units=job.total_units,
        total_errors=total_errors,
        points=points,
    )

    job.summary = result.model_dump()
    job.mark_completed()

    try:
        _persist_sweep(result, created_at)
    except Exception:
        logger.exception(
            "Auto-persist of sweep %s failed; result is still on job.summary.",
            job.job_id,
        )


async def _run_unit(
    pipeline_id: str,
    question: BenchmarkQuestion,
    ctx: PipelineCtx,
) -> dict:
    pipeline = get_pipeline(pipeline_id)
    blank = {m: None for m in _METRICS}

    t0 = time.perf_counter()
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None, pipeline.run, question.question, ctx
        )
    except Exception as e:
        logger.exception(
            "Sweep pipeline %s failed on question %s", pipeline_id, question.id
        )
        return {
            "pipeline_id": pipeline_id,
            "latency_ms": int((time.perf_counter() - t0) * 1000),
            "error": repr(e),
            **blank,
        }

    try:
        scores = await evaluate_one(
            question=question.question,
            answer=result.answer,
            contexts=[c.text for c in result.contexts],
            ground_truth=question.ground_truth,
            settings=ctx.settings,
        )
    except Exception as e:
        logger.exception(
            "Sweep RAGAS failed on (%s, %s)", pipeline_id, question.id
        )
        return {
            "pipeline_id": pipeline_id,
            "latency_ms": result.latency_ms,
            "error": repr(e),
            **blank,
        }

    return {
        "pipeline_id": pipeline_id,
        "latency_ms": result.latency_ms,
        "error": None,
        "faithfulness": scores.faithfulness,
        "answer_relevancy": scores.answer_relevancy,
        "context_precision": scores.context_precision,
        "context_recall": scores.context_recall,
    }


def _aggregate(units: list[dict]) -> dict[str, SweepPipelineMeans]:
    buckets: dict[str, dict] = {}
    for u in units:
        b = buckets.setdefault(
            u["pipeline_id"],
            {**{m: [] for m in _METRICS}, "latency_ms": [], "n_rows": 0, "n_errors": 0},
        )
        b["n_rows"] += 1
        if u["error"] is not None:
            b["n_errors"] += 1
            continue
        for m in _METRICS:
            if u[m] is not None:
                b[m].append(u[m])
        b["latency_ms"].append(u["latency_ms"])

    def _mean(xs: list[float]) -> float | None:
        return sum(xs) / len(xs) if xs else None

    return {
        pid: SweepPipelineMeans(
            n_rows=b["n_rows"],
            n_errors=b["n_errors"],
            faithfulness_mean=_mean(b["faithfulness"]),
            answer_relevancy_mean=_mean(b["answer_relevancy"]),
            context_precision_mean=_mean(b["context_precision"]),
            context_recall_mean=_mean(b["context_recall"]),
            latency_ms_mean=_mean(b["latency_ms"]),
        )
        for pid, b in buckets.items()
    }


def _persist_sweep(result: SweepResult, created_at: datetime) -> None:
    CORPUS_SWEEPS_DIR.mkdir(parents=True, exist_ok=True)
    ts = created_at.strftime("%Y%m%dT%H%M%S")
    fname = f"{ts}_{result.target_paper_id}_{result.sweep_id[:8]}.json"
    path = CORPUS_SWEEPS_DIR / fname
    path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    logger.info("Sweep %s persisted to %s", result.sweep_id, path)




def list_sweeps() -> list[dict]:
    if not CORPUS_SWEEPS_DIR.exists():
        return []
    out: list[dict] = []
    for path in sorted(CORPUS_SWEEPS_DIR.glob("*.json"), reverse=True):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            logger.warning("Skipping unparseable sweep file %s", path.name)
            continue
        out.append(
            {
                "sweep_id": raw.get("sweep_id", path.stem),
                "target_paper_id": raw.get("target_paper_id", ""),
                "target_paper_title": raw.get("target_paper_title", ""),
                "pipeline_ids": raw.get("pipeline_ids", []),
                "created_at": raw.get("created_at", ""),
                "n_questions": raw.get("n_questions", 0),
                "n_points": len(raw.get("points") or []),
                "total_units": raw.get("total_units", 0),
                "total_errors": raw.get("total_errors", 0),
                "filename": path.name,
            }
        )
    return out


def load_sweep(sweep_id: str) -> SweepResult | None:
    if not CORPUS_SWEEPS_DIR.exists():
        return None
    for path in sorted(CORPUS_SWEEPS_DIR.glob("*.json"), reverse=True):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if raw.get("sweep_id") == sweep_id:
            return SweepResult.model_validate(raw)
    return None


def delete_sweep(sweep_id: str) -> bool:
    if not CORPUS_SWEEPS_DIR.exists():
        return False
    for path in sorted(CORPUS_SWEEPS_DIR.glob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if raw.get("sweep_id") == sweep_id:
            path.unlink()
            return True
    return False
