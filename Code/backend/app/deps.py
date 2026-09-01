
from functools import lru_cache

from openai import OpenAI
from pinecone import Pinecone

from .config import get_settings

# Cached OpenAI client
@lru_cache
def get_openai_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key)

# Cached Pinecone client
@lru_cache
def get_pinecone_client() -> Pinecone:
    settings = get_settings()
    return Pinecone(api_key=settings.pinecone_api_key)
