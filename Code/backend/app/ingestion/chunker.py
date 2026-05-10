
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


NAIVE_CHUNK_SIZE = 1000
NAIVE_CHUNK_OVERLAP = 200


def chunk_naive(
    docs: list[Document],
    chunk_size: int = NAIVE_CHUNK_SIZE,
    chunk_overlap: int = NAIVE_CHUNK_OVERLAP,
) -> list[Document]:
    """Split documents using fixed-size recursive character splitting.

    add_start_index=True records the offset where each chunk starts in its
    source page, useful later for citation rendering.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        add_start_index=True,
    )
    return splitter.split_documents(docs)
