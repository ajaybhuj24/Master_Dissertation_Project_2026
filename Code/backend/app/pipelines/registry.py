
from __future__ import annotations

from .base import Pipeline
from .naive import NaivePipeline


_REGISTRY: dict[str, type[Pipeline]] = {
    NaivePipeline.pipeline_id: NaivePipeline,
  
}


def get_pipeline(pipeline_id: str) -> Pipeline:
    cls = _REGISTRY.get(pipeline_id)
    if cls is None:
        raise KeyError(f"Unknown pipeline_id: {pipeline_id!r}. Available: {list(_REGISTRY)}")
    return cls()


def list_pipelines() -> list[dict]:
    """Lightweight metadata for the /pipelines endpoint."""
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
