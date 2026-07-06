
from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor

from langchain_core.messages import HumanMessage, SystemMessage

from ..embeddings import get_embeddings
from ..llm import get_chat_llm
from ..schemas.ask import PipelineResult, RetrievedContext
from .base import STAGE_POST, Pipeline, PipelineCtx
from .prompts import (
    RAG_SYSTEM_PROMPT,
    RAG_USER_TEMPLATE,
    REFUSAL_STRING,
    format_context,
)


class SelfCheckPipeline(Pipeline):
    pipeline_id = "selfcheck"
    pipeline_name = "SelfCheckGPT"
    stage = STAGE_POST
    namespace = "naive"

    NUM_SAMPLES = 3
    SAMPLE_TEMPERATURE = 0.7
    CONFIDENCE_THRESHOLD = 0.85
    LOW_CONFIDENCE_PREFIX = (
        "[Low confidence: stochastic resampling produced inconsistent answers "
        "— treat with caution.]\n\n"
    )

    def run(self, question: str, ctx: PipelineCtx) -> PipelineResult:
        t0 = self._now_ms()
        contexts = self._retrieve(question, ctx)
        retrieval_ms = int(self._now_ms() - t0)

        if not contexts:
            return self._make_result(
                answer=REFUSAL_STRING,
                contexts=[],
                retrieval_ms=retrieval_ms,
                generation_ms=0,
                debug={"short_circuit": "no_contexts_retrieved"},
            )

        t1 = self._now_ms()
        main_answer = self._generate(question, contexts, ctx)
        samples = self._generate_samples_parallel(question, contexts, ctx)
        generation_ms = int(self._now_ms() - t1)

        if main_answer == REFUSAL_STRING:
            return self._make_result(
                answer=main_answer,
                contexts=contexts,
                retrieval_ms=retrieval_ms,
                generation_ms=generation_ms,
                debug={
                    "consistency_skipped": "main_answer_is_refusal",
                    "num_samples": len(samples),
                    "sample_temperature": self.SAMPLE_TEMPERATURE,
                    "model": ctx.settings.llm_model,
                    "embedding_model": ctx.settings.embedding_model,
                },
            )

        valid_samples = [s for s in samples if s and s.strip()]
        consistency_score, per_sample_sims = self._consistency(
            main_answer, valid_samples, ctx
        )

        low_confidence = (
            consistency_score is not None
            and consistency_score < self.CONFIDENCE_THRESHOLD
        )
        final_answer = (
            self.LOW_CONFIDENCE_PREFIX + main_answer
            if low_confidence
            else main_answer
        )

        return self._make_result(
            answer=final_answer,
            contexts=contexts,
            retrieval_ms=retrieval_ms,
            generation_ms=generation_ms,
            debug={
                "main_answer_raw": main_answer,
                "consistency_score": consistency_score,
                "per_sample_similarities": per_sample_sims,
                "low_confidence": low_confidence,
                "threshold": self.CONFIDENCE_THRESHOLD,
                "stochastic_samples": samples,
                "num_samples": len(samples),
                "valid_sample_count": len(valid_samples),
                "sample_temperature": self.SAMPLE_TEMPERATURE,
                "model": ctx.settings.llm_model,
                "embedding_model": ctx.settings.embedding_model,
            },
        )


    def _generate_samples_parallel(
        self,
        question: str,
        contexts: list[RetrievedContext],
        ctx: PipelineCtx,
    ) -> list[str]:
        passages = [c.text for c in contexts]
        user_msg = RAG_USER_TEMPLATE.format(
            context=format_context(passages), question=question
        )
        shared_llm = get_chat_llm(ctx.settings, temperature=self.SAMPLE_TEMPERATURE)

        def sample_once(_: int) -> str:
            try:
                response = shared_llm.invoke([
                    SystemMessage(content=RAG_SYSTEM_PROMPT),
                    HumanMessage(content=user_msg),
                ])
                content = (
                    response.content
                    if isinstance(response.content, str)
                    else str(response.content)
                )
                return content.strip()
            except Exception:
                return ""

        with ThreadPoolExecutor(max_workers=self.NUM_SAMPLES) as executor:
            return list(executor.map(sample_once, range(self.NUM_SAMPLES)))

    def _consistency(
        self,
        main_answer: str,
        samples: list[str],
        ctx: PipelineCtx,
    ) -> tuple[float | None, list[float]]:
        if not samples:
            return None, []
        embeddings_client = get_embeddings(ctx.settings)
        vectors = embeddings_client.embed_documents([main_answer, *samples])
        main_vec = vectors[0]
        sample_vecs = vectors[1:]
        sims = [self._cosine(main_vec, sv) for sv in sample_vecs]
        mean = sum(sims) / len(sims)
        return mean, sims

    @staticmethod
    def _cosine(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return dot / (norm_a * norm_b)
