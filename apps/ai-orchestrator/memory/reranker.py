# FILE: apps/ai-orchestrator/memory/reranker.py
# Ref: Blueprint §3.3 — Phase 2: Cross-Encoder Reranking for High-Precision RAG
#
# Uses BAAI/bge-reranker-v2-m3 locally via sentence-transformers.
# This is a cross-encoder: it jointly encodes the query + document pair
# and produces a single relevance score — far more accurate than bi-encoders
# for final ranking since it applies full self-attention across both texts.
#
# Model: https://huggingface.co/BAAI/bge-reranker-v2-m3
# Size: ~280MB, CPU-friendly, no GPU required.
# Downloads automatically on first use, cached in ~/.cache/huggingface/

import os
import time
from typing import List, Dict, Any
import cohere
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv()

RERANKER_TOP_K = int(os.getenv("RERANKER_TOP_K", "5"))
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3") # primary
COHERE_RERANK_MODEL = "rerank-english-v3.0" # secondary
COHERE_API_KEY = os.getenv("COHERE_API_KEY", "")

# ─── Lazy-loaded Singleton ────────────────────────────────────────────────────
_reranker_model = None

def _get_model():
    """Load the cross-encoder model once and cache it."""
    global _reranker_model
    if _reranker_model is None:
        from sentence_transformers import CrossEncoder
        print(f"[Reranker] Loading cross-encoder model: {RERANKER_MODEL}")
        t0 = time.time()
        _reranker_model = CrossEncoder(RERANKER_MODEL, max_length=512)
        print(f"[Reranker] Model loaded in {time.time() - t0:.1f}s")
    return _reranker_model


class CrossEncoderReranker:
    """
    Phase 2: High-Precision Reranking.

    Takes the top-N candidates from Phase 1 (Convex Combination) and
    re-scores them by jointly encoding query+document through the cross-encoder.
    Returns the top-K most relevant documents for LLM context injection.

    Why cross-encoders work better for final ranking:
    - Bi-encoders (used in vector search) encode query and doc independently.
      They are fast but lose cross-attention context.
    - Cross-encoders see BOTH query and document simultaneously.
      Every word in the query attends to every word in the document.
      This deep attention catches subtle relevance distinctions that
      bi-encoders completely miss.
    """

    def __init__(self, top_k: int = RERANKER_TOP_K):
        self.top_k = top_k

    def rerank(self, query: str, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Rerank documents using the cross-encoder (primary) or Cohere API (secondary).

        Args:
            query: The advisor's natural language query
            documents: List of doc dicts, each must have a 'content' field

        Returns:
            Top-K documents sorted by cross-encoder relevance score (highest first)
        """
        if not documents:
            return []
            
        t0 = time.time()
        
        try:
            # ─── PRIMARY: Local BGE Cross-Encoder ───
            model = _get_model()
            pairs = [(query, doc.get("content", "")) for doc in documents]
            scores = model.predict(pairs, show_progress_bar=False)

            scored = [
                {**doc, "_rerank_score": float(score), "_rerank_source": "local_bge"}
                for doc, score in zip(documents, scores)
            ]
        except Exception as e:
            print(f"[Reranker] Primary (Local BGE) failed: {e}. Falling back to Cohere...")
            # ─── SECONDARY: Cohere API ───
            if not COHERE_API_KEY:
                print("[Reranker] ERROR: Cohere API key missing. Returning raw candidates.")
                return documents[: self.top_k]
                
            try:
                co = cohere.Client(COHERE_API_KEY)
                texts = [doc.get("content", "") for doc in documents]
                response = co.rerank(
                    model=COHERE_RERANK_MODEL,
                    query=query,
                    documents=texts,
                    top_n=len(documents),
                )
                
                scored = []
                for res in response.results:
                    doc = documents[res.index]
                    scored.append({**doc, "_rerank_score": float(res.relevance_score), "_rerank_source": "cohere"})
            except Exception as e_cohere:
                print(f"[Reranker] Secondary (Cohere) failed: {e_cohere}. Returning raw candidates.")
                return documents[: self.top_k]

        # Sort descending by cross-encoder score
        scored.sort(key=lambda x: x["_rerank_score"], reverse=True)

        top_k_docs = scored[: self.top_k]

        elapsed = (time.time() - t0) * 1000
        source = top_k_docs[0].get("_rerank_source", "unknown") if top_k_docs else "none"
        print(
            f"[Reranker] Reranked {len(documents)} docs → top-{self.top_k} "
            f"in {elapsed:.0f}ms via {source} | top score: {top_k_docs[0].get('_rerank_score', 0):.4f}"
        )

        return top_k_docs


# ─── Module-level singleton ────────────────────────────────────────────────────
reranker = CrossEncoderReranker()
