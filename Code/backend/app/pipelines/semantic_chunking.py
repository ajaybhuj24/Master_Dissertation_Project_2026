

from __future__ import annotations

from .base import STAGE_PRE
from .naive import NaivePipeline


class SemanticChunkingPipeline(NaivePipeline):
    pipeline_id = "semantic_chunking"
    pipeline_name = "Semantic Chunking"
    stage = STAGE_PRE
    namespace = "semantic"
