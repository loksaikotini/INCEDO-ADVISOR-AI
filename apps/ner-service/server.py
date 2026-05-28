import os
import time
import grpc
from concurrent import futures
import spacy

# Ensure the proto path is in sys.path so generated files can import each other
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "proto"))

import ner_pb2
import ner_pb2_grpc

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
load_dotenv()

# ── Financial Entity Labels ────────────────────────────────────────────────────
FINANCIAL_LABELS = {
    "PERSON",       # Client names, advisor names
    "ORG",          # Company names, fund names
    "MONEY",        # Dollar amounts, AUM values
    "PERCENT",      # Return percentages, allocation percentages
    "DATE",         # Date references for portfolio queries
    "GPE",          # Geographic entities (market regions)
    "PRODUCT",      # Financial products, funds
    "TICKER",       # Stock tickers (AAPL, MSFT, etc.)
    "ACCOUNT",      # Account numbers/types
    "INSTRUMENT",   # Financial instruments
    "RISK_METRIC",  # VaR, Sharpe, Beta, etc.
}

TICKER_PATTERNS = [
    {"label": "TICKER", "pattern": [{"TEXT": {"REGEX": r"^[A-Z]{1,5}$"}}]},
]

RISK_METRIC_PATTERNS = [
    {"label": "RISK_METRIC", "pattern": [{"LOWER": {"IN": ["var", "sharpe", "beta", "drawdown", "volatility", "alpha"]}}]},
]

class NerServiceServicer(ner_pb2_grpc.NerServiceServicer):
    def __init__(self):
        print("[NER Service] Loading spaCy model (en_core_web_lg)...")
        try:
            self.nlp = spacy.load("en_core_web_lg")
            print("[NER Service] Model loaded successfully.")
        except OSError:
            print("[NER Service] Model not found. Downloading en_core_web_lg...")
            spacy.cli.download("en_core_web_lg")
            self.nlp = spacy.load("en_core_web_lg")
            
        # Add custom financial rules
        ruler = self.nlp.add_pipe("entity_ruler", before="ner", name="financial_ruler")
        ruler.add_patterns(TICKER_PATTERNS + RISK_METRIC_PATTERNS)
        
        # Add custom tokenizer for tickers (prevent splitting AAPL.US etc.)
        self.nlp.tokenizer.add_special_case("U.S.", [{"ORTH": "U.S."}])

    def RecognizeEntities(self, request, context):
        start_time = time.time()
        text = request.text
        
        doc = self.nlp(text)
        entities = []
        
        filter_labels = set(request.entity_types) if request.entity_types else FINANCIAL_LABELS
        seen_spans = set()
        
        for ent in doc.ents:
            if ent.label_ not in filter_labels:
                continue
                
            # Deduplicate overlapping entities
            span_key = (ent.start, ent.end)
            if span_key in seen_spans:
                continue
            seen_spans.add(span_key)
            
            # Heuristic confidence scoring based on reference implementation
            confidence = 0.95 if ent.label_ == "TICKER" else (0.90 if ent.label_ in ["DATE", "RISK_METRIC"] else 0.85)
            
            entities.append(ner_pb2.NerEntity(
                text=ent.text,
                label=ent.label_,
                start=ent.start_char,
                end=ent.end_char,
                confidence=confidence
            ))
            
        processed_in_ms = int((time.time() - start_time) * 1000)
        
        print(f"[NER Service] Processed request {request.session_id} in {processed_in_ms}ms, found {len(entities)} entities.")
        
        return ner_pb2.NerResponse(
            entities=entities,
            processed_in_ms=processed_in_ms
        )

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    ner_pb2_grpc.add_NerServiceServicer_to_server(NerServiceServicer(), server)
    
    port = "5002"
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    print(f"[NER Service] gRPC server listening on port {port}")
    server.wait_for_termination()

if __name__ == "__main__":
    serve()
