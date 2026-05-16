

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, OpenAIError
from pinecone import Pinecone
from pinecone.exceptions import PineconeException

from .config import Settings, get_settings
from .deps import get_openai_client, get_pinecone_client
from .routers.upload import router as paper_router

app = FastAPI(
    title="RAG Comparison API",
    version="0.1.0",
    description="Naive vs. Enhanced RAG comparative evaluation backend.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["meta"])
def root() -> dict:
    """API map. Hit /docs for Swagger UI."""
    return {
        "name": "RAG Comparison API",
        "version": app.version,
        "endpoints": {
            "GET /health": "liveness probe (no external calls)",
            "GET /health/clients": "verify OpenAI + Pinecone auth and index presence",
            "GET /health/config": "echo non-secret runtime config",
            "POST /upload": "ingest a PDF (chunk -> embed -> upsert to 'naive' namespace)",
            "GET /paper/current": "metadata for currently-loaded paper",
            "DELETE /paper": "clear current paper + both namespaces",
            "GET /docs": "Swagger UI",
            "GET /redoc": "ReDoc UI",
        },
    }


# Mount paper-management routes.
app.include_router(paper_router)


@app.get("/health", tags=["health"])
def health() -> dict:
    """Liveness probe. Does NOT call any external service."""
    return {"status": "ok"}


@app.get("/health/clients", tags=["health"])
def health_clients(
    settings: Settings = Depends(get_settings),
    openai_client: OpenAI = Depends(get_openai_client),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> dict:
    """Readiness probe. Performs lightweight authenticated calls
    against OpenAI and Pinecone to confirm the configuration works.
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
        index_exists = settings.pinecone_index_name in index_names
        pc_report: dict = {
            "authenticated": True,
            "configured_index": settings.pinecone_index_name,
            "configured_index_exists": index_exists,
            "all_indexes": index_names,
        }
        if index_exists:
            desc = pinecone_client.describe_index(settings.pinecone_index_name)
            pc_report["dimension"] = desc.dimension
            pc_report["metric"] = desc.metric
            pc_report["dimension_matches_embedding_model"] = (
                desc.dimension == settings.embedding_dim
            )
            pc_report["expected_dimension"] = settings.embedding_dim
        report["pinecone"] = pc_report
    except PineconeException as e:
        report["pinecone"] = {"authenticated": False, "error": str(e)}

    return report


@app.get("/health/config", tags=["health"])
def health_config(settings: Settings = Depends(get_settings)) -> dict:
    """Echoes non-secret config values. Never include API keys here."""
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
