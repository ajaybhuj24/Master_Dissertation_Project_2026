
from datetime import datetime

from pydantic import BaseModel

# Response after ingesting a PDF
class UploadResponse(BaseModel):
    paper_id: str
    filename: str
    pages: int
    naive_chunks: int
    semantic_chunks: int
    namespaces_cleared: list[str]
    uploaded_at: datetime

# Metadata for the currently-loaded paper
class CurrentPaperResponse(BaseModel):
    paper_id: str | None = None
    filename: str | None = None
    pages: int | None = None
    naive_chunks: int | None = None
    semantic_chunks: int | None = None
    uploaded_at: datetime | None = None
