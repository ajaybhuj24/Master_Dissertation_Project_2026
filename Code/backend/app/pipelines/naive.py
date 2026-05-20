

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm import get_chat_llm
from ..schemas.ask import PipelineResult, RetrievedContext
from ..vectorstore.pinecone_store import get_vector_store
from .base import STAGE_BASELINE, Pipeline, PipelineCtx
from .prompts import RAG_SYSTEM_PROMPT, RAG_USER_TEMPLATE, format_context


class NaivePipeline(Pipeline):
    pipeline_id = "naive"
    pipeline_name = "Naive RAG"
    stage = STAGE_BASELINE
    namespace = "naive"

    def run(self, question: str, ctx: PipelineCtx) -> PipelineResult:
        # --- 1) Retrieval ---
        t0 = self._now_ms()
        vector_store = get_vector_store(
            ctx.pinecone_client, ctx.settings, self.namespace
        )
    
        docs_with_scores = vector_store.similarity_search_with_score(
            question, k=ctx.top_k
        )
        retrieval_ms = int(self._now_ms() - t0)

        contexts: list[RetrievedContext] = [
            RetrievedContext(
                text=doc.page_content,
                source=doc.metadata.get("source"),
                page=doc.metadata.get("page"),
                score=float(score),
                metadata={
                    k: v
                    for k, v in doc.metadata.items()
                    if k not in {"source", "page"}
                },
            )
            for doc, score in docs_with_scores
        ]

        # --- 2) Generation ---
        t1 = self._now_ms()
        if not contexts:
            
            from .prompts import REFUSAL_STRING

            return self._make_result(
                answer=REFUSAL_STRING,
                contexts=[],
                retrieval_ms=retrieval_ms,
                generation_ms=0,
                debug={"short_circuit": "no_contexts_retrieved"},
            )

        passages = [c.text for c in contexts]
        user_msg = RAG_USER_TEMPLATE.format(
            context=format_context(passages),
            question=question,
        )
        llm = get_chat_llm(ctx.settings)
        response = llm.invoke([
            SystemMessage(content=RAG_SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])
        answer = response.content.strip() if isinstance(response.content, str) else str(response.content)
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
