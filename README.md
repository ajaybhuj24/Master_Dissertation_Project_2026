# Naive RAG vs. Enhanced RAG: A Comparative Evaluation of Hallucination Mitigation Techniques

**MSc Data Science dissertation project** — a full-stack application that benchmarks a naive Retrieval-Augmented Generation baseline against seven enhanced RAG techniques, measuring each with RAGAS metrics on hand-authored, paper-grounded question sets.

**Author:** Ajay Bhuj (25051512)

---

## Research Question

Retrieval-Augmented Generation is widely used to reduce LLM hallucination, but the many proposed enhancements are rarely compared against one another under identical conditions. This project asks two questions:

1. **Which RAG enhancement most effectively reduces hallucination?**
2. **How does each technique behave as the document corpus grows?**

---

## The Eight Pipelines

Techniques are grouped by the stage of the RAG pipeline they modify.

| Stage | Pipeline | What it does |
|---|---|---|
| Baseline | **Naive RAG** | Fixed-size chunking, top-k dense retrieval, single generation call |
| Pre-retrieval | **Semantic Chunking** | Splits on embedding-similarity boundaries instead of character counts |
| Pre-retrieval | **Multi-Query Retrieval** | Generates query paraphrases and unions their retrieved sets |
| During-retrieval | **MMR** | Maximal Marginal Relevance — trades relevance for diversity (λ = 0.5) |
| During-retrieval | **Cross-Encoder Re-rank** | Re-scores a wide candidate pool with `ms-marco-MiniLM-L-6-v2` |
| During-retrieval | **CRAG** | Corrective RAG — grades retrieved passages and discards irrelevant ones |
| Post-retrieval | **Contextual Compression** | Extracts only answer-bearing sentences from each passage |
| Post-retrieval | **SelfCheckGPT** | Samples multiple generations and flags low-consensus answers |

---

## Evaluation Metrics (RAGAS)

| Metric | Question it answers |
|---|---|
| **Faithfulness** | Is the answer grounded in the retrieved context? |
| **Answer Relevancy** | Does the answer actually address the question? |
| **Context Precision** | Are the retrieved chunks relevant, and ranked well? |
| **Context Recall** | Does the retrieved context contain everything the ground truth needs? |

Context precision and recall require a ground-truth answer, so they are intentionally `null` for out-of-scope questions, where the correct behaviour is refusal.

---

## Setup

### Prerequisites

- Python 3.12
- Node.js 20+
- An OpenAI API key
- A Pinecone API key

### 1. Environment Variables

Create `Code/backend/.env`:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=rag-comparison


Optional tunables (with defaults):

LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
TOP_K=4
MMR_LAMBDA=0.5
RERANK_FETCH_K=20

2. Backend
cd Code/backend
python -m venv .venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000


The backend serves on http://127.0.0.1:8000, with interactive API documentation available at /docs.

Important: The backend loads .env by relative path, so it must be started from Code/backend. Avoid --reload while an evaluation is running — jobs are held in memory and a hot-reload silently discards them.

3. Frontend
cd Code/frontend
npm install
npm run dev


The frontend serves on http://localhost:5173 and proxies /api to the backend on port 8000.

Usage
Page	Purpose
Upload	Ingest a PDF — chunks and embeds it into the naive and semantic namespaces
Interactive	Ask one question and compare all pipelines' answers side by side
Batch	Run a paper's full 15-question benchmark across the selected pipelines
Results	Per-pipeline and per-stage RAGAS charts, per run or pooled across all papers
Corpus	The word-count-vs-performance experiment
Benchmarks

Each benchmark is a JSON file containing exactly 15 hand-authored questions grounded in its paper:

8 factual — direct lookups with a verbatim supporting passage
5 synthesis — explanatory questions requiring multiple passages
2 out-of-scope — plausible questions the paper cannot answer; the correct response is refusal, so ground_truth is null

Question sets were seeded from QASPER.