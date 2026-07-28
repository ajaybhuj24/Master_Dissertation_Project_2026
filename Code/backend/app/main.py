
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, OpenAIError
from pinecone import Pinecone
from pinecone.exceptions import PineconeException

import time

from .config import Settings, get_settings
from .deps import get_openai_client, get_pinecone_client
from .evaluation.ragas_runner import evaluate_one
from .routers.ask import router as ask_router
from .routers.batch import router as batch_router
from .routers.benchmark import router as benchmark_router
from .routers.corpus import router as corpus_router
from .routers.results import router as results_router
from .routers.upload import router as paper_router
from .schemas.evaluation import HealthRagasResponse

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
    return {
        "name": "RAG Comparison API",
        "version": app.version,
        "endpoints": {
            "GET /health": "liveness probe (no external calls)",
            "GET /health/clients": "verify OpenAI + Pinecone auth and index presence",
            "GET /health/config": "echo non-secret runtime config",
            "GET /health/ragas": "self-contained RAGAS smoke test (4 metrics, no paper needed)",
            "POST /upload": "ingest a PDF (chunk -> embed -> upsert to both namespaces)",
            "GET /paper/current": "metadata for currently-loaded paper",
            "DELETE /paper": "clear current paper + both namespaces",
            "GET /pipelines": "list registered RAG pipelines",
            "POST /ask": "run a question through one or more pipelines",
            "POST /benchmark": "upload + validate a 15-Q benchmark JSON",
            "GET /benchmarks": "list all saved benchmarks",
            "GET /benchmarks/{paper_id}": "fetch one benchmark's full content",
            "DELETE /benchmarks/{paper_id}": "remove a saved benchmark",
            "POST /batch": "submit a batch eval job (returns job_id)",
            "GET /jobs": "list all jobs (newest first)",
            "GET /jobs/{job_id}": "current status + summary",
            "GET /jobs/{job_id}/results": "full per-unit BatchResultRow list",
            "GET /jobs/{job_id}/stream": "Server-Sent Events progress",
            "POST /jobs/{job_id}/cancel": "best-effort cancellation",
            "POST /jobs/{job_id}/persist": "re-trigger CSV/JSON export for a completed job",
            "GET /results/master": "download the master append-only CSV",
            "GET /results/master/rows": "trimmed master rows for the all-papers view (dedup=latest|none)",
            "GET /results/files": "list every file in data/results/",
            "GET /results/files/{name}": "download one specific result file",
            "POST /corpus/papers": "add a PDF to the corpus experiment (additive, tagged)",
            "GET /corpus/papers": "list corpus PDFs + total word count",
            "DELETE /corpus/papers/{paper_id}": "remove one corpus PDF",
            "DELETE /corpus": "clear the corpus namespace + registry",
            "POST /corpus/sweep": "launch a word-count-vs-performance sweep (returns a job_id)",
            "GET /corpus/sweeps": "list past sweeps (newest first)",
            "GET /corpus/sweeps/{sweep_id}": "full sweep result (all points) for the trend chart",
            "DELETE /corpus/sweeps/{sweep_id}": "delete one persisted sweep",
            "GET /docs": "Swagger UI",
            "GET /redoc": "ReDoc UI",
        },
    }


app.include_router(paper_router)
app.include_router(ask_router)
app.include_router(benchmark_router)
app.include_router(batch_router)
app.include_router(results_router)
app.include_router(corpus_router)


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


@app.get("/health/ragas", response_model=HealthRagasResponse, tags=["health"])
async def health_ragas(
    settings: Settings = Depends(get_settings),
) -> HealthRagasResponse:
    t0 = time.perf_counter()
    inputs = {
        "question": "Where is the Eiffel Tower located?",
        "answer": "The Eiffel Tower is located in Paris, France.",
        "contexts": [
            "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.",
            "Construction of the Eiffel Tower began in 1887 and was completed in 1889.",
        ],
        "ground_truth": "The Eiffel Tower is in Paris, France.",
    }
    scores = await evaluate_one(
        question=inputs["question"],
        answer=inputs["answer"],
        contexts=inputs["contexts"],
        ground_truth=inputs["ground_truth"],
        settings=settings,
    )
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    return HealthRagasResponse(
        scenario="in_scope",
        inputs=inputs,
        scores=scores,
        elapsed_ms=elapsed_ms,
    )


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
