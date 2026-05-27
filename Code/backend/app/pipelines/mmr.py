

from __future__ import annotations

from ..schemas.ask import PipelineResult, RetrievedContext
from ..vectorstore.pinecone_store import get_vector_store
from .base import STAGE_DURING, Pipeline, PipelineCtx
from .prompts import REFUSAL_STRING


class MMRPipeline(Pipeline):
    pipeline_id = "mmr"
    pipeline_name = "MMR"
    stage = STAGE_DURING
    namespace = "naive"

    def run(self, question: str, ctx: PipelineCtx) -> PipelineResult:
        # --- 1) Retrieval with MMR re-selection ---
        t0 = self._now_ms()
        vector_store = get_vector_store(
            ctx.pinecone_client, ctx.settings, self.namespace
        )
        
        docs = vector_store.max_marginal_relevance_search(
            query=question,
            k=ctx.top_k,
            fetch_k=ctx.settings.mmr_fetch_k,
            lambda_mult=ctx.settings.mmr_lambda,
        )
      
        contexts: list[RetrievedContext] = [
            RetrievedContext(
                text=doc.page_content,
                source=doc.metadata.get("source"),
                page=doc.metadata.get("page"),
                score=None,
                metadata={
                    k: v
                    for k, v in doc.metadata.items()
                    if k not in {"source", "page"}
                },
            )
            for doc in docs
        ]
        retrieval_ms = int(self._now_ms() - t0)

        if not contexts:
            return self._make_result(
                answer=REFUSAL_STRING,
                contexts=[],
                retrieval_ms=retrieval_ms,
                generation_ms=0,
                debug={"short_circuit": "no_contexts_retrieved"},
            )

        # --- 2) Generation (shared with naive) ---
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
                "fetch_k": ctx.settings.mmr_fetch_k,
                "lambda_mult": ctx.settings.mmr_lambda,
                "num_contexts": len(contexts),
                "model": ctx.settings.llm_model,
                "embedding_model": ctx.settings.embedding_model,
            },
        )
