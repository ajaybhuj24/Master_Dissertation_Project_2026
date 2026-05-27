
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from ragas import SingleTurnSample
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import (
    Faithfulness,
    LLMContextPrecisionWithReference,
    LLMContextRecall,
    ResponseRelevancy,
)

from ..config import Settings
from ..embeddings import get_embeddings
from ..llm import get_chat_llm
from ..schemas.evaluation import RagasScores

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


def _build_ragas_components(settings: Settings):
    """Wrap our existing LangChain clients so RAGAS uses the same models + key."""
    llm = LangchainLLMWrapper(get_chat_llm(settings))
    embeddings = LangchainEmbeddingsWrapper(get_embeddings(settings))
    return llm, embeddings


async def evaluate_one(
    question: str,
    answer: str,
    contexts: list[str],
    ground_truth: str | None,
    settings: Settings,
) -> RagasScores:
    """Score one (question, answer, contexts, ground_truth) tuple.

    Each metric is run independently inside its own try/except — one failing
    metric does NOT skip the others. Failures land in `scores.errors`.

    When ground_truth is None (out-of-scope benchmark question), context_precision
    and context_recall are SKIPPED rather than errored, since they're undefined
    without a reference.
    """
    llm, embeddings = _build_ragas_components(settings)
    scores = RagasScores()

    # --- 1. Faithfulness: needs (question, answer, contexts). No reference. ---
    try:
        sample = SingleTurnSample(
            user_input=question,
            response=answer,
            retrieved_contexts=contexts,
        )
        metric = Faithfulness(llm=llm)
        score = await metric.single_turn_ascore(sample)
        scores.faithfulness = float(score)
    except Exception as e:
        logger.exception("Faithfulness scoring failed")
        scores.errors["faithfulness"] = repr(e)

    # --- 2. Answer Relevancy: needs (question, answer, contexts) + embeddings. ---
    try:
        sample = SingleTurnSample(
            user_input=question,
            response=answer,
            retrieved_contexts=contexts,
        )
        metric = ResponseRelevancy(llm=llm, embeddings=embeddings)
        score = await metric.single_turn_ascore(sample)
        scores.answer_relevancy = float(score)
    except Exception as e:
        logger.exception("Answer relevancy scoring failed")
        scores.errors["answer_relevancy"] = repr(e)

    # --- 3 + 4. Context Precision + Recall: require reference. ---
    if ground_truth is None:
        scores.skipped.extend(["context_precision", "context_recall"])
        return scores

    try:
        sample = SingleTurnSample(
            user_input=question,
            retrieved_contexts=contexts,
            reference=ground_truth,
        )
        metric = LLMContextPrecisionWithReference(llm=llm)
        score = await metric.single_turn_ascore(sample)
        scores.context_precision = float(score)
    except Exception as e:
        logger.exception("Context precision scoring failed")
        scores.errors["context_precision"] = repr(e)

    try:
        sample = SingleTurnSample(
            user_input=question,
            response=answer,
            retrieved_contexts=contexts,
            reference=ground_truth,
        )
        metric = LLMContextRecall(llm=llm)
        score = await metric.single_turn_ascore(sample)
        scores.context_recall = float(score)
    except Exception as e:
        logger.exception("Context recall scoring failed")
        scores.errors["context_recall"] = repr(e)

    return scores


def evaluate_one_sync(
    question: str,
    answer: str,
    contexts: list[str],
    ground_truth: str | None,
    settings: Settings,
) -> RagasScores:
    """Synchronous wrapper for fully-sync callers (scripts, tests).

    WARNING: this calls asyncio.run() internally — do NOT use from inside
    a FastAPI request handler or any other context where an event loop is
    already running. Use `await evaluate_one(...)` there instead.
    """
    return asyncio.run(
        evaluate_one(question, answer, contexts, ground_truth, settings)
    )
