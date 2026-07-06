
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from pinecone.exceptions import NotFoundException

from ..config import Settings
from ..ingestion.chunker import chunk_naive
from ..ingestion.pdf_loader import load_pdf
from ..paths import CORPUS_DIR
from ..vectorstore.pinecone_store import get_vector_store

if TYPE_CHECKING:
    from pinecone import Pinecone

CORPUS_NAMESPACE = "corpus"
_REGISTRY = CORPUS_DIR / "papers.json"


def _load_registry() -> dict:
    if not _REGISTRY.exists():
        return {"papers": []}
    return json.loads(_REGISTRY.read_text(encoding="utf-8"))


def _save_registry(reg: dict) -> None:
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    _REGISTRY.write_text(json.dumps(reg, indent=2), encoding="utf-8")


def _public(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k != "vector_ids"}


def list_corpus_papers() -> list[dict]:
    return [_public(p) for p in _load_registry()["papers"]]


def get_corpus_paper(paper_id: str) -> dict | None:
    entry = _registry_entry(paper_id)
    return _public(entry) if entry is not None else None


def total_word_count() -> int:
    return sum(p.get("word_count", 0) for p in _load_registry()["papers"])


def ingest_corpus_pdf(
    pinecone_client: "Pinecone",
    settings: Settings,
    file_path: str,
    filename: str,
) -> dict:
    paper_id = Path(filename).stem

    docs = load_pdf(file_path, source_label=filename)
    if not docs:
        raise ValueError("PDF parsed but produced 0 pages.")

    full_text = "\n".join(d.page_content for d in docs)
    word_count = len(full_text.split())
    char_count = len(full_text)

    for d in docs:
        d.metadata["paper_id"] = paper_id

    chunks = chunk_naive(docs)
    if not chunks:
        raise ValueError("PDF parsed but produced 0 chunks.")

    existing = _registry_entry(paper_id)
    if existing is not None:
        _delete_vectors(pinecone_client, settings, existing.get("vector_ids", []))
        _remove_from_registry(paper_id)

    store = get_vector_store(pinecone_client, settings, CORPUS_NAMESPACE)
    vector_ids = store.add_documents(chunks)

    entry = {
        "paper_id": paper_id,
        "filename": filename,
        "word_count": word_count,
        "char_count": char_count,
        "pages": len(docs),
        "n_chunks": len(chunks),
        "vector_ids": vector_ids,
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    reg = _load_registry()
    reg["papers"].append(entry)
    _save_registry(reg)
    return _public(entry)


def delete_corpus_pdf(
    pinecone_client: "Pinecone", settings: Settings, paper_id: str
) -> bool:
    entry = _registry_entry(paper_id)
    if entry is None:
        return False
    _delete_vectors(pinecone_client, settings, entry.get("vector_ids", []))
    _remove_from_registry(paper_id)
    return True


def clear_corpus(pinecone_client: "Pinecone", settings: Settings) -> int:
    n = len(_load_registry()["papers"])
    index = pinecone_client.Index(settings.pinecone_index_name)
    try:
        index.delete(delete_all=True, namespace=CORPUS_NAMESPACE)
    except NotFoundException:
        pass
    _save_registry({"papers": []})
    return n




def _registry_entry(paper_id: str) -> dict | None:
    for p in _load_registry()["papers"]:
        if p["paper_id"] == paper_id:
            return p
    return None


def _remove_from_registry(paper_id: str) -> None:
    reg = _load_registry()
    reg["papers"] = [p for p in reg["papers"] if p["paper_id"] != paper_id]
    _save_registry(reg)


def _delete_vectors(
    pinecone_client: "Pinecone", settings: Settings, vector_ids: list[str]
) -> None:
    if not vector_ids:
        return
    index = pinecone_client.Index(settings.pinecone_index_name)
    for i in range(0, len(vector_ids), 1000):
        try:
            index.delete(ids=vector_ids[i : i + 1000], namespace=CORPUS_NAMESPACE)
        except NotFoundException:
            pass
