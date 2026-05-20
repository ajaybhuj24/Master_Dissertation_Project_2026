
from langchain_openai import ChatOpenAI

from .config import Settings


def get_chat_llm(settings: Settings, temperature: float = 0.0) -> ChatOpenAI:
    """ChatOpenAI configured for the project's generation model.

    Args:
        settings: Pydantic settings (model name, API key).
    """
    return ChatOpenAI(
        model=settings.llm_model,
        temperature=temperature,
        api_key=settings.openai_api_key,
    )
