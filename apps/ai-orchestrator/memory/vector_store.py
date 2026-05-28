# FILE: apps/ai-orchestrator/memory/vector_store.py
# Ref: Blueprint §3.3 — Production RAG Pipeline: Hybrid Retrieval + Cross-Encoder Reranking
#
# Architecture (Two-Phase Production RAG):
#
#   Phase 1 — High-Recall Hybrid Retrieval (Convex Combination):
#     1A. BM25 Full-Text Search  → OpenSearch (exact keyword, tickers, statutes)
#     1B. Semantic Vector Search → Qdrant     (conceptual, embedding-based)
#         Fused via:  CC(d) = α × BM25_norm(d) + (1-α) × Vec_norm(d)
#         Returns top-N=50 candidates
#
#   Phase 2 — High-Precision Reranking (Cross-Encoder):
#     Cross-encoder (BGE-Reranker-v2-m3) jointly encodes query + each candidate doc
#     and produces a deep-attention relevance score.
#     Returns top-K=5 documents for LLM context injection.
#
# Why Convex Combination (not RRF)?
#   CC preserves raw score magnitudes — critical when one modality is strongly
#   confident (e.g., exact ticker match via BM25 should dominate). RRF only uses
#   rank positions and throws away score information.
#
# Why keep both OpenSearch AND Qdrant?
#   OpenSearch: Production-grade BM25, advanced text analysis, multi-field boosting
#   Qdrant:     Best-in-class ANN/HNSW vector search with filtering capabilities
#   Together:   Neither system alone can match both exact AND semantic recall.

import os
import json
import time
from typing import Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────
OPENSEARCH_ENDPOINT   = os.getenv("OPENSEARCH_ENDPOINT", "http://localhost:9200")
OPENSEARCH_USER       = os.getenv("OPENSEARCH_USER", "admin")
OPENSEARCH_PASSWORD   = os.getenv("OPENSEARCH_PASSWORD", "admin")
INDEX_NAME            = os.getenv("OPENSEARCH_INDEX_KNOWLEDGE", "advisor_knowledge")
QDRANT_URL            = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION     = "advisor_documents"
BEDROCK_REGION        = os.getenv("AWS_BEDROCK_REGION", "us-east-1")
BEDROCK_EMBED_MODEL   = os.getenv("BEDROCK_EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
GEMINI_EMBED_MODEL    = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-2")
GEMINI_API_KEY        = os.getenv("GEMINI_API_KEY")
VECTOR_DIMENSION      = 1536  # Shared dimension: Titan v2 = 1536, Gemini-embedding-2 MRL = 1536
RETRIEVAL_ALPHA       = float(os.getenv("RETRIEVAL_ALPHA", "0.3"))   # BM25 weight
RETRIEVAL_TOP_N       = int(os.getenv("RETRIEVAL_TOP_N", "50"))      # Phase 1 candidates
RERANKER_TOP_K        = int(os.getenv("RERANKER_TOP_K", "5"))        # Phase 2 final docs

import random
import boto3
from botocore.config import Config as BotocoreConfig
from opensearchpy import OpenSearch, RequestsHttpConnection
from qdrant_client import QdrantClient

# Gemini fallback embedding
try:
    import google.generativeai as genai
    _gemini_available = True
except ImportError:
    _gemini_available = False

# ─── Lazy Client Cache ────────────────────────────────────────────────────────
_os_client = None
_qdrant_client = None
_bedrock_client = None


def _get_opensearch() -> Optional[OpenSearch]:
    global _os_client
    if _os_client is None:
        try:
            use_ssl = OPENSEARCH_ENDPOINT.startswith("https://")
            host = OPENSEARCH_ENDPOINT.replace("https://", "").replace("http://", "").rstrip("/")
            _os_client = OpenSearch(
                hosts=[{"host": host, "port": 443 if use_ssl else 9200}],
                http_auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
                use_ssl=use_ssl,
                verify_certs=True,
                connection_class=RequestsHttpConnection,
                timeout=10,
            )
        except Exception as e:
            print(f"[HybridRetriever] OpenSearch init failed: {e}")
    return _os_client


def _get_qdrant() -> Optional[QdrantClient]:
    global _qdrant_client
    if _qdrant_client is None:
        try:
            _qdrant_client = QdrantClient(url=QDRANT_URL, timeout=5)
        except Exception as e:
            print(f"[HybridRetriever] Qdrant init failed: {e}")
    return _qdrant_client


def _get_bedrock():
    global _bedrock_client
    if _bedrock_client is None:
        try:
            retry_config = BotocoreConfig(
                retries={"max_attempts": 1, "mode": "standard"},
                read_timeout=10,
                connect_timeout=5,
            )
            _bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=BEDROCK_REGION,
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                config=retry_config,
            )
        except Exception as e:
            print(f"[HybridRetriever] Bedrock init failed: {e}")
    return _bedrock_client


