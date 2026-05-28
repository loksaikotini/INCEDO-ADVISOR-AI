# FILE: apps/ai-orchestrator/memory/indexer.py
# Ref: Blueprint §3.3 — Document ingestion pipeline for the RAG knowledge base
#
# Embeds documents using AWS Bedrock Titan and indexes them into:
#   1. OpenSearch — for BM25 text search (content field)
#   2. Qdrant    — for semantic vector search (content_vector)
#
# Both stores are indexed on every document write so they stay in sync.
# Call index_document() from seed scripts, API endpoints, or admin tools.

import os
import json
import time
import hashlib
import asyncio
from datetime import datetime, UTC
from typing import Optional, Dict, Any

import random
import boto3
from botocore.config import Config as BotocoreConfig
from dotenv import load_dotenv
from opensearchpy import OpenSearch, RequestsHttpConnection
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, VectorParams, Distance

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
VECTOR_DIMENSION      = 1536  # Shared: Titan v2 = 1536, Gemini-embedding-2 MRL = 1536

# ─── Clients ──────────────────────────────────────────────────────────────────
use_ssl = OPENSEARCH_ENDPOINT.startswith("https://")
os_host = OPENSEARCH_ENDPOINT.replace("https://", "").replace("http://", "").rstrip("/")

_os_client: Optional[OpenSearch] = None
_qdrant_client: Optional[QdrantClient] = None
_bedrock_client = None

# Gemini fallback embedding
try:
    import google.generativeai as genai
    _gemini_available = True
except ImportError:
    _gemini_available = False


def _get_os_client() -> OpenSearch:
    global _os_client
    if _os_client is None:
        _os_client = OpenSearch(
            hosts=[{"host": os_host, "port": 443 if use_ssl else 9200}],
            http_auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
            use_ssl=use_ssl,
            verify_certs=True,
            connection_class=RequestsHttpConnection,
            timeout=30,
        )
    return _os_client


def _get_qdrant_client() -> Optional[QdrantClient]:
    global _qdrant_client
    if _qdrant_client is None:
        try:
            _qdrant_client = QdrantClient(url=QDRANT_URL)
            # Ensure collection exists
            existing = [c.name for c in _qdrant_client.get_collections().collections]
            if QDRANT_COLLECTION not in existing:
                _qdrant_client.create_collection(
                    collection_name=QDRANT_COLLECTION,
                    vectors_config=VectorParams(size=VECTOR_DIMENSION, distance=Distance.COSINE),
                )
                print(f"[Indexer] Qdrant collection '{QDRANT_COLLECTION}' created.")
        except Exception as e:
            print(f"[Indexer] Warning: Qdrant unavailable: {e}")
            _qdrant_client = None
    return _qdrant_client


def _get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None:
        # Adaptive retry mode with 10 max attempts handles burst throttling
        retry_config = BotocoreConfig(
            retries={"max_attempts": 10, "mode": "adaptive"},
            read_timeout=60,
            connect_timeout=10,
        )
        _bedrock_client = boto3.client(
            "bedrock-runtime",
            region_name=BEDROCK_REGION,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            config=retry_config,
        )
    return _bedrock_client


# ─── Gemini Fallback Embedding ────────────────────────────────────────────────────
def _embed_text_gemini(text: str) -> list[float]:
    """Fallback: embed using Google Gemini gemini-embedding-2.
    
    Uses output_dimensionality=1536 (MRL) to match Titan v2 vector space
    so the Qdrant collection index does not need to be rebuilt.
    Raises RuntimeError if Gemini is also unavailable.
    """
    if not _gemini_available:
        raise RuntimeError("[Indexer] google-generativeai package not installed. Install it: pip install google-generativeai")
    if not GEMINI_API_KEY:
        raise RuntimeError("[Indexer] GEMINI_API_KEY not set — cannot use Gemini fallback embedding.")
    genai.configure(api_key=GEMINI_API_KEY)
    result = genai.embed_content(
        model=f"models/{GEMINI_EMBED_MODEL}",
        content=text[:8192],
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=VECTOR_DIMENSION,  # MRL: match Titan's 1536-dim
    )
    print(f"[Indexer] Gemini fallback embedding succeeded (dim={len(result['embedding'])}).")
    return result["embedding"]


