from __future__ import annotations

from .base import Pipeline
from .compression import ContextualCompressionPipeline
from .crag import CRAGPipeline
from .mmr import MMRPipeline
from .multi_query import MultiQueryPipeline
from .naive import NaivePipeline
from .rerank import RerankPipeline
from .selfcheck import SelfCheckPipeline
from .semantic_chunking import SemanticChunkingPipeline

_REGISTRY: dict[str, type[Pipeline]] = {
    NaivePipeline.pipeline_id: NaivePipeline,
    SemanticChunkingPipeline.pipeline_id: SemanticChunkingPipeline,
    MultiQueryPipeline.pipeline_id: MultiQueryPipeline,
    MMRPipeline.pipeline_id: MMRPipeline,
    RerankPipeline.pipeline_id: RerankPipeline,
    CRAGPipeline.pipeline_id: CRAGPipeline,
    ContextualCompressionPipeline.pipeline_id: ContextualCompressionPipeline,
    SelfCheckPipeline.pipeline_id: SelfCheckPipeline,
}


def get_pipeline(pipeline_id: str) -> Pipeline:
    cls = _REGISTRY.get(pipeline_id)
    if cls is None:
        raise KeyError(f"Unknown pipeline_id: {pipeline_id!r}. Available: {list(_REGISTRY)}")
    return cls()


def list_pipelines() -> list[dict]:
    return [
        {
            "pipeline_id": cls.pipeline_id,
            "pipeline_name": cls.pipeline_name,
            "stage": cls.stage,
            "namespace": cls.namespace,
        }
        for cls in _REGISTRY.values()
    ]


def all_pipeline_ids() -> list[str]:
    return list(_REGISTRY.keys())