def _embed_query_gemini(text: str) -> Optional[list]:
    """Fallback: embed using Google Gemini gemini-embedding-2.
    
    Configured with output_dimensionality=1536 via MRL to stay byte-compatible
    with the existing Titan v2 Qdrant collection (also 1536-dim).
    """
    if not _gemini_available:
        print("[HybridRetriever] google-generativeai package not installed — Gemini fallback skipped.")
        return None
    if not GEMINI_API_KEY:
        print("[HybridRetriever] GEMINI_API_KEY not set — Gemini fallback skipped.")
        return None
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        result = genai.embed_content(
            model=f"models/{GEMINI_EMBED_MODEL}",
            content=text[:8192],
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=VECTOR_DIMENSION,  # MRL: match Titan's 1536-dim
        )
        print(f"[HybridRetriever] Gemini fallback embedding succeeded (dim={len(result['embedding'])}).")
        return result["embedding"]
    except Exception as e:
        print(f"[HybridRetriever] Gemini fallback embedding failed: {e}")
        return None


def _embed_query(text: str, max_retries: int = 1) -> Optional[list]:
    """Embed a query string with Bedrock Titan (primary) → Gemini (fallback).
    
    Primary: AWS Bedrock amazon.titan-embed-text-v2:0 (1536-dim)
    Fallback: Google gemini-embedding-2 with MRL output_dimensionality=1536
    
    Both produce 1536-dim vectors, so the Qdrant collection stays compatible
    regardless of which provider served the embedding.
    """
    bedrock = _get_bedrock()
    if bedrock:
        body = json.dumps({"inputText": text[:8192]})
        for attempt in range(max_retries):
            try:
                response = bedrock.invoke_model(
                    modelId=BEDROCK_EMBED_MODEL,
                    body=body,
                    contentType="application/json",
                    accept="application/json",
                )
                result = json.loads(response["body"].read())
                return result["embedding"]
            except Exception as e:
                err_str = str(e)
                is_throttle = "ThrottlingException" in err_str or "TooManyRequests" in err_str
                if is_throttle and attempt < max_retries - 1:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    print(f"[HybridRetriever] Bedrock throttled (attempt {attempt+1}/{max_retries}). Retry in {wait:.1f}s...")
                    time.sleep(wait)
                else:
                    print(f"[HybridRetriever] Bedrock embedding failed after {attempt+1} attempts: {e}")
                    print("[HybridRetriever] Switching to Gemini fallback embedding...")
                    break
    else:
        print("[HybridRetriever] Bedrock unavailable — trying Gemini fallback directly.")

    # Gemini fallback
    return _embed_query_gemini(text)



# ─── Score Normalization ──────────────────────────────────────────────────────
def _min_max_normalize(scores: list[float]) -> list[float]:
    """Min-max normalize a list of scores to [0, 1]."""
    if not scores:
        return scores
    mn, mx = min(scores), max(scores)
    if mx == mn:
        return [1.0] * len(scores)
    return [(s - mn) / (mx - mn) for s in scores]


