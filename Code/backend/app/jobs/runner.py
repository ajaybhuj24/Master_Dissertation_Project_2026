
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from ..config import get_settings
from ..deps import get_openai_client, get_pinecone_client
from ..evaluation.benchmark_loader import load_benchmark
from ..evaluation.ragas_runner import evaluate_one
from ..evaluation.results_writer import write_job_results
from ..pipelines.base import PipelineCtx
from ..pipelines.registry import get_pipeline
from ..schemas.batch import BatchResultRow
from ..schemas.benchmark import BenchmarkCategory, BenchmarkQuestion
from .store import JobState

logger = logging.getLogger(__name__)


async def run_batch(job: JobState) -> None:
    try:
        await _run_batch_impl(job)
    except Exception as e:
        logger.exception("Batch %s crashed", job.job_id)
        job.mark_failed(repr(e))


async def _run_batch_impl(job: JobState) -> None:
    settings = get_settings()
    openai_client = get_openai_client()
    pinecone_client = get_pinecone_client()

    ctx = PipelineCtx(
        settings=settings,
        openai_client=openai_client,
        pinecone_client=pinecone_client,
        top_k=settings.top_k,
    )

    benchmark = load_benchmark(job.paper_id)
    if benchmark is None:
        job.mark_failed(
            f"No benchmark found for paper_id={job.paper_id!r}. "
            f"Upload one via POST /benchmark first."
        )
        return

    job.mark_started()
    run_timestamp = datetime.now(timezone.utc)

    for question in benchmark.questions:
        if job.cancel_requested:
            job.mark_cancelled()
            return
        job.current_question_id = question.id

        for pipeline_id in job.pipeline_ids:
            if job.cancel_requested:
                job.mark_cancelled()
                return
            job.current_pipeline_id = pipeline_id

            row = await _run_unit(
                pipeline_id=pipeline_id,
                question=question,
                ctx=ctx,
                job=job,
                benchmark_paper_title=benchmark.paper_title,
                run_timestamp=run_timestamp,
            )
            job.results.append(row)
            job.completed_units += 1

    job.current_question_id = None
    job.current_pipeline_id = None
    job.summary = _build_summary(job)
    job.mark_completed()

    try:
        write_job_results(
            rows=job.results,
            paper_id=job.paper_id,
            paper_title=job.paper_title,
            job_id=job.job_id,
            summary=job.summary,
        )
    except Exception:
        logger.exception(
            "Auto-persist of job %s failed; job state is still 'completed'. "
            "Re-trigger via POST /jobs/%s/persist after fixing.",
            job.job_id, job.job_id,
        )


