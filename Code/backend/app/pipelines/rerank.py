

from __future__ import annotations

from typing import TYPE_CHECKING

from ..schemas.ask import PipelineResult, RetrievedContext
from .base import STAGE_DURING, Pipeline, PipelineCtx
from .prompts import REFUSAL_STRING

if TYPE_CHECKING:
    from sentence_transformers import CrossEncoder


class RerankPipeline(Pipeline):
    pipeline_id = "rerank"
    pipeline_name = "Cross-Encoder Re-rank"
    stage = STAGE_DURING
    namespace = "naive"


    _encoder: "CrossEncoder | None" = None
    _encoder_name: str | None = None

    @classmethod
    def _get_encoder(cls, model_name: str) -> "CrossEncoder":
      
        if cls._encoder is None or cls._encoder_name != model_name:
            from sentence_transformers import CrossEncoder

            cls._encoder = CrossEncoder(model_name)
            cls._encoder_name = model_name
        return cls._encoder

    def run(self, question: str, ctx: PipelineCtx) -> PipelineResult:
        
        t0 = self._now_ms()
        candidates = self._retrieve(
            question, ctx, k=ctx.settings.rerank_fetch_k
        )

        if not candidates:
            retrieval_ms = int(self._now_ms() - t0)
            return self._make_result(
                answer=REFUSAL_STRING,
                contexts=[],
                retrieval_ms=retrieval_ms,
                generation_ms=0,
                debug={"short_circuit": "no_contexts_retrieved"},
            )

       
        encoder = self._get_encoder(ctx.settings.rerank_model)
        pairs = [[question, c.text] for c in candidates]
        ce_scores = encoder.predict(pairs)

       
        rescored: list[RetrievedContext] = []
        for c, ce_score in zip(candidates, ce_scores):
            rescored.append(
                RetrievedContext(
                    text=c.text,
                    source=c.source,
                    page=c.page,
                    score=float(ce_score),
                    metadata={
                        **c.metadata,
                        "bi_encoder_score": c.score,
                    },
                )
            )

        # Keep top-k by cross-encoder score.
        contexts = sorted(rescored, key=lambda x: x.score or 0.0, reverse=True)[
            : ctx.top_k
        ]
        retrieval_ms = int(self._now_ms() - t0)

        #  Generation (shared with naive) ---
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
                "fetch_k": ctx.settings.rerank_fetch_k,
                "rerank_model": ctx.settings.rerank_model,
                "num_candidates_reranked": len(candidates),
                "num_contexts": len(contexts),
                "model": ctx.settings.llm_model,
                "embedding_model": ctx.settings.embedding_model,
            },
        )
