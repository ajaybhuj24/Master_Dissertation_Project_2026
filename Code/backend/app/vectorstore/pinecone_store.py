
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from pinecone.exceptions import NotFoundException

from ..config import Settings
from ..embeddings import get_embeddings

# Build a LangChain vector store bound to one Pinecone namespace
def get_vector_store(
    pinecone_client: Pinecone,
    settings: Settings,
    namespace: str,
) -> PineconeVectorStore:
    index = pinecone_client.Index(settings.pinecone_index_name)
    embeddings = get_embeddings(settings)
    return PineconeVectorStore(
        embedding=embeddings,
        index=index,
        namespace=namespace,
    )

# Embed and upsert documents into a namespace
def upsert_documents(
    pinecone_client: Pinecone,
    settings: Settings,
    namespace: str,
    documents: list[Document],
) -> int:
    store = get_vector_store(pinecone_client, settings, namespace)
    ids = store.add_documents(documents)
    return len(ids)

# Delete every vector in a namespace
def clear_namespace(
    pinecone_client: Pinecone,
    settings: Settings,
    namespace: str,
) -> bool:
    index = pinecone_client.Index(settings.pinecone_index_name)
    try:
        index.delete(delete_all=True, namespace=namespace)
        return True
    except NotFoundException:
        return True