async def _run_unit(
    pipeline_id: str,
    question: BenchmarkQuestion,
    ctx: PipelineCtx,
    job: JobState,
    benchmark_paper_title: str,
    run_timestamp: datetime,
) -> BatchResultRow:

    pipeline = get_pipeline(pipeline_id)

    pipeline_t0 = time.perf_counter()
    try:
        loop = asyncio.get_running_loop()
        pipeline_result = await loop.run_in_executor(
            None, pipeline.run, question.question, ctx
        )
    except Exception as e:
        logger.exception(
            "Pipeline %s failed on question %s", pipeline_id, question.id
        )
        return BatchResultRow(
            run_id=job.job_id,
            run_timestamp=run_timestamp,
            paper_id=job.paper_id,
            paper_title=benchmark_paper_title,
            question_id=question.id,
            question=question.question,
            category=question.category.value,
            pipeline_id=pipeline.pipeline_id,
            pipeline_name=pipeline.pipeline_name,
            stage=pipeline.stage,
            namespace=pipeline.namespace,
            answer="",
            contexts=[],
            retrieval_ms=0,
            generation_ms=0,
            latency_ms=int((time.perf_counter() - pipeline_t0) * 1000),
            ragas_ms=0,
            error=repr(e),
        )

    ragas_t0 = time.perf_counter()
    try:
        scores = await evaluate_one(
            question=question.question,
            answer=pipeline_result.answer,
            contexts=[c.text for c in pipeline_result.contexts],
            ground_truth=question.ground_truth,
            settings=ctx.settings,
        )
        ragas_ms = int((time.perf_counter() - ragas_t0) * 1000)
        ragas_errors = scores.errors
        ragas_skipped = scores.skipped
        faithfulness = scores.faithfulness
        answer_relevancy = scores.answer_relevancy
        context_precision = scores.context_precision
        context_recall = scores.context_recall
    except Exception as e:
        logger.exception(
            "RAGAS evaluation failed on (%s, %s)", pipeline_id, question.id
        )
        ragas_ms = int((time.perf_counter() - ragas_t0) * 1000)
        ragas_errors = {"_runner": repr(e)}
        ragas_skipped = []
        faithfulness = answer_relevancy = context_precision = context_recall = None

    return BatchResultRow(
        run_id=job.job_id,
        run_timestamp=run_timestamp,
        paper_id=job.paper_id,
        paper_title=benchmark_paper_title,
        question_id=question.id,
        question=question.question,
        category=question.category.value,
        pipeline_id=pipeline.pipeline_id,
        pipeline_name=pipeline.pipeline_name,
        stage=pipeline.stage,
        namespace=pipeline.namespace,
        answer=pipeline_result.answer,
        contexts=[c.text for c in pipeline_result.contexts],
        faithfulness=faithfulness,
        answer_relevancy=answer_relevancy,
        context_precision=context_precision,
        context_recall=context_recall,
        ragas_skipped=ragas_skipped,
        ragas_errors=ragas_errors,
        retrieval_ms=pipeline_result.retrieval_ms,
        generation_ms=pipeline_result.generation_ms,
        latency_ms=pipeline_result.latency_ms,
        ragas_ms=ragas_ms,
    )




def _build_summary(job: JobState) -> dict:
    by_pipeline: dict[str, dict] = {}
    by_stage: dict[str, dict] = {}

    for row in job.results:
        for bucket_key, bucket in (
            (row.pipeline_id, by_pipeline),
            (row.stage, by_stage),
        ):
            entry = bucket.setdefault(
                bucket_key,
                {
                    "faithfulness": [],
                    "answer_relevancy": [],
                    "context_precision": [],
                    "context_recall": [],
                    "latency_ms": [],
                    "ragas_ms": [],
                    "n_rows": 0,
                    "n_errors": 0,
                },
            )
            entry["n_rows"] += 1
            if row.error is not None:
                entry["n_errors"] += 1
                continue
            for metric in (
                "faithfulness",
                "answer_relevancy",
                "context_precision",
                "context_recall",
            ):
                value = getattr(row, metric)
                if value is not None:
                    entry[metric].append(value)
            entry["latency_ms"].append(row.latency_ms)
            entry["ragas_ms"].append(row.ragas_ms)

    def _mean(values: list[float]) -> float | None:
        return sum(values) / len(values) if values else None

    def _finalise(bucket: dict) -> dict:
        return {
            key: {
                "n_rows": entry["n_rows"],
                "n_errors": entry["n_errors"],
                "faithfulness_mean": _mean(entry["faithfulness"]),
                "answer_relevancy_mean": _mean(entry["answer_relevancy"]),
                "context_precision_mean": _mean(entry["context_precision"]),
                "context_recall_mean": _mean(entry["context_recall"]),
                "latency_ms_mean": _mean(entry["latency_ms"]),
                "ragas_ms_mean": _mean(entry["ragas_ms"]),
            }
            for key, entry in bucket.items()
        }

    return {
        "by_pipeline": _finalise(by_pipeline),
        "by_stage": _finalise(by_stage),
        "total_units": len(job.results),
        "total_errors": sum(1 for r in job.results if r.error is not None),
    }
