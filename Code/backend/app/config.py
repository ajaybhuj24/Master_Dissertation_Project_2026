from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    openai_api_key: str = Field(..., description="OpenAI API key")
    llm_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    pinecone_api_key: str = Field(..., description="Pinecone API key")
    pinecone_index_name: str = "rag-comparison"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"

    top_k: int = 4
    mmr_fetch_k: int = 20
    mmr_lambda: float = 0.5

    rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    rerank_fetch_k: int = 20


@lru_cache
def get_settings() -> Settings:
    return Settings()
