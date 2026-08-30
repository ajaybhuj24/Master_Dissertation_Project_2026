# Third-party: FastAPI plus the OpenAI and Pinecone SDKs
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, OpenAIError
from pinecone import Pinecone
from pinecone.exceptions import PineconeException


from .config import Settings, get_settings
from .deps import get_openai_client, get_pinecone_client
from .routers.ask import router as ask_router
from .routers.batch import router as batch_router
from .routers.benchmark import router as benchmark_router
from .routers.corpus import router as corpus_router
from .routers.results import router as results_router
from .routers.upload import router as paper_router
# Create the FastAPI application
app = FastAPI(
    title="RAG Comparison API",
    version="0.1.0",
    description="Naive vs. Enhanced RAG comparative evaluation backend.",
)
# Allow the Vite dev frontend (localhost:5173) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root endpoint: basic API info, points to the interactive docs
@app.get("/", tags=["meta"])
def root() -> dict:
    return {"name": "RAG Comparison API", "version": app.version, "docs": "/docs"}

# Mount the feature routers onto the app
app.include_router(paper_router)
app.include_router(ask_router)
app.include_router(benchmark_router)
app.include_router(batch_router)
app.include_router(results_router)
app.include_router(corpus_router)

# Liveness probe: returns OK
@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/health/clients", tags=["health"])
def health_clients(
    settings: Settings = Depends(get_settings),
    openai_client: OpenAI = Depends(get_openai_client),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> dict:
    report: dict = {"openai": {}, "pinecone": {}}
     # Check OpenAI auth and whether the configured chat/embedding models are available

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
        # Auth or network failure talking to OpenAI
    except OpenAIError as e:
        report["openai"] = {"authenticated": False, "error": str(e)}
# Check Pinecone auth and confirm the index exists with the expected dimension/metric
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
        # If the index exists, verify its dimension matches the embedding model
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



# display the non-secret runtime configuration

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
