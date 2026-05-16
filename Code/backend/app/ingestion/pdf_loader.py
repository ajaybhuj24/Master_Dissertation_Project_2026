
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document


def load_pdf(file_path: str | Path, source_label: str | None = None) -> list[Document]:
    """Load a PDF into a list of Documents (one per page).
    """
    loader = PyPDFLoader(str(file_path))
    docs = loader.load()
    if source_label is not None:
        for doc in docs:
            doc.metadata["source"] = source_label
    return docs