# ─── Embedding with Bedrock Primary → Gemini Fallback ──────────────────────
def embed_text(text: str, max_retries: int = 6) -> list[float]:
    """
    Embed text using AWS Bedrock Titan (primary) → Google Gemini (fallback).

    Primary:  AWS Bedrock amazon.titan-embed-text-v2:0  — 1536-dim
    Fallback: Google gemini-embedding-2 (MRL 1536-dim)  — activated only if
              Bedrock fails after all retries or credentials are missing.

    Both providers output 1536-dim vectors, so existing Qdrant/OpenSearch
    indices remain fully compatible — no re-indexing needed.
    """
    bedrock = _get_bedrock_client()
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
                # Exponential backoff: 2^attempt seconds + random jitter (0-1s)
                wait = (2 ** attempt) + random.uniform(0, 1)
                print(f"[Indexer] Bedrock throttled (attempt {attempt+1}/{max_retries}). Retrying in {wait:.1f}s...")
                time.sleep(wait)
            else:
                print(f"[Indexer] Bedrock embedding failed after {attempt+1} attempts: {e}")
                print("[Indexer] Switching to Gemini fallback embedding...")
                return _embed_text_gemini(text)

    # Should not reach here, but guard anyway
    return _embed_text_gemini(text)


# ─── Document Indexing ────────────────────────────────────────────────────────
def index_document(
    doc_id: str,
    title: str,
    content: str,
    doc_type: str = "OTHER",
    firm_id: Optional[str] = None,
    client_id: Optional[str] = None,
    advisor_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Index a document into BOTH OpenSearch (BM25) and Qdrant (vector).

    Args:
        doc_id:     Unique document identifier (use PostgreSQL doc_id)
        title:      Document title (boosted in BM25 queries)
        content:    Full document text content
        doc_type:   RESEARCH_REPORT | ADVISOR_NOTE | EMAIL | CONTRACT | OTHER
        firm_id:    Optional firm scope for multi-tenant filtering
        client_id:  Optional client scope for RAG context personalization
        advisor_id: Optional advisor scope
        metadata:   Arbitrary dict of additional metadata

    Returns:
        True if both indexes succeed, False if either fails.
    """
    t0 = time.time()
    success = True

    # 1. Generate embedding
    try:
        vector = embed_text(f"{title}\n\n{content}")
        print(f"[Indexer] Embedded '{title[:50]}' ({len(content)} chars)")
    except Exception as e:
        print(f"[Indexer] ERROR: Embedding failed for doc {doc_id}: {e}")
        return False

    # 2. Index into OpenSearch (BM25)
    os_doc = {
        "doc_id":     doc_id,
        "title":      title,
        "content":    content,
        "doc_type":   doc_type,
        "firm_id":    firm_id,
        "client_id":  client_id,
        "advisor_id": advisor_id,
        "created_at": datetime.now(UTC).isoformat(),
        "content_vector": vector,
        "metadata":   metadata or {},
    }
    try:
        _get_os_client().index(index=INDEX_NAME, id=doc_id, body=os_doc, refresh=True)
        print(f"[Indexer] OpenSearch: indexed doc '{doc_id}'")
    except Exception as e:
        print(f"[Indexer] ERROR: OpenSearch indexing failed for doc {doc_id}: {e}")
        success = False

    # 3. Index into Qdrant (vector search)
    qdrant = _get_qdrant_client()
    if qdrant:
        try:
            point = PointStruct(
                id=abs(int(hashlib.md5(doc_id.encode()).hexdigest(), 16)) % (2**63),
                vector=vector,
                payload={
                    "doc_id":     doc_id,
                    "title":      title,
                    "content":    content,
                    "doc_type":   doc_type,
                    "firm_id":    firm_id,
                    "client_id":  client_id,
                    "advisor_id": advisor_id,
                    "metadata":   metadata or {},
                },
            )
            qdrant.upsert(collection_name=QDRANT_COLLECTION, points=[point])
            print(f"[Indexer] Qdrant: indexed doc '{doc_id}'")
        except Exception as e:
            print(f"[Indexer] ERROR: Qdrant indexing failed for doc {doc_id}: {e}")
            success = False

    elapsed = (time.time() - t0) * 1000
    print(f"[Indexer] doc '{doc_id}' indexed in {elapsed:.0f}ms | success={success}")
    return success


# ─── CLI Usage ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("[Indexer] Indexing a sample document...")
    result = index_document(
        doc_id="test-doc-001",
        title="Q1 2025 Market Outlook",
        content=(
            "The Federal Reserve is expected to cut rates twice in 2025 as inflation "
            "approaches the 2% target. Technology and healthcare sectors are projected "
            "to outperform. Advisors should consider reducing fixed income duration and "
            "increasing exposure to dividend-growth equities for income-seeking clients."
        ),
        doc_type="RESEARCH_REPORT",
        metadata={"source": "Internal Research", "quarter": "Q1-2025"},
    )
    print(f"[Indexer] Sample document indexed: {result}")
