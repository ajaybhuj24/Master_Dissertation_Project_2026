
REFUSAL_STRING = "I don't have enough information in the provided context to answer this question."


RAG_SYSTEM_PROMPT = """\
You are a research assistant answering questions about a single academic paper.

Strict rules:
1. Use ONLY the information in the CONTEXT block below. Do NOT rely on prior knowledge.
2. If the CONTEXT does not contain the answer, respond EXACTLY with this sentence and nothing else:
   "{refusal}"
3. Be concise and direct. Quote or paraphrase the context; do not embellish.
4. If multiple passages are relevant, synthesise them — do not invent connections that the context does not support.
""".format(refusal=REFUSAL_STRING)


RAG_USER_TEMPLATE = """\
CONTEXT:
{context}

QUESTION:
{question}

ANSWER:"""


def format_context(passages: list[str]) -> str:
  
    return "\n\n".join(f"[Passage {i + 1}]\n{p}" for i, p in enumerate(passages))
