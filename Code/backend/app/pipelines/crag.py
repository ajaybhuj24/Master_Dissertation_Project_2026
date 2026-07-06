
from __future__ import annotations

import json
import logging
import re

from langchain_core.messages import HumanMessage, SystemMessage

from ..llm import get_chat_llm
from ..schemas.ask import PipelineResult, RetrievedContext
from .base import STAGE_DURING, Pipeline, PipelineCtx
from .prompts import (
    CRAG_GRADER_SYSTEM_PROMPT,
    CRAG_GRADER_USER_TEMPLATE,
    CRAG_REFINE_SYSTEM_PROMPT,
    CRAG_REFINE_USER_TEMPLATE,
    REFUSAL_STRING,
)

logger = logging.getLogger(__name__)

_JSON_OBJECT = re.compile(r"\{[^{}]*\}", re.DOTALL)

CORRECT = "correct"
AMBIGUOUS = "ambiguous"
INCORRECT = "incorrect"
_VALID_LABELS = {CORRECT, AMBIGUOUS, INCORRECT}


class CRAGPipeline(Pipeline):
    pipeline_id = "crag"
    pipeline_name = "CRAG"
    stage = STAGE_DURING
    namespace = "naive"

    def run(self, question: str, ctx: PipelineCtx) -> PipelineResult:
        t0 = self._now_ms()
        initial = self._retrieve(question, ctx)

        if not initial:
            retrieval_ms = int(self._now_ms() - t0)
            return self._make_result(
                answer=REFUSAL_STRING,
                contexts=[],
                retrieval_ms=retrieval_ms,
                generation_ms=0,
                debug={"short_circuit": "no_contexts_retrieved"},
            )

        labels = self._grade(question, initial, ctx)
        correct_initial = [
            c for c, lbl in zip(initial, labels) if lbl == CORRECT
        ]
        any_non_correct = any(lbl != CORRECT for lbl in labels)

        refined_query: str | None = None
        refined_results: list[RetrievedContext] = []
        if any_non_correct:
            refined_query = self._refine(question, ctx)
            if refined_query:
                refined_results = self._retrieve(refined_query, ctx)

        merged: dict[str, RetrievedContext] = {}
        for c in correct_initial:
            merged[c.text] = c
        for c in refined_results:
            existing = merged.get(c.text)
            if existing is None or (c.score or 0.0) > (existing.score or 0.0):
                merged[c.text] = c

        if not merged:
            merged = {c.text: c for c in initial}

        contexts = sorted(
            merged.values(), key=lambda c: c.score or 0.0, reverse=True
        )[: ctx.top_k]
        retrieval_ms = int(self._now_ms() - t0)

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
                "initial_labels": labels,
                "correct_initial_count": len(correct_initial),
                "refinement_triggered": any_non_correct,
                "refined_query": refined_query,
                "refined_retrieved_count": len(refined_results),
                "model": ctx.settings.llm_model,
                "embedding_model": ctx.settings.embedding_model,
            },
        )


    def _grade(
        self,
        question: str,
        contexts: list[RetrievedContext],
        ctx: PipelineCtx,
    ) -> list[str]:
        passages_block = "\n\n".join(
            f"[{i + 1}]\n{c.text}" for i, c in enumerate(contexts)
        )
        user_msg = CRAG_GRADER_USER_TEMPLATE.format(
            question=question, passages=passages_block
        )
        llm = get_chat_llm(ctx.settings)
        try:
            response = llm.invoke([
                SystemMessage(content=CRAG_GRADER_SYSTEM_PROMPT),
                HumanMessage(content=user_msg),
            ])
            raw = (
                response.content
                if isinstance(response.content, str)
                else str(response.content)
            )
            parsed = self._parse_grader_json(raw, expected_count=len(contexts))
            if parsed is not None:
                return parsed
        except Exception:
            logger.exception("CRAG grader call failed; defaulting to 'ambiguous'")
        return [AMBIGUOUS] * len(contexts)

    @staticmethod
    def _parse_grader_json(raw: str, expected_count: int) -> list[str] | None:
        match = _JSON_OBJECT.search(raw)
        if not match:
            return None
        try:
            obj = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
        labels: list[str] = []
        for i in range(1, expected_count + 1):
            value = obj.get(str(i)) or obj.get(i)
            if value not in _VALID_LABELS:
                return None
            labels.append(value)
        return labels

    def _refine(self, question: str, ctx: PipelineCtx) -> str | None:
        user_msg = CRAG_REFINE_USER_TEMPLATE.format(question=question)
        llm = get_chat_llm(ctx.settings)
        try:
            response = llm.invoke([
                SystemMessage(content=CRAG_REFINE_SYSTEM_PROMPT),
                HumanMessage(content=user_msg),
            ])
            raw = (
                response.content
                if isinstance(response.content, str)
                else str(response.content)
            )
            refined = raw.strip().strip('"').strip("'")
            return refined or None
        except Exception:
            logger.exception("CRAG refinement call failed")
            return None
