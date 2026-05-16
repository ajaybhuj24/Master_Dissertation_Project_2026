
from langchain_openai import OpenAIEmbeddings

from .config import Settings


def get_embeddings(settings: Settings) -> OpenAIEmbeddings:
    """OpenAIEmbeddings configured for the project's embedding model."""
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.openai_api_key,
    )
