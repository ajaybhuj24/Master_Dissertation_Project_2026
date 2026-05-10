"""Pinecone vector-store wrapper.

Centralises three operations needed across the upload + query lifecycle:
- get_vector_store: produce a langchain PineconeVectorStore for a namespace
- upsert_documents: chunked add (LangChain handles batching internally)
- clear_namespace: hard-delete all vectors in a namespace (used on re-upload)
"""

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from pinecone.exceptions import NotFoundException

from ..config import Settings


def get_embeddings(settings: Settings) -> OpenAIEmbeddings:
    """OpenAIEmbeddings configured for the project's embedding model."""
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.openai_api_key,
    )


def get_vector_store(
    pinecone_client: Pinecone,
    settings: Settings,
    namespace: str,
) -> PineconeVectorStore:
    """Build a PineconeVectorStore bound to the configured index + given namespace."""
    index = pinecone_client.Index(settings.pinecone_index_name)
    embeddings = get_embeddings(settings)
    return PineconeVectorStore(
        embedding=embeddings,
        index=index,
        namespace=namespace,
    )


def upsert_documents(
    pinecone_client: Pinecone,
    settings: Settings,
    namespace: str,
    documents: list[Document],
) -> int:
    """Embed + upsert documents into the given namespace. Returns count upserted."""
    store = get_vector_store(pinecone_client, settings, namespace)
    ids = store.add_documents(documents)
    return len(ids)


def clear_namespace(
    pinecone_client: Pinecone,
    settings: Settings,
    namespace: str,
) -> bool:
    """Delete every vector in the given namespace.

    A non-existent namespace (404) is treated as success — nothing to delete.
    """
    index = pinecone_client.Index(settings.pinecone_index_name)
    try:
        index.delete(delete_all=True, namespace=namespace)
        return True
    except NotFoundException:
        return True
