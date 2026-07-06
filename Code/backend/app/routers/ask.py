
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pinecone import Pinecone

from ..config import Settings, get_settings
from ..deps import get_openai_client, get_pinecone_client
from ..pipelines.base import PipelineCtx
from ..pipelines.registry import all_pipeline_ids, get_pipeline, list_pipelines
from ..schemas.ask import AskRequest, AskResponse, PipelineInfo
from ..state import load_current_paper

router = APIRouter(tags=["ask"])


@router.get("/pipelines", response_model=list[PipelineInfo])
def get_pipelines() -> list[PipelineInfo]:
    return [PipelineInfo(**p) for p in list_pipelines()]


@router.post("/ask", response_model=AskResponse)
def ask(
    payload: AskRequest,
    settings: Settings = Depends(get_settings),
    openai_client: OpenAI = Depends(get_openai_client),
    pinecone_client: Pinecone = Depends(get_pinecone_client),
) -> AskResponse:
    selected_ids = payload.pipeline_ids or all_pipeline_ids()
    if not selected_ids:
        raise HTTPException(status_code=400, detail="No pipelines registered.")
    unknown = [pid for pid in selected_ids if pid not in all_pipeline_ids()]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown pipeline_id(s): {unknown}. Available: {all_pipeline_ids()}",
        )

    paper_state = load_current_paper()
    if paper_state is None:
        raise HTTPException(
            status_code=409,
            detail="No paper currently loaded. POST /upload a PDF first.",
        )

    ctx = PipelineCtx(
        settings=settings,
        openai_client=openai_client,
        pinecone_client=pinecone_client,
        top_k=settings.top_k,
    )

    results = []
    for pid in selected_ids:
        pipeline = get_pipeline(pid)
        result = pipeline.run(payload.question, ctx)
        results.append(result)

    return AskResponse(
        question=payload.question,
        paper_id=paper_state.get("paper_id"),
        results=results,
    )
