
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm import get_chat_llm
from ..schemas.ask import PipelineResult, RetrievedContext
from .base import STAGE_POST, Pipeline, PipelineCtx
from .prompts import (
    COMPRESSION_NONE_SENTINEL,
    COMPRESSION_SYSTEM_PROMPT,
    COMPRESSION_USER_TEMPLATE,
    REFUSAL_STRING,
)


class ContextualCompressionPipeline(Pipeline):
    pipeline_id = "compression"
    pipeline_name = "Contextual Compression"
    stage = STAGE_POST
    namespace = "naive"

  
    FETCH_K = 8
   
    MAX_COMPRESSION_WORKERS = 8

    def run(self, question: str, ctx: PipelineCtx) -> PipelineResult:
        # --- 1) Over-fetch candidates ---
        t0 = self._now_ms()
        candidates = self._retrieve(question, ctx, k=self.FETCH_K)

        if not candidates:
            retrieval_ms = int(self._now_ms() - t0)
            return self._make_result(
                answer=REFUSAL_STRING,
                contexts=[],
                retrieval_ms=retrieval_ms,
                generation_ms=0,
                debug={"short_circuit": "no_contexts_retrieved"},
            )

        compressed_all = self._compress_parallel(question, candidates, ctx)
        
        contexts = [c for c in compressed_all if c.text.strip()]
        retrieval_ms = int(self._now_ms() - t0)
        dropped_count = len(compressed_all) - len(contexts)

        if not contexts:
           
            return self._make_result(
                answer=REFUSAL_STRING,
                contexts=[],
                retrieval_ms=retrieval_ms,
                generation_ms=0,
                debug={
                    "short_circuit": "all_chunks_compressed_to_none",
                    "fetch_k": self.FETCH_K,
                    "dropped_count": dropped_count,
                },
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
                "fetch_k": self.FETCH_K,
                "num_candidates_fetched": len(candidates),
                "num_contexts_after_compression": len(contexts),
                "dropped_count": dropped_count,
                "model": ctx.settings.llm_model,
                "embedding_model": ctx.settings.embedding_model,
            },
        )

    # ---- helpers ----

    def _compress_parallel(
        self,
        question: str,
        candidates: list[RetrievedContext],
        ctx: PipelineCtx,
    ) -> list[RetrievedContext]:
        """Run the per-chunk compression LLM calls concurrently in a thread pool."""
        workers = min(self.MAX_COMPRESSION_WORKERS, max(1, len(candidates)))
        with ThreadPoolExecutor(max_workers=workers) as executor:
            return list(
                executor.map(
                    lambda c: self._compress_one(question, c, ctx), candidates
                )
            )

    def _compress_one(
        self,
        question: str,
        candidate: RetrievedContext,
        ctx: PipelineCtx,
    ) -> RetrievedContext:
        """Ask the LLM to extract only relevant sentences from one chunk.

        Returns a new RetrievedContext with the compressed text; empty text
        means the chunk had nothing relevant (will be filtered upstream).
        On any LLM failure, falls back to the ORIGINAL text — better to keep
        a chunk than silently drop it on a transient API error.
        """
        llm = get_chat_llm(ctx.settings)
        try:
            response = llm.invoke([
                SystemMessage(content=COMPRESSION_SYSTEM_PROMPT),
                HumanMessage(content=COMPRESSION_USER_TEMPLATE.format(
                    question=question, passage=candidate.text
                )),
            ])
            raw = (
                response.content
                if isinstance(response.content, str)
                else str(response.content)
            )
            compressed = raw.strip()
          
            if compressed.strip(".").upper() == COMPRESSION_NONE_SENTINEL:
                compressed_text = ""
            else:
                compressed_text = compressed
        except Exception:
           
            compressed_text = candidate.text

        return RetrievedContext(
            text=compressed_text,
            source=candidate.source,
            page=candidate.page,
            score=candidate.score,
            metadata={
                **candidate.metadata,
                "original_length": len(candidate.text),
                "compressed_length": len(compressed_text),
            },
        )
