# OpenAI's chat models
from langchain_openai import ChatOpenAI

from .config import Settings

# chat LLM used by every pipeline

def get_chat_llm(settings: Settings, temperature: float = 0.0) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.llm_model,
        temperature=temperature,
        api_key=settings.openai_api_key,
        max_retries=5,
    )
