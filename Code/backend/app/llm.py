"""Shared ChatOpenAI factory.

Mirrors embeddings.py — one place to construct the chat model so every
pipeline uses the same settings (model, temperature, timeout). Per project
choice: gpt-4o-mini at temperature 0 for deterministic, low-variance
baselines comparable across the 8 pipelines.
"""

from langchain_openai import ChatOpenAI

from .config import Settings


def get_chat_llm(settings: Settings, temperature: float = 0.0) -> ChatOpenAI:
    """ChatOpenAI configured for the project's generation model.

    Args:
        settings: Pydantic settings (model name, API key).
        temperature: Overridable per call. SelfCheckGPT (B8) will pass
            something > 0 for its stochastic samples; everything else uses 0.
    """
    return ChatOpenAI(
        model=settings.llm_model,
        temperature=temperature,
        api_key=settings.openai_api_key,
    )
