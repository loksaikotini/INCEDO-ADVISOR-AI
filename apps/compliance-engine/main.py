import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
load_dotenv()
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from incedo_core.auth import get_current_user
from prisma import Prisma
from contextlib import asynccontextmanager
import uuid
import json
import asyncio
from compliance_service import ComplianceService

db = Prisma()
compliance_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global compliance_service
    # Staggered startup to prevent Prisma engine binary lock collision with API Gateway and Orchestrator
    await asyncio.sleep(6)
    for attempt in range(5):
        try:
            await db.connect(timeout=20)
            break
        except Exception as e:
            print(f"Prisma connection failed (attempt {attempt+1}/5): {e}")
            if attempt == 4:
                raise
            await asyncio.sleep(2)
    compliance_service = ComplianceService(db)
    yield
    await db.disconnect()

app = FastAPI(title="Compliance Engine API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class PolicyCreateRequest(BaseModel):
    title: str
    content: str

async def log_audit_action(actor_id, entity_type, entity_id, action, before_data=None, after_data=None, ip_address="127.0.0.1", metadata=None):
    await db.auditlog.create(data={
        "log_id": str(uuid.uuid4()), "actor_id": actor_id, "entity_type": entity_type, "entity_id": entity_id, "action": action,
        "before_data": json.dumps(before_data or {}), "after_data": json.dumps(after_data or {}), "ip_address": ip_address, "metadata": json.dumps(metadata or {})
    })

@app.get("/api/v1/compliance/portal")
async def get_compliance_portal(user: dict = Depends(get_current_user)):
    if user["role"] not in ["COMPLIANCE", "ADMIN"]: raise HTTPException(403, "Access denied")
    
    audit_logs, violations, recs, docs = await asyncio.gather(
        db.auditlog.find_many(take=20, order={"created_at": "desc"}),
        db.complianceevent.find_many(where={"outcome": "FAIL"}, take=20, order={"triggered_at": "desc"}),
        db.airecommendation.find_many(take=20, order={"created_at": "desc"}),
        db.document.find_many(where={"doc_type": "OTHER"}, take=20, order={"created_at": "desc"})
    )
    
    # Filter docs for policies
    policies = [d for d in docs if d.metadata and (d.metadata.get("is_policy") == True if isinstance(d.metadata, dict) else json.loads(d.metadata).get("is_policy") == True)]
    
    return {
        "audit_logs": [log.model_dump() for log in audit_logs],
        "ai_recommendations": [r.model_dump() for r in recs],
        "advisor_activities": [], # Can be hydrated if AdvisorActivity table exists
        "compliance_violations": [v.model_dump() for v in violations],
        "policy_documents": [p.model_dump() for p in policies]
    }

class ComplianceCheckRequest(BaseModel):
    firm_id: str
    advisor_id: str
    client_id: str | None = None
    recommendation_text: str | None = None
    payload: dict = {}
    context_type: str = "GENERAL"

@app.post("/api/v1/compliance/validate")
async def validate_recommendation(req: ComplianceCheckRequest, user: dict = Depends(get_current_user)):
    """
    Ref: Blueprint §6 Task 5 — Compliance Engine validates AI recommendations before delivery
    """
    # In a real scenario, we'd verify firm_id matches user["firm_id"]
    return await compliance_service.validate(req.dict())

@app.post("/api/v1/compliance/policy")
async def frame_compliance_policy(req: PolicyCreateRequest, user: dict = Depends(get_current_user)):
    if user["role"] not in ["COMPLIANCE", "ADMIN"]: raise HTTPException(403, "Access denied")
    new_doc = await db.document.create(data={
        "doc_id": str(uuid.uuid4()), "firm_id": user["firm_id"], "advisor_id": user["sub"], "doc_type": "OTHER", "title": req.title, "content": req.content, "metadata": {"is_policy": True}
    })
    await log_audit_action(user["sub"], "DOCUMENT", new_doc.doc_id, "CREATE_POLICY", after_data={"title": req.title})
    return {"status": "success", "policy": {"doc_id": new_doc.doc_id, "title": new_doc.title}}

@app.get("/health")
def health(): return {"status": "ok", "service": "compliance-engine"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3003, reload=True)
