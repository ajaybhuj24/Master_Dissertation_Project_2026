

from __future__ import annotations

import re

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm import get_chat_llm
from ..schemas.ask import PipelineResult, RetrievedContext
from .base import STAGE_PRE, Pipeline, PipelineCtx
from .prompts import (
    MULTI_QUERY_SYSTEM_PROMPT,
    MULTI_QUERY_USER_TEMPLATE,
    REFUSAL_STRING,
)


_LIST_PREFIX = re.compile(r"^\s*(?:\d+[.)]\s*|[-*]\s+)")


class MultiQueryPipeline(Pipeline):
    pipeline_id = "multi_query"
    pipeline_name = "Multi-Query Retrieval"
    stage = STAGE_PRE
    namespace = "naive"

    num_paraphrases = 3

    def run(self, question: str, ctx: PipelineCtx) -> PipelineResult:
       
        t0 = self._now_ms()
        paraphrases = self._generate_paraphrases(question, ctx)
        all_queries = [question, *paraphrases]

      
        merged: dict[str, RetrievedContext] = {}
        total_retrieved = 0
        for query in all_queries:
            for rc in self._retrieve(query, ctx):
                total_retrieved += 1
                existing = merged.get(rc.text)
                if existing is None or (rc.score or 0.0) > (existing.score or 0.0):
                    merged[rc.text] = rc

       
        contexts = sorted(
            merged.values(), key=lambda c: c.score or 0.0, reverse=True
        )[: ctx.top_k]
        retrieval_ms = int(self._now_ms() - t0)

        if not contexts:
            return self._make_result(
                answer=REFUSAL_STRING,
                contexts=[],
                retrieval_ms=retrieval_ms,
                generation_ms=0,
                debug={
                    "short_circuit": "no_contexts_retrieved",
                    "generated_queries": all_queries,
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
                "top_k": ctx.top_k,
                "num_contexts": len(contexts),
                "generated_queries": all_queries,
                "num_paraphrases": len(paraphrases),
                "total_retrieved_before_dedup": total_retrieved,
                "unique_after_dedup": len(merged),
                "model": ctx.settings.llm_model,
                "embedding_model": ctx.settings.embedding_model,
            },
        )

    def _generate_paraphrases(self, question: str, ctx: PipelineCtx) -> list[str]:
     
        llm = get_chat_llm(ctx.settings)
        try:
            response = llm.invoke([
                SystemMessage(content=MULTI_QUERY_SYSTEM_PROMPT),
                HumanMessage(content=MULTI_QUERY_USER_TEMPLATE.format(
                    n=self.num_paraphrases, question=question
                )),
            ])
            raw = (
                response.content
                if isinstance(response.content, str)
                else str(response.content)
            )
        except Exception:
            return []

        paraphrases: list[str] = []
        seen: set[str] = {question.strip().lower()}
        for line in raw.splitlines():
            cleaned = _LIST_PREFIX.sub("", line).strip()
            key = cleaned.lower()
           
            if cleaned and key not in seen:
                seen.add(key)
                paraphrases.append(cleaned)
        return paraphrases[: self.num_paraphrases]
