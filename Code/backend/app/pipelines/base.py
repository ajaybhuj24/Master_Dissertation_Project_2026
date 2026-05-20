

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

from ..config import Settings
from ..schemas.ask import PipelineResult, RetrievedContext

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

    # ---- helpers ----

    @staticmethod
    def _now_ms() -> float:
        return time.perf_counter() * 1000.0

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
