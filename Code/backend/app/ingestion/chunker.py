

from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..config import Settings
from ..embeddings import get_embeddings


NAIVE_CHUNK_SIZE = 1000
NAIVE_CHUNK_OVERLAP = 200


SEMANTIC_BREAKPOINT_TYPE = "percentile"


def chunk_naive(
    docs: list[Document],
    chunk_size: int = NAIVE_CHUNK_SIZE,
    chunk_overlap: int = NAIVE_CHUNK_OVERLAP,
) -> list[Document]:
   
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        add_start_index=True,
    )
    return splitter.split_documents(docs)


def chunk_semantic(
    docs: list[Document],
    settings: Settings,
    breakpoint_threshold_type: str = SEMANTIC_BREAKPOINT_TYPE,
) -> list[Document]:
   
    embeddings = get_embeddings(settings)
    splitter = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type=breakpoint_threshold_type,
        add_start_index=True,
    )
    return splitter.split_documents(docs)
