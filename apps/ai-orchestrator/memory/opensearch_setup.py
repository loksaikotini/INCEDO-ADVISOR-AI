# FILE: apps/ai-orchestrator/memory/opensearch_setup.py
# Ref: Blueprint §3.3 — OpenSearch as the BM25 retrieval backend
# Run once: python memory/opensearch_setup.py
# Creates the advisor_knowledge index with both text (BM25) and knn_vector fields.

import os
from dotenv import load_dotenv
from opensearchpy import OpenSearch, RequestsHttpConnection

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv()

OPENSEARCH_ENDPOINT = os.getenv("OPENSEARCH_ENDPOINT", "http://localhost:9200")
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER", "admin")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD", "admin")
INDEX_NAME = os.getenv("OPENSEARCH_INDEX_KNOWLEDGE", "advisor_knowledge")

# ─── Determine if endpoint is http or https ───────────────────────────────────
use_ssl = OPENSEARCH_ENDPOINT.startswith("https://")
host = OPENSEARCH_ENDPOINT.replace("https://", "").replace("http://", "").rstrip("/")

client = OpenSearch(
    hosts=[{"host": host, "port": 443 if use_ssl else 9200}],
    http_auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
    use_ssl=use_ssl,
    verify_certs=True,
    connection_class=RequestsHttpConnection,
    timeout=30,
)

# ─── Index Mapping ────────────────────────────────────────────────────────────
# - content: analyzed text for BM25 full-text search
# - title: analyzed text for BM25 (title-boosted queries)
# - content_vector: 1536-dim knn_vector for Bedrock Titan v2 embeddings
# - doc_type: keyword for filtering (RESEARCH_REPORT, ADVISOR_NOTE, EMAIL, etc.)
# - metadata: object for arbitrary key-value pairs
INDEX_MAPPING = {
    "settings": {
        "index": {
            "knn": True,                # Enable k-NN plugin
            "knn.algo_param.ef_search": 512,
            "number_of_shards": 1,
            "number_of_replicas": 0,
        }
    },
    "mappings": {
        "properties": {
            "doc_id":    {"type": "keyword"},
            "title":     {"type": "text",    "analyzer": "english"},
            "content":   {"type": "text",    "analyzer": "english"},
            "doc_type":  {"type": "keyword"},
            "firm_id":   {"type": "keyword"},
            "client_id": {"type": "keyword"},
            "advisor_id":{"type": "keyword"},
            "created_at":{"type": "date"},
            "content_vector": {
                "type":            "knn_vector",
                "dimension":       1536,        # Bedrock Titan Embed Text v2
                "method": {
                    "name":        "hnsw",
                    "space_type":  "cosinesimil",
                    "engine":      "nmslib",
                    "parameters": {
                        "ef_construction": 512,
                        "m": 16,
                    },
                },
            },
            "metadata": {"type": "object", "enabled": False},
        }
    },
}


def create_index():
    if client.indices.exists(index=INDEX_NAME):
        print(f"[OpenSearch Setup] Index '{INDEX_NAME}' already exists. Skipping creation.")
        return

    response = client.indices.create(index=INDEX_NAME, body=INDEX_MAPPING)
    print(f"[OpenSearch Setup] Index '{INDEX_NAME}' created: {response}")


def verify_connection():
    info = client.info()
    print(f"[OpenSearch Setup] Connected to cluster: {info['cluster_name']} (version {info['version']['number']})")


if __name__ == "__main__":
    print("[OpenSearch Setup] Verifying connection...")
    verify_connection()
    print(f"[OpenSearch Setup] Creating index '{INDEX_NAME}'...")
    create_index()
    print("[OpenSearch Setup] Done.")
