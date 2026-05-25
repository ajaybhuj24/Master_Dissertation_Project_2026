

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage

from ..config import Settings
from ..llm import get_chat_llm
from ..schemas.ask import PipelineResult, RetrievedContext
from ..vectorstore.pinecone_store import get_vector_store
from .prompts import RAG_SYSTEM_PROMPT, RAG_USER_TEMPLATE, format_context

if TYPE_CHECKING:
    from openai import OpenAI
    from pinecone import Pinecone



STAGE_BASELINE = "baseline"
STAGE_PRE = "pre_retrieval"
STAGE_DURING = "during_retrieval"
STAGE_POST = "post_retrieval"


@dataclass
class PipelineCtx:
  

    settings: Settings
    openai_client: OpenAI
    pinecone_client: Pinecone
    top_k: int


class Pipeline(ABC):
  

    pipeline_id: str
    pipeline_name: str
    stage: str
    namespace: str = "naive"

    @abstractmethod
    def run(self, question: str, ctx: PipelineCtx) -> PipelineResult:
      
        raise NotImplementedError

    # ---- timing ----

    @staticmethod
    def _now_ms() -> float:
        return time.perf_counter() * 1000.0

    # ---- retrieval ----

    @staticmethod
    def _to_context(doc: Document, score: float) -> RetrievedContext:
        
        return RetrievedContext(
            text=doc.page_content,
            source=doc.metadata.get("source"),
            page=doc.metadata.get("page"),
            score=float(score),
            metadata={
                k: v for k, v in doc.metadata.items() if k not in {"source", "page"}
            },
        )

    def _retrieve(
        self,
        query: str,
        ctx: PipelineCtx,
        namespace: str | None = None,
        k: int | None = None,
    ) -> list[RetrievedContext]:
       
        ns = namespace if namespace is not None else self.namespace
        k = k if k is not None else ctx.top_k
        vector_store = get_vector_store(ctx.pinecone_client, ctx.settings, ns)
        docs_with_scores = vector_store.similarity_search_with_score(query, k=k)
        return [self._to_context(doc, score) for doc, score in docs_with_scores]

    # ---- generation ----

    def _generate(
        self,
        question: str,
        contexts: list[RetrievedContext],
        ctx: PipelineCtx,
    ) -> str:
        
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
        if isinstance(response.content, str):
            return response.content.strip()
        return str(response.content).strip()

    # ---- result construction ----

    def _make_result(
        self,
        answer: str,
        contexts: list[RetrievedContext],
        retrieval_ms: int,
        generation_ms: int,
        debug: dict | None = None,
    ) -> PipelineResult:
        return PipelineResult(
            pipeline_id=self.pipeline_id,
            pipeline_name=self.pipeline_name,
            stage=self.stage,
            namespace=self.namespace,
            answer=answer,
            contexts=contexts,
            retrieval_ms=retrieval_ms,
            generation_ms=generation_ms,
            latency_ms=retrieval_ms + generation_ms,
            debug=debug or {},
        )
