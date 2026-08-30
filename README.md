# Naive RAG vs. Enhanced RAG: A Comparative Evaluation of Hallucination Mitigation Techniques

**MSc Data Science dissertation project** — a full-stack application that benchmarks a naive Retrieval-Augmented Generation baseline against seven enhanced RAG techniques, measuring each with RAGAS metrics and paper-grounded question sets.

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
| During-retrieval | **MMR** | Maximal Marginal Relevance — trades relevance for diversity ($\lambda = 0.5$) |
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

# Optional tunables (with defaults):
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
TOP_K=4
MMR_LAMBDA=0.5
RERANK_FETCH_K=20

## Backend
cd Code/backend
python -m venv .venv

# On Windows
venv\Scripts\activate
# On Linux/macOS
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --port 8000

## Frontend

cd Code/frontend
npm install
npm run dev

## Usage

| Page | Purpose |
|---|---|
| **Upload** | Ingest a PDF — chunks and embeds it into the naive and semantic namespaces |
| **Interactive** | Ask one question and compare all pipelines' answers side by side |
| **Batch** | Run a paper's full 15-question benchmark across the selected pipelines |
| **Results** | View per-pipeline and per-stage RAGAS charts, either per run or pooled across all papers |
| **Corpus** | Run the word-count-vs-performance experiment |

---

## Benchmarks

Each benchmark is a JSON file containing exactly **15 questions** grounded in its paper:

* **8 factual** — direct lookups with a verbatim supporting passage.
* **5 synthesis** — explanatory questions requiring multiple passages.
* **2 out-of-scope** — plausible questions the paper cannot answer. The correct response is a refusal, so `ground_truth` is `null`.

Question sets were brought from **QASPER**.