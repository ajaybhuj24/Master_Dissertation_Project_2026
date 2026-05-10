

import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pinecone import Pinecone

from ..config import Settings, get_settings
from ..deps import get_pinecone_client
from ..ingestion.chunker import chunk_naive
from ..ingestion.pdf_loader import load_pdf
from ..schemas.upload import CurrentPaperResponse, UploadResponse
from ..state import clear_current_paper, load_current_paper, save_current_paper
from ..vectorstore.pinecone_store import clear_namespace, upsert_documents

router = APIRouter(tags=["paper"])


_ALL_NAMESPACES = ("naive", "semantic")


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> UploadResponse:
    """Ingest a PDF.

    Steps:
        1. Validate filename + read bytes to a temp file (PyPDFLoader needs a path).
        2. Load PDF -> Documents (one per page).
        3. Chunk with RecursiveCharacterTextSplitter (naive).
        4. Clear both Pinecone namespaces (single-PDF mode).
        5. Upsert chunks to 'naive' namespace.
        6. Persist current-paper state to disk.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are accepted.")

    tmp_path: str | None = None
    try:
        # 1) Persist upload to a temp file.
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # 2) Load.
        docs = load_pdf(tmp_path, source_label=file.filename)
        if not docs:
            raise HTTPException(status_code=422, detail="PDF parsed but produced 0 pages.")

        # 3) Chunk (naive).
        naive_chunks = chunk_naive(docs)
        if not naive_chunks:
            raise HTTPException(status_code=422, detail="PDF parsed but produced 0 chunks.")

        # 4) Clear namespaces (clean slate).
        cleared: list[str] = []
        for ns in _ALL_NAMESPACES:
            clear_namespace(pinecone_client, settings, ns)
            cleared.append(ns)

        # 5) Upsert into 'naive'.
        n_naive = upsert_documents(pinecone_client, settings, "naive", naive_chunks)

        # 6) Persist state.
        paper_id = Path(file.filename).stem
        saved = save_current_paper({
            "paper_id": paper_id,
            "filename": file.filename,
            "pages": len(docs),
            "naive_chunks": n_naive,
            "semantic_chunks": 0,  # B3 will populate this.
        })

        return UploadResponse(
            paper_id=paper_id,
            filename=file.filename,
            pages=len(docs),
            naive_chunks=n_naive,
            semantic_chunks=0,
            namespaces_cleared=cleared,
            uploaded_at=datetime.fromisoformat(saved["uploaded_at"]),
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/paper/current", response_model=CurrentPaperResponse)
def get_current_paper() -> CurrentPaperResponse:
    """Return metadata about the currently-loaded paper. All-null if none."""
    state = load_current_paper()
    if state is None:
        return CurrentPaperResponse()
    return CurrentPaperResponse(**state)


@router.delete("/paper")
def delete_current_paper(
    settings: Settings = Depends(get_settings),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> dict:
    """Clear current paper state + both Pinecone namespaces."""
    cleared: list[str] = []
    for ns in _ALL_NAMESPACES:
        clear_namespace(pinecone_client, settings, ns)
        cleared.append(ns)
    clear_current_paper()
    return {"cleared_namespaces": cleared, "current_paper": None}