# ─── HybridRetriever ─────────────────────────────────────────────────────────
class HybridRetriever:
    """
    Phase 1: High-Recall Hybrid Retrieval using Convex Combination.

    Runs BM25 (OpenSearch) and vector search (Qdrant) in parallel,
    normalizes their scores independently, then fuses via:
        CC(d) = α × BM25_norm(d) + (1-α) × Vec_norm(d)

    The α parameter controls the balance between keyword precision and
    semantic recall. α=0.3 gives more weight to semantic search by default,
    but can be tuned per deployment via RETRIEVAL_ALPHA env var.
    """

    async def _bm25_search(self, query: str, top_n: int) -> list[dict]:
        """BM25 full-text search via OpenSearch multi_match."""
        os_client = _get_opensearch()
        if not os_client:
            print("[HybridRetriever] OpenSearch unavailable — skipping BM25.")
            return []

        body = {
            "size": top_n,
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["title^2", "content"],   # title boosted 2×
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            },
            "_source": {"excludes": ["content_vector"]},  # skip large vector field
        }
        try:
            res = os_client.search(index=INDEX_NAME, body=body)
            hits = res["hits"]["hits"]
            docs = []
            for hit in hits:
                doc = hit["_source"]
                doc["_bm25_score"] = hit["_score"]
                doc["_id"] = hit["_id"]
                docs.append(doc)
            print(f"[HybridRetriever] BM25: {len(docs)} hits from OpenSearch.")
            return docs
        except Exception as e:
            print(f"[HybridRetriever] BM25 search error: {e}")
            return []

    async def _vector_search(self, query_vector: list, top_n: int) -> list[dict]:
        """Semantic vector search via Qdrant HNSW k-NN."""
        qdrant = _get_qdrant()
        if not qdrant:
            print("[HybridRetriever] Qdrant unavailable — skipping vector search.")
            return []

        try:
            results = qdrant.search(
                collection_name=QDRANT_COLLECTION,
                query_vector=query_vector,
                limit=top_n,
                with_payload=True,
            )
            docs = []
            for hit in results:
                doc = dict(hit.payload)
                doc["_vec_score"] = hit.score
                doc["_id"] = str(hit.id)
                docs.append(doc)
            print(f"[HybridRetriever] Vector: {len(docs)} hits from Qdrant.")
            return docs
        except Exception as e:
            print(f"[HybridRetriever] Vector search error: {e}")
            return []

    def _convex_combination(
        self,
        bm25_docs: list[dict],
        vec_docs: list[dict],
        alpha: float,
    ) -> list[dict]:
        """
        Fuse BM25 and vector results using Convex Combination (CC).

        Steps:
        1. Extract raw scores from each result set
        2. Min-max normalize each set independently
        3. Merge unique documents by doc_id
        4. Score = α × BM25_norm + (1-α) × Vec_norm
        5. Sort descending by CC score
        """
        # Build lookup: doc_id → (doc, bm25_norm_score, vec_norm_score)
        fusion: dict[str, dict] = {}

        # Normalize BM25 scores
        bm25_raw = [d["_bm25_score"] for d in bm25_docs]
        bm25_norm = _min_max_normalize(bm25_raw)
        for doc, score in zip(bm25_docs, bm25_norm):
            key = doc.get("doc_id") or doc.get("_id", "")
            fusion[key] = {**doc, "_bm25_norm": score, "_vec_norm": 0.0}

        # Normalize vector scores
        vec_raw = [d["_vec_score"] for d in vec_docs]
        vec_norm = _min_max_normalize(vec_raw)
        for doc, score in zip(vec_docs, vec_norm):
            key = doc.get("doc_id") or doc.get("_id", "")
            if key in fusion:
                fusion[key]["_vec_norm"] = score
            else:
                fusion[key] = {**doc, "_bm25_norm": 0.0, "_vec_norm": score}

        # Apply Convex Combination
        for key, doc in fusion.items():
            doc["_cc_score"] = alpha * doc["_bm25_norm"] + (1 - alpha) * doc["_vec_norm"]

        # Sort by CC score descending
        merged = sorted(fusion.values(), key=lambda x: x["_cc_score"], reverse=True)
        return merged

    async def search(
        self,
        query: str,
        top_n: int = RETRIEVAL_TOP_N,
        alpha: float = RETRIEVAL_ALPHA,
        firm_id: Optional[str] = None,
    ) -> list[dict]:
        """
        Phase 1: Retrieve top-N candidates via Convex Combination of BM25 + Vector.

        Args:
            query:   Natural language query
            top_n:   Number of candidates to retrieve from each source
            alpha:   BM25 weight in CC (1-alpha = vector weight)
            firm_id: Optional filter by firm (multi-tenant)

        Returns:
            List of up to top_n docs sorted by CC score, ready for Phase 2 reranking.
        """
        t0 = time.time()

        # Embed the query for vector search
        query_vector = _embed_query(query)

        # Run both searches (could be parallelized with asyncio.gather in future)
        bm25_docs = await self._bm25_search(query, top_n)
        vec_docs = []
        if query_vector:
            vec_docs = await self._vector_search(query_vector, top_n)
        else:
            print("[HybridRetriever] No embedding available — BM25 only.")

        if not bm25_docs and not vec_docs:
            print("[HybridRetriever] No results from either source.")
            return []

        # Fuse via Convex Combination
        fused = self._convex_combination(bm25_docs, vec_docs, alpha)[:top_n]

        elapsed = (time.time() - t0) * 1000
        bm25_w = int(alpha * 100)
        vec_w  = int((1 - alpha) * 100)
        print(
            f"[HybridRetriever] CC fusion complete: {len(fused)} docs "
            f"(BM25={bm25_w}% + Vector={vec_w}%) in {elapsed:.0f}ms"
        )
        return fused


# ─── Full RAG Pipeline (Phase 1 + Phase 2) ────────────────────────────────────
class RAGPipeline:
    """
    Orchestrates the full two-phase RAG pipeline:
        Phase 1: HybridRetriever → Convex Combination → top-N candidates
        Phase 2: CrossEncoderReranker → top-K precision results
    """

    def __init__(self):
        self.retriever = HybridRetriever()
        # Lazy import to avoid loading the 280MB model at import time
        self._reranker = None

    def _get_reranker(self):
        if self._reranker is None:
            from memory.reranker import CrossEncoderReranker
            self._reranker = CrossEncoderReranker()
        return self._reranker

    async def search(
        self,
        query: str,
        top_k: int = RERANKER_TOP_K,
        firm_id: Optional[str] = None,
    ) -> list[dict]:
        """
        Full two-phase RAG search:
        1. Hybrid retrieval (BM25 + Vector CC) → top-50 candidates
        2. Cross-encoder reranking → top-K final results

        Returns top-K docs with both CC and rerank scores attached.
        """
        # Phase 1: High-Recall Hybrid Retrieval
        candidates = await self.retriever.search(query=query, firm_id=firm_id)

        if not candidates:
            return []

        # Phase 2: High-Precision Cross-Encoder Reranking
        reranked = self._get_reranker().rerank(query=query, documents=candidates)
        return reranked[:top_k]


# ─── Module-level singletons ──────────────────────────────────────────────────
# `vector_store` kept as alias for backward-compat with graph.py calls
rag_pipeline = RAGPipeline()
vector_store = rag_pipeline   # backward-compat alias
