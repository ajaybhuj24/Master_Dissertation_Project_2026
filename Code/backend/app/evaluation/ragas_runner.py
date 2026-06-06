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
    llm, embeddings = _build_ragas_components(settings)
    scores = RagasScores()

    async def _faithfulness() -> float:
        sample = SingleTurnSample(
            user_input=question, response=answer, retrieved_contexts=contexts
        )
        return await Faithfulness(llm=llm).single_turn_ascore(sample)

    async def _answer_relevancy() -> float:
        sample = SingleTurnSample(
            user_input=question, response=answer, retrieved_contexts=contexts
        )
        return await ResponseRelevancy(llm=llm, embeddings=embeddings).single_turn_ascore(sample)

    async def _context_precision() -> float:
        sample = SingleTurnSample(
            user_input=question, retrieved_contexts=contexts, reference=ground_truth
        )
        return await LLMContextPrecisionWithReference(llm=llm).single_turn_ascore(sample)

    async def _context_recall() -> float:
        sample = SingleTurnSample(
            user_input=question,
            response=answer,
            retrieved_contexts=contexts,
            reference=ground_truth,
        )
        return await LLMContextRecall(llm=llm).single_turn_ascore(sample)

    tasks: dict[str, object] = {
        "faithfulness": _faithfulness(),
        "answer_relevancy": _answer_relevancy(),
    }
    if ground_truth is None:
        scores.skipped.extend(["context_precision", "context_recall"])
    else:
        tasks["context_precision"] = _context_precision()
        tasks["context_recall"] = _context_recall()

    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    for metric_name, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            logger.exception("%s scoring failed", metric_name, exc_info=result)
            scores.errors[metric_name] = repr(result)
        else:
            setattr(scores, metric_name, float(result))

    return scores


def evaluate_one_sync(
    question: str,
    answer: str,
    contexts: list[str],
    ground_truth: str | None,
    settings: Settings,
) -> RagasScores:
    return asyncio.run(
        evaluate_one(question, answer, contexts, ground_truth, settings)
    )
