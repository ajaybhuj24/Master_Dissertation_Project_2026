from __future__ import annotations

from ..schemas.ask import PipelineResult
from .base import STAGE_BASELINE, Pipeline, PipelineCtx
from .prompts import REFUSAL_STRING


class NaivePipeline(Pipeline):
    pipeline_id = "naive"
    pipeline_name = "Naive RAG"
    stage = STAGE_BASELINE
    namespace = "naive"

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
        answer = self._generate(question, contexts, ctx)
        generation_ms = int(self._now_ms() - t1)

        return self._make_result(
            answer=answer,
            contexts=contexts,
            retrieval_ms=retrieval_ms,
            generation_ms=generation_ms,
            debug={
                "top_k": ctx.top_k,
                "num_contexts": len(contexts),
                "model": ctx.settings.llm_model,
                "embedding_model": ctx.settings.embedding_model,
            },
        )
