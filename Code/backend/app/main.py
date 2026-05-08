
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, OpenAIError
from pinecone import Pinecone
from pinecone.exceptions import PineconeException

from .config import Settings, get_settings
from .deps import get_openai_client, get_pinecone_client

app = FastAPI(
    title="RAG Comparison API",
    version="0.1.0",
    description="Naive vs. Enhanced RAG comparative evaluation backend.",
)

# Vite dev server runs on 5173 by default. Tighten this in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/health/clients", tags=["health"])
def health_clients(
    settings: Settings = Depends(get_settings),
    openai_client: OpenAI = Depends(get_openai_client),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> dict:
    """Readiness probe. Performs lightweight authenticated calls
    against OpenAI and Pinecone to confirm the configuration works.
    Returns a structured report rather than 500-ing on partial failure
    so the frontend can surface clear setup errors.
    """
    report: dict = {"openai": {}, "pinecone": {}}

    try:
        models = openai_client.models.list()
        model_ids = {m.id for m in models.data}
        report["openai"] = {
            "authenticated": True,
            "configured_model": settings.llm_model,
            "configured_model_available": settings.llm_model in model_ids,
            "configured_embedding_model": settings.embedding_model,
            "configured_embedding_model_available": settings.embedding_model in model_ids,
        }
    except OpenAIError as e:
        report["openai"] = {"authenticated": False, "error": str(e)}

    try:
        indexes = pinecone_client.list_indexes()
        index_names = [idx.name for idx in indexes]
        report["pinecone"] = {
            "authenticated": True,
            "configured_index": settings.pinecone_index_name,
            "configured_index_exists": settings.pinecone_index_name in index_names,
            "all_indexes": index_names,
        }
    except PineconeException as e:
        report["pinecone"] = {"authenticated": False, "error": str(e)}

    return report


@app.get("/health/config", tags=["health"])
def health_config(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "llm_model": settings.llm_model,
        "embedding_model": settings.embedding_model,
        "embedding_dim": settings.embedding_dim,
        "pinecone_index_name": settings.pinecone_index_name,
        "pinecone_cloud": settings.pinecone_cloud,
        "pinecone_region": settings.pinecone_region,
        "top_k": settings.top_k,
        "mmr_fetch_k": settings.mmr_fetch_k,
        "mmr_lambda": settings.mmr_lambda,
    }
