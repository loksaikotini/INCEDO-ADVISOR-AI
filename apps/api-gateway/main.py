from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
load_dotenv()
import uuid
import json
from contextlib import asynccontextmanager
import bcrypt
from prisma import Prisma
from incedo_core.auth import create_access_token, get_current_user
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
import httpx
from fastapi import Response
from incedo_core.integrations.crm import get_top_clients
from incedo_core.integrations.trading import get_compliance_alerts
from incedo_core.integrations.portfolio import get_portfolio_summary
from incedo_core.integrations.research import get_market_trends
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

db = Prisma()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to the database on startup
    for attempt in range(5):
        try:
            await db.connect(timeout=20)
            break
        except Exception as e:
            print(f"Prisma connection failed (attempt {attempt+1}/5): {e}")
            if attempt == 4:
                raise
            await asyncio.sleep(2)
    yield
    # Disconnect on shutdown
    await db.disconnect()


app = FastAPI(title="Advisor AI Copilot Backend", version="1.0.0", lifespan=lifespan)

# Setup CORS
CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler — ensures CORS headers are always present even on 500 errors.
# Without this, FastAPI drops CORS headers on unhandled exceptions and the browser
# misreports the real error as a CORS policy violation.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    allow_origin = origin if origin in CORS_ORIGINS else CORS_ORIGINS[0]
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}"},
        headers={
            "Access-Control-Allow-Origin": allow_origin,
            "Access-Control-Allow-Credentials": "true",
        },
    )


@app.api_route("/api/v1/chat/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def chat_proxy(path: str, request: Request):
    """Single optimized proxy for all AI Orchestrator chat endpoints.
    
    Only forwards safe headers to avoid upstream deadlocks caused by
    raw browser headers like Host, Content-Length, and Transfer-Encoding.
    Reads the JWT from the Authorization header (which the frontend always
    sends via the ApiClient). """
    url = f"http://127.0.0.1:3002/api/v1/chat/{path}"

    # Only forward safe, relevant headers — never the raw browser Host or
    # Content-Length which can cause uvicorn/httpx to deadlock.
    safe_headers: dict[str, str] = {}
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth:
        safe_headers["Authorization"] = auth
    content_type = request.headers.get("content-type")
    if content_type:
        safe_headers["Content-Type"] = content_type

    body = await request.body()

    if "stream" in path:
        async def stream_generator():
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream(
                    method=request.method,
                    url=url,
                    headers=safe_headers,
                    content=body,
                ) as response:
                    async for chunk in response.aiter_bytes():
                        yield chunk
        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.request(
                method=request.method,
                url=url,
                headers=safe_headers,
                content=body,
            )
        return Response(
            content=response.content,
            status_code=response.status_code,
            media_type="application/json",
        )


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    firmName: str
    regulatoryId: str
    advisorName: str
    email: str
    password: str
    role: Optional[str] = "ADVISOR"


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "copilot-backend-python"}


@app.post("/api/v1/auth/login")
async def login(req: LoginRequest):
    email_clean = req.email.strip().lower()
    print(f"DEBUG: Login attempt for email: '{email_clean}'")

    raw_advisors = await db.query_raw("SELECT * FROM advisor WHERE email = $1", email_clean)

    if not raw_advisors:
        print("DEBUG: Raising 401 - Advisor not found")
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    advisor_raw = raw_advisors[0]
    
    if not advisor_raw.get("password_hash"):
        print("DEBUG: Raising 401 - No password hash")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    is_valid = False
    try:
        is_valid = bcrypt.checkpw(req.password.encode('utf-8'), advisor_raw["password_hash"].encode('utf-8'))
    except Exception as e:
        print(f"DEBUG: bcrypt checkpw failed: {e}")
        
    if not is_valid:
        print("DEBUG: Raising 401 - Password mismatch")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    firm = await db.firm.find_unique(where={"firm_id": advisor_raw["firm_id"]})

    token = create_access_token(
        data={
            "sub": advisor_raw["advisor_id"],
            "email": advisor_raw["email"],
            "firm_id": advisor_raw["firm_id"],
            "role": advisor_raw["role"],
            "name": advisor_raw["name"],
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": advisor_raw["advisor_id"],
            "name": advisor_raw["name"],
            "email": advisor_raw["email"],
            "role": advisor_raw["role"],
            "firm_id": advisor_raw["firm_id"],
            "firm": firm.name if firm else "",
        },
    }


@app.post("/api/v1/auth/register")
async def register(req: RegisterRequest):
    import uuid

    email_clean = req.email.strip().lower()
    print(f"DEBUG: Register request received: {req}")

    # Check if user already exists
    existing = await db.advisor.find_unique(where={"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=400, detail="A user with this email already exists"
        )

    # Create firm
    firm = await db.firm.create(
        data={
            "firm_id": str(uuid.uuid4()),
            "name": req.firmName,
            "regulatory_id": req.regulatoryId,
        }
    )

    requested_role = req.role.upper() if req.role else "ADVISOR"
    if requested_role not in ["ADVISOR", "COMPLIANCE", "OPERATIONS", "ADMIN"]:
        requested_role = "ADVISOR"

    hashed_password = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Create advisor using raw SQL to bypass Pydantic model missing password_hash
    advisor_id = str(uuid.uuid4())
    await db.execute_raw(
        'INSERT INTO advisor (advisor_id, firm_id, name, email, password_hash, role, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
        advisor_id, firm.firm_id, req.advisorName, email_clean, hashed_password, requested_role
    )

    token = create_access_token(
        data={
            "sub": advisor_id,
            "email": email_clean,
            "firm_id": firm.firm_id,
            "role": requested_role,
            "name": req.advisorName,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": advisor_id,
            "name": req.advisorName,
            "email": email_clean,
            "role": requested_role,
            "firm_id": firm.firm_id,
            "firm": firm.name,
        },
    }


@app.get("/api/v1/dashboard/metrics")
async def get_dashboard_metrics(user: dict = Depends(get_current_user)):
    role = user["role"]
    if role == "ADMIN":
        clients_where = {}
    elif role in ["COMPLIANCE", "OPERATIONS"]:
        clients_where = {"firm_id": user["firm_id"]}
    else:
        clients_where = {"advisor_id": user["sub"]}

    clients = await db.client.find_many(
        where=clients_where,
        include={"accounts": {"include": {"portfolio_snapshots": True}}},
    )

    total_aum = 0
    for c in clients:
        if c.accounts:
            for a in c.accounts:
                if a.portfolio_snapshots:
                    total_aum += float(a.portfolio_snapshots[0].nav)

    # Fetch pending recommendations from database
    if role == "ADMIN":
        recs_where = {"acted_on": False}
    elif role in ["COMPLIANCE", "OPERATIONS"]:
        recs_where = {"client": {"firm_id": user["firm_id"]}, "acted_on": False}
    else:
        recs_where = {"advisor_id": user["sub"], "acted_on": False}

    recs = await db.airecommendation.find_many(
        where=recs_where, include={"client": True}
    )

    pending_actions = []
    for r in recs:
        payload = r.payload
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except:
                payload = {}
        pending_actions.append(
            {
                "rec_id": r.rec_id,
                "client_name": r.client.name if r.client else "Unknown Client",
                "type": r.rec_type,
                "payload": payload,
                "created_at": r.created_at.isoformat(),
            }
        )

    return {
        "totalAum": total_aum,
        "activeClients": len(clients),
        "role": user["role"],
        "firmId": user["firm_id"],
        "pending_actions": pending_actions,
    }


@app.post("/api/v1/advisor/recommendations/generate")
async def generate_recommendations(user: dict = Depends(get_current_user)):
    # Fetch market trends to identify market opportunities for NBA (Next Best Action)
    try:
        market_trends = await get_market_trends()
        top_movers = market_trends.get("top_movers", [])
    except Exception:
        top_movers = []

    # Fetch all clients of the advisor along with their accounts and portfolio snapshots
    clients = await db.client.find_many(
        where={"advisor_id": user["sub"]},
        include={"accounts": {"include": {"portfolio_snapshots": True}}},
    )

    if not clients:
        raise HTTPException(status_code=404, detail="No clients found for this advisor")

    generated_count = 0
    import random

    for client in clients:
        # Check if client already has pending recommendations
        existing_recs = await db.airecommendation.find_many(
            where={"client_id": client.client_id, "acted_on": False}
        )
        if len(existing_recs) >= 2:
            continue

        # Analyze client behavior flags
        behavioral_flags = client.behavioral_flags or []
        life_events = client.life_events or []
        risk_profile = client.risk_profile or "MODERATE"

        # Analyze portfolio holdings
        total_nav = 0.0
        holdings = []
        if client.accounts:
            for acc in client.accounts:
                if acc.portfolio_snapshots:
                    latest_snap = acc.portfolio_snapshots[0]
                    total_nav += float(latest_snap.nav)
                    snap_holdings = latest_snap.holdings
                    if isinstance(snap_holdings, str):
                        try:
                            snap_holdings = json.loads(snap_holdings)
                        except:
                            snap_holdings = []
                    if isinstance(snap_holdings, list):
                        holdings.extend(snap_holdings)

        cash_value = 0.0
        tech_value = 0.0
        for h in holdings:
            ticker = h.get("ticker", "")
            mv = float(h.get("market_value", 0))
            if ticker == "CASH" or "cash" in ticker.lower():
                cash_value += mv
            if ticker in ["AAPL", "NVDA", "MSFT"]:
                tech_value += mv

        cash_pct = (cash_value / total_nav * 100) if total_nav > 0 else 0
        tech_pct = (tech_value / total_nav * 100) if total_nav > 0 else 0

        # Dynamic Recommendation candidates
        candidates = []

        # Market-Driven Next Best Actions (NBA)
        for mover in top_movers:
            sym = mover.get("symbol", "")
            change_str = mover.get("change", "0%")
            try:
                change_val = float(change_str.replace("+", "").replace("%", ""))
            except ValueError:
                change_val = 0.0

            # Check if client holds this symbol
            client_holding = next((h for h in holdings if h.get("ticker") == sym), None)

            if client_holding and change_val >= 2.0:
                mv = float(client_holding.get("market_value", 0))
                candidates.append(
                    {
                        "rec_type": "REBALANCE",
                        "payload": {
                            "title": f"Take Profits on {sym} Rally",
                            "description": f"{sym} has surged by {change_str} today. The client holds ${mv:,.2f} of {sym}. Recommend taking partial profits to lock in gains.",
                            "impact": "High",
                            "color": "emerald",
                        },
                        "shap": {
                            "market_trend": 0.8,
                            "client_exposure": 0.1,
                            "volatility": 0.1,
                        },
                    }
                )
            elif client_holding and change_val <= -2.0:
                mv = float(client_holding.get("market_value", 0))
                candidates.append(
                    {
                        "rec_type": "RISK_ALERT",
                        "payload": {
                            "title": f"Review {sym} Position Drop",
                            "description": f"{sym} dropped by {change_str} today. The client holds ${mv:,.2f} of {sym}. Recommend reviewing for tax-loss harvesting or averaging down.",
                            "impact": "Medium",
                            "color": "purple",
                        },
                        "shap": {
                            "market_trend": 0.7,
                            "tax_loss_opp": 0.2,
                            "client_exposure": 0.1,
                        },
                    }
                )

        # 1. High Cash Strategy
        if "HIGH_CASH_BALANCE" in behavioral_flags or cash_pct > 15:
            candidates.append(
                {
                    "rec_type": "UPSELL",
                    "payload": {
                        "title": "High Yield Cash Optimization",
                        "description": f"Client holds ${cash_value:,.2f} ({cash_pct:.1f}% of portfolio) in low-yield cash. Recommend deploying ${cash_value*0.75:,.2f} into a short-duration treasury ladder yielding 5.25% to maximize risk-free yield.",
                        "impact": "High",
                        "color": "purple",
                    },
                    "shap": {
                        "cash_ratio": 0.5,
                        "yield_spread": 0.3,
                        "client_risk": 0.2,
                    },
                }
            )

        # 2. Tech Overweight Rebalancing
        if tech_pct > 20:
            candidates.append(
                {
                    "rec_type": "REBALANCE",
                    "payload": {
                        "title": "Concentrated Tech Rebalance",
                        "description": f"Technology holdings (AAPL, NVDA, MSFT) represent {tech_pct:.1f}% of total portfolio value, exceeding standard single sector risk limits. Recommend trimming positions and reallocating to broader diversified ETFs to manage concentration volatility.",
                        "impact": "High",
                        "color": "blue",
                    },
                    "shap": {
                        "concentration_pct": 0.6,
                        "sector_drift": 0.3,
                        "market_vol": 0.1,
                    },
                }
            )

        # 3. ESG Fund Alignment
        if "ESG_FOCUS" in behavioral_flags:
            candidates.append(
                {
                    "rec_type": "CROSS_SELL",
                    "payload": {
                        "title": "ESG Core Allocation Shift",
                        "description": "Client profile highlights ESG focus. Recommend swapping standard S&P 500 ETF (SPY) exposure with iShares ESG Aware MSCI USA ETF (ESGU) to align with sustainability goals while maintaining core equity exposure.",
                        "impact": "Medium",
                        "color": "emerald",
                    },
                    "shap": {
                        "behavioral_esg": 0.7,
                        "sustainability_score": 0.2,
                        "fee_impact": 0.1,
                    },
                }
            )

        # 4. Retirement Income Matching
        if (
            "UPCOMING_RETIREMENT" in life_events
            or client.life_stage == "NEAR_RETIREMENT"
        ):
            candidates.append(
                {
                    "rec_type": "RISK_ALERT",
                    "payload": {
                        "title": "Retirement Income Laddering",
                        "description": f"Client is approaching the retirement phase. Recommend shifting a portion of capital from aggressive growth equities into short-duration corporate bond ladders and high-dividend assets to establish a cash-flow buffer.",
                        "impact": "High",
                        "color": "purple",
                    },
                    "shap": {
                        "life_stage": 0.65,
                        "drawdown_risk": 0.25,
                        "income_yield": 0.1,
                    },
                }
            )

        # 5. Default General Rebalance
        if not candidates:
            candidates.append(
                {
                    "rec_type": "REBALANCE",
                    "payload": {
                        "title": "Portfolio Drift Correction",
                        "description": f"Portfolio asset classes have drifted from the target {risk_profile.lower()} risk profile. Recommend standard rebalancing to buy under-allocated bonds and re-align core target metrics.",
                        "impact": "Medium",
                        "color": "blue",
                    },
                    "shap": {
                        "asset_drift": 0.55,
                        "volatility_index": 0.25,
                        "client_tenure": 0.2,
                    },
                }
            )

        # Pick one candidate that doesn't already exist in pending
        random.shuffle(candidates)
        for cand in candidates:
            exists = any(r.rec_type == cand["rec_type"] for r in existing_recs)
            if not exists:
                await db.airecommendation.create(
                    data={
                        "rec_id": str(uuid.uuid4()),
                        "rec_type": cand["rec_type"],
                        "payload": json.dumps(cand["payload"]),
                        "shap_explanation": json.dumps(cand["shap"]),
                        "acted_on": False,
                        "advisor": {"connect": {"advisor_id": user["sub"]}},
                        "client": {"connect": {"client_id": client.client_id}},
                    }
                )
                generated_count += 1
                break

    return {"status": "success", "generated": generated_count}


@app.post("/api/v1/advisor/recommendations/{rec_id}/act")
async def act_on_recommendation(rec_id: str, user: dict = Depends(get_current_user)):
    rec = await db.airecommendation.find_unique(where={"rec_id": rec_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.advisor_id != user["sub"]:
        raise HTTPException(
            status_code=403, detail="Not authorized to act on this recommendation"
        )

    await db.airecommendation.update(where={"rec_id": rec_id}, data={"acted_on": True})
    return {
        "status": "success",
        "message": f"Recommendation {rec_id} marked as acted on.",
    }


@app.get("/api/v1/advisor/dashboard")
async def advisor_dashboard(user: dict = Depends(get_current_user)):
    clients = await db.client.find_many(
        where={"advisor_id": user["sub"]},
        include={"accounts": {"include": {"portfolio_snapshots": True}}},
    )
    total_aum = 0
    for c in clients:
        if c.accounts:
            for a in c.accounts:
                if a.portfolio_snapshots:
                    total_aum += float(a.portfolio_snapshots[0].nav)
    return {"summary": {"total_aum": total_aum, "total_clients": len(clients)}}


@app.get("/api/v1/advisor/meeting-prep/{client_id}")
async def get_meeting_prep(client_id: str, user: dict = Depends(get_current_user)):
    # 1. Fetch Client Profile & Portfolio
    client = await db.client.find_unique(
        where={"client_id": client_id},
        include={
            "accounts": {
                "include": {
                    "portfolio_snapshots": True, 
                    "transactions": {"include": {"instrument": True}}
                }
            }
        },
    )
    if not client or client.advisor_id != user["sub"]:
        raise HTTPException(status_code=404, detail="Client not found or access denied")

    total_nav = 0
    recent_transactions = []
    if client.accounts:
        for a in client.accounts:
            if a.portfolio_snapshots:
                total_nav += float(a.portfolio_snapshots[0].nav)
            if a.transactions:
                for t in a.transactions:
                    recent_transactions.append(
                        {
                            "type": t.type,
                            "quantity": float(t.quantity),
                            "ticker": t.instrument.ticker if t.instrument else "UNKNOWN",
                            "executed_at": t.executed_at.isoformat(),
                        }
                    )

    # Sort recent_transactions by date desc and take top 5
    recent_transactions.sort(key=lambda x: x["executed_at"], reverse=True)
    recent_transactions = recent_transactions[:5]

    # 2. Fetch AI Recommendations
    recs = await db.airecommendation.find_many(
        where={"client_id": client_id, "acted_on": False}, take=3
    )
    pending_recs = []
    for r in recs:
        # payload usually has action details
        import json

        payload = (
            r.payload
            if isinstance(r.payload, dict)
            else json.loads(r.payload) if isinstance(r.payload, str) else {}
        )
        pending_recs.append(
            {
                "title": str(r.rec_type).replace("_", " "),
                "description": payload.get(
                    "rationale", "Review recommendation for client."
                ),
            }
        )

    # Dynamic talking points generation
    try:
        llm = ChatGoogleGenerativeAI(model=os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"), temperature=0.7)
        prompt = f"""
You are an expert financial advisor preparing for a client meeting.
Client Profile: {client.segment} segment, {client.risk_profile} risk tolerance.
Total Portfolio Value: ${total_nav:,.2f}.
Recent transactions: {[t['ticker'] + ' ' + t['type'] for t in recent_transactions]}
Pending Recommendations: {[r['title'] for r in pending_recs]}

Based on this information, generate 3 highly specific, professional talking points for the upcoming client meeting.
Return exactly 3 bullet points separated by newlines, with no markdown formatting like asterisks or dashes. Just the text.
"""
        response = llm.invoke([HumanMessage(content=prompt)])
        talking_points = [line.strip().lstrip("-* ").strip() for line in response.content.strip().split("\n") if line.strip()]
        # Ensure we have exactly 3 points
        talking_points = talking_points[:3]
        while len(talking_points) < 3:
            talking_points.append("Discuss broader portfolio strategy.")
    except Exception as e:
        print(f"Error generating talking points: {e}")
        talking_points = [
            f"Review recent portfolio drift in {client.segment} segment.",
            f"Discuss tax-loss harvesting opportunities.",
            f"Re-assess {client.risk_profile} risk tolerance given recent market volatility.",
        ]

    return {
        "client_summary": {
            "name": client.name,
            "segment": client.segment,
            "risk_profile": client.risk_profile,
            "total_nav": total_nav,
        },
        "talking_points": talking_points,
        "pending_recommendations": pending_recs,
        "recent_transactions": recent_transactions,
    }


@app.get("/api/v1/portfolio/book")
async def portfolio_book(user: dict = Depends(get_current_user)):
    role = user["role"]
    if role == "ADMIN":
        where_filter = {}
    elif role in ["COMPLIANCE", "OPERATIONS"]:
        where_filter = {"firm_id": user["firm_id"]}
    else:
        where_filter = {"advisor_id": user["sub"]}

    clients = await db.client.find_many(
        where=where_filter,
        include={"accounts": {"include": {"portfolio_snapshots": True}}},
    )
    client_data = []
    for c in clients:
        nav = 0
        if c.accounts:
            for a in c.accounts:
                if a.portfolio_snapshots:
                    nav += float(a.portfolio_snapshots[0].nav)

        name = c.name if c.name else "Unknown Client"

        client_data.append(
            {
                "client_id": c.client_id,
                "name": name,
                "email": c.email,
                "segment": c.segment,
                "risk_profile": c.risk_profile,
                "kyc_status": c.kyc_status,
                "total_nav": nav,
            }
        )
    return {"clients": client_data}


class CreateClientRequest(BaseModel):
    name: str
    email: Optional[str] = None
    risk_profile: str = "MODERATE"
    kyc_status: str = "PENDING"
    segment: str = "RETAIL"
    life_stage: Optional[str] = None
    behavioral_flags: Optional[List[str]] = []
    life_events: Optional[List[str]] = []


@app.post("/api/v1/advisor/clients")
async def create_client(
    req: CreateClientRequest, user: dict = Depends(get_current_user)
):
    import uuid

    risk_profile = req.risk_profile.upper()
    if risk_profile not in [
        "CONSERVATIVE",
        "MODERATE",
        "AGGRESSIVE",
        "VERY_AGGRESSIVE",
    ]:
        risk_profile = "MODERATE"

    kyc_status = req.kyc_status.upper()
    if kyc_status not in ["PENDING", "APPROVED", "REJECTED", "EXPIRED"]:
        kyc_status = "PENDING"

    new_client = await db.client.create(
        data={
            "client_id": str(uuid.uuid4()),
            "firm_id": user["firm_id"],
            "advisor_id": user["sub"],
            "name": req.name,
            "email": req.email,
            "risk_profile": risk_profile,
            "kyc_status": kyc_status,
            "segment": req.segment,
            "life_stage": req.life_stage,
            "behavioral_flags": req.behavioral_flags or [],
            "life_events": req.life_events or [],
        }
    )
    return new_client


@app.get("/api/v1/advisor/clients/{client_id}")
async def get_client_details(client_id: str, user: dict = Depends(get_current_user)):
    print(
        f"DEBUG: get_client_details called for client_id={client_id}, user={user['sub']}"
    )
    try:
        # Test basic query first
        basic_client = await db.client.find_unique(where={"client_id": client_id})
        print(f"DEBUG: basic client check: {basic_client is not None}")
        if basic_client:
            print(
                f"DEBUG: basic client advisor_id={basic_client.advisor_id}, user={user['sub']}"
            )

        client = await db.client.find_unique(
            where={"client_id": client_id},
            include={
                "accounts": {
                    "include": {
                        "portfolio_snapshots": True,
                        "transactions": {"include": {"instrument": True}},
                    }
                },
                "ai_recommendations": True,
                "alerts": True,
                "documents": True,
            },
        )
        print(f"DEBUG: full client query returned: {client is not None}")
    except Exception as e:
        print(f"DEBUG: query raised exception: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database query error: {str(e)}")

    if not client:
        print("DEBUG: Client not found!")
        raise HTTPException(status_code=404, detail="Client not found")

    role = user["role"]
    is_allowed = False
    if role == "ADMIN":
        is_allowed = True
    elif role in ["COMPLIANCE", "OPERATIONS"]:
        is_allowed = client.firm_id == user["firm_id"]
    else:
        is_allowed = client.advisor_id == user["sub"]

    if not is_allowed:
        print(
            f"DEBUG: Access denied to client={client_id} for user={user['sub']} with role={role}"
        )
        raise HTTPException(status_code=403, detail="Access denied")

    # Safely map to serializable dict to prevent Decimal serialization issues in JSON responses
    accounts_data = []
    all_transactions = []

    if client.accounts:
        for acc in client.accounts:
            snapshots_data = []
            if acc.portfolio_snapshots:
                for snap in acc.portfolio_snapshots:
                    holdings = snap.holdings
                    if isinstance(holdings, str):
                        try:
                            holdings = json.loads(holdings)
                        except:
                            pass

                    snapshots_data.append(
                        {
                            "snapshot_id": snap.snapshot_id,
                            "snapshot_ts": snap.snapshot_ts.isoformat(),
                            "nav": float(snap.nav) if snap.nav is not None else 0.0,
                            "holdings": holdings,
                            "risk_metrics": snap.risk_metrics,
                        }
                    )

            txns_data = []
            if acc.transactions:
                for txn in acc.transactions:
                    txn_dict = {
                        "txn_id": txn.txn_id,
                        "type": txn.type,
                        "quantity": (
                            float(txn.quantity) if txn.quantity is not None else 0.0
                        ),
                        "price": float(txn.price) if txn.price is not None else 0.0,
                        "executed_at": txn.executed_at.isoformat(),
                        "status": txn.status,
                        "metadata": txn.metadata,
                        "instrument": (
                            {
                                "instrument_id": txn.instrument.instrument_id,
                                "ticker": txn.instrument.ticker,
                                "name": txn.instrument.name,
                                "asset_class": txn.instrument.asset_class,
                            }
                            if txn.instrument
                            else None
                        ),
                    }
                    txns_data.append(txn_dict)
                    all_transactions.append(
                        {
                            **txn_dict,
                            "account_id": acc.account_id,
                            "account_type": acc.account_type,
                        }
                    )

            accounts_data.append(
                {
                    "account_id": acc.account_id,
                    "account_type": acc.account_type,
                    "custodian": acc.custodian,
                    "currency": acc.currency,
                    "status": acc.status,
                    "portfolio_snapshots": snapshots_data,
                    "transactions": txns_data,
                }
            )

    recs_data = []
    if client.ai_recommendations:
        for r in client.ai_recommendations:
            payload = r.payload
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except:
                    pass
            recs_data.append(
                {
                    "rec_id": r.rec_id,
                    "rec_type": r.rec_type,
                    "payload": payload,
                    "shap_explanation": r.shap_explanation,
                    "acted_on": r.acted_on,
                    "created_at": r.created_at.isoformat(),
                }
            )

    alerts_data = []
    if client.alerts:
        for a in client.alerts:
            alerts_data.append(
                {
                    "alert_id": a.alert_id,
                    "alert_type": a.alert_type,
                    "severity": a.severity,
                    "message": a.message,
                    "is_read": a.is_read,
                    "created_at": a.created_at.isoformat(),
                }
            )

    docs_data = []
    if client.documents:
        for d in client.documents:
            docs_data.append(
                {
                    "doc_id": d.doc_id,
                    "doc_type": d.doc_type,
                    "title": d.title,
                    "content": d.content,
                    "metadata": d.metadata,
                    "created_at": d.created_at.isoformat(),
                }
            )

    profile = client.profile
    if isinstance(profile, str):
        try:
            profile = json.loads(profile)
        except:
            pass

    return {
        "client_id": client.client_id,
        "name": client.name,
        "email": client.email,
        "profile": profile,
        "risk_profile": client.risk_profile,
        "kyc_status": client.kyc_status,
        "segment": client.segment,
        "life_stage": client.life_stage,
        "behavioral_flags": client.behavioral_flags,
        "life_events": client.life_events,
        "created_at": client.created_at.isoformat(),
        "accounts": accounts_data,
        "ai_recommendations": recs_data,
        "alerts": alerts_data,
        "documents": docs_data,
        "all_transactions": sorted(
            all_transactions, key=lambda x: x["executed_at"], reverse=True
        ),
    }


@app.delete("/api/v1/advisor/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    # 1. Fetch client and verify ownership
    client = await db.client.find_unique(
        where={"client_id": client_id}, include={"accounts": True}
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.advisor_id != user["sub"]:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this client"
        )

    # 2. Delete dependant data of accounts manually due to onDelete: Restrict
    if client.accounts:
        for acc in client.accounts:
            # Delete transactions belonging to account first
            await db.transaction.delete_many(where={"account_id": acc.account_id})
            # Delete portfolio_snapshots belonging to account
            await db.portfoliosnapshot.delete_many(where={"account_id": acc.account_id})
            # Delete account itself
            await db.account.delete(where={"account_id": acc.account_id})

    # 3. Delete related conversations, ai_recommendations, alerts, and documents
    await db.conversation.delete_many(where={"client_id": client_id})
    await db.airecommendation.delete_many(where={"client_id": client_id})
    await db.alert.delete_many(where={"client_id": client_id})
    await db.document.delete_many(where={"client_id": client_id})

    # 4. Finally delete the client
    await db.client.delete(where={"client_id": client_id})

    return {
        "status": "success",
        "message": f"Client {client_id} successfully deleted along with all dependent records.",
    }


@app.get("/api/v1/advisor/alerts")
async def get_advisor_alerts(user: dict = Depends(get_current_user)):
    # 1. Fetch DB alerts for the firm (which includes our seeded compliance alerts)
    db_alerts = await db.alert.find_many(
        where={"firm_id": user["firm_id"]},
        order={"created_at": "desc"},
        include={"client": True},
    )

    # 2. Fetch clients to dynamically compute volatility risk and drawdown risks
    clients = await db.client.find_many(
        where={"advisor_id": user["sub"]},
        include={"accounts": {"include": {"portfolio_snapshots": True}}},
    )

    volatile_portfolios = 0
    portfolio_alerts = []
    total_aum = 0.0

    for c in clients:
        client_nav = 0.0
        if c.accounts:
            for acc in c.accounts:
                if acc.portfolio_snapshots:
                    latest_snap = acc.portfolio_snapshots[0]
                    nav = float(latest_snap.nav)
                    client_nav += nav

                    # Inspect risk metrics
                    risk_metrics = latest_snap.risk_metrics
                    if isinstance(risk_metrics, str):
                        try:
                            risk_metrics = json.loads(risk_metrics)
                        except:
                            risk_metrics = {}
                    elif not isinstance(risk_metrics, dict):
                        risk_metrics = {}

                    beta = float(risk_metrics.get("beta", 1.1))
                    drawdown = float(risk_metrics.get("max_drawdown_pct", -0.1))

                    # Flag high beta or significant drawdown as client risk alert
                    if beta > 1.2 or drawdown < -0.15:
                        volatile_portfolios += 1
                        portfolio_alerts.append(
                            {
                                "alert_id": f"risk-{c.client_id}",
                                "category": "CLIENT",
                                "alert_type": "HIGH_VOLATILITY_EXPOSURE",
                                "severity": "WARN",
                                "message": f"Client portfolio for {c.name} shows elevated market exposure (Beta: {beta:.2f}, Max Drawdown: {drawdown*100:.1f}%).",
                                "client_name": c.name,
                                "client_id": c.client_id,
                                "created_at": c.created_at.isoformat(),
                                "is_read": False,
                                "metadata": {
                                    "beta": beta,
                                    "drawdown": drawdown * 100,
                                    "nav": nav,
                                },
                            }
                        )
        total_aum += client_nav

    # Standardize/map DB alerts (Compliance, operations etc)
    mapped_alerts = []
    for a in db_alerts:
        cat = "COMPLIANCE"
        if a.alert_type in [
            "PORTFOLIO_DRIFT",
            "CONCENTRATION_LIMIT_EXCEEDED",
            "KYC_EXPIRATION_WARNING",
        ]:
            cat = "COMPLIANCE"

        mapped_alerts.append(
            {
                "alert_id": a.alert_id,
                "category": cat,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "client_name": a.client.name if a.client else None,
                "client_id": a.client_id,
                "created_at": a.created_at.isoformat(),
                "is_read": a.is_read,
                "metadata": {},
            }
        )

    # 3. Weekly AUM Drawdown Calculation
    drawdown_pct = 5.4  # Simulated 5.4% drop in active assets this week
    firm_aum_alert = {
        "alert_id": "aum-drawdown-alert",
        "category": "AUM",
        "alert_type": "FIRM_AUM_DOWNFALL",
        "severity": "BLOCK",
        "message": f"Firm total AUM has declined by {drawdown_pct}% this week due to market sector correction. Quick outreach recommended.",
        "client_name": None,
        "client_id": None,
        "created_at": "2026-05-22T08:00:00Z",
        "is_read": False,
        "metadata": {
            "current_aum": total_aum,
            "drawdown_pct": drawdown_pct,
            "weekly_loss": total_aum * (drawdown_pct / 100),
        },
    }

    # 4. Macro Market Downfall Alerts
    market_alerts = [
        {
            "alert_id": "market-sp500-correction",
            "category": "MARKET",
            "alert_type": "MARKET_DOWNFALL",
            "severity": "WARN",
            "message": "S&P 500 Index dropped 4.2% over the last 3 trading sessions, approaching short-term support levels.",
            "client_name": None,
            "client_id": None,
            "created_at": "2026-05-22T09:30:00Z",
            "is_read": False,
            "metadata": {"index": "S&P 500", "change_pct": -4.2, "period": "3 days"},
        },
        {
            "alert_id": "market-nasdaq-down",
            "category": "MARKET",
            "alert_type": "MARKET_DOWNFALL",
            "severity": "BLOCK",
            "message": "Nasdaq Composite entered correction territory (-10.5% from recent peak) led by massive mega-cap semiconductor selloff.",
            "client_name": None,
            "client_id": None,
            "created_at": "2026-05-22T10:15:00Z",
            "is_read": False,
            "metadata": {
                "index": "Nasdaq Composite",
                "change_pct": -10.5,
                "period": "14 days",
            },
        },
    ]

    # Combine all alerts
    all_alerts = mapped_alerts + portfolio_alerts + market_alerts + [firm_aum_alert]

    # Sort alerts: Block first, then Warn, then Info (most recent first)
    severity_rank = {"BLOCK": 3, "WARN": 2, "INFO": 1}
    all_alerts.sort(
        key=lambda x: (severity_rank.get(x["severity"], 1), x["created_at"]),
        reverse=True,
    )

    # Compute dynamic stats
    critical_count = sum(1 for a in all_alerts if a["severity"] == "BLOCK")

    # Chart data (Historic weekly AUM drawdown for Recharts area graph)
    chart_data = []
    import datetime

    base_date = datetime.datetime.now()
    for w in range(8, 0, -1):
        dt = base_date - datetime.timedelta(weeks=w)
        aum_factor = 1.05 + 0.01 * (8 - w)
        if w <= 2:
            aum_factor = 1.00 - 0.02 * (2 - w)
        chart_data.append(
            {
                "week": f"Wk -{w}",
                "date": dt.strftime("%b %d"),
                "aum": round(total_aum * aum_factor, 2),
                "drawdown": (
                    round((1.05 - aum_factor) * 100, 2) if aum_factor < 1.05 else 0.0
                ),
            }
        )

    return {
        "summary": {
            "totalAlerts": len(all_alerts),
            "criticalCount": critical_count,
            "volatilePortfolios": volatile_portfolios,
            "firmAumDrawdown": drawdown_pct,
        },
        "alerts": all_alerts,
        "chart_data": chart_data,
    }


class CreateReportRequest(BaseModel):
    title: str
    doc_type: str
    content: str


@app.get("/api/v1/reports")
async def get_reports(user: dict = Depends(get_current_user)):
    docs = await db.document.find_many(
        where={"advisor_id": user["sub"]}, order={"created_at": "desc"}
    )
    return {"reports": docs}


@app.post("/api/v1/reports")
async def create_report(
    req: CreateReportRequest, user: dict = Depends(get_current_user)
):
    new_doc = await db.document.create(
        data={
            "doc_id": str(uuid.uuid4()),
            "firm_id": user["firm_id"],
            "advisor_id": user["sub"],
            "doc_type": req.doc_type,
            "title": req.title,
            "content": req.content,
            "metadata": {"source": "Manual Upload"},
        }
    )
    return new_doc


@app.get("/api/v1/dashboard/top-clients")
async def dashboard_top_clients(user: dict = Depends(get_current_user)):
    clients = await get_top_clients(user["sub"], limit=5)
    return clients


@app.get("/api/v1/dashboard/alerts")
async def dashboard_alerts(user: dict = Depends(get_current_user)):
    # If ops/compliance, they see firm-wide alerts. If advisor, they see their own.
    if user["role"] in ["COMPLIANCE", "OPS"]:
        alerts = await get_compliance_alerts(firm_id=user["firm_id"])
    else:
        alerts = await get_compliance_alerts(
            firm_id=user["firm_id"], advisor_id=user["sub"]
        )
    return alerts


@app.get("/api/v1/dashboard/market-trends")
async def dashboard_market_trends():
    trends = await get_market_trends()
    return trends


@app.get("/api/v1/system/integrations")
async def system_integrations():
    import os

    return [
        {
            "name": "CRM (Salesforce)",
            "status": (
                "Connected" if os.getenv("SALESFORCE_API_KEY") else "Database Fallback"
            ),
        },
        {
            "name": "Portfolio (Aladdin)",
            "status": (
                "Connected" if os.getenv("ALADDIN_API_KEY") else "Database Fallback"
            ),
        },
        {
            "name": "Trading (Charles River)",
            "status": "Connected" if os.getenv("OMS_API_KEY") else "Database Fallback",
        },
        {
            "name": "Research (FactSet)",
            "status": (
                "Connected" if os.getenv("FACTSET_API_KEY") else "Database Fallback"
            ),
        },
    ]





# ─── Multi-Role Audit Log Helper ─────────────────────────────────────────────
async def log_audit_action(
    actor_id: str,
    entity_type: str,
    entity_id: str,
    action: str,
    before_data: dict = None,
    after_data: dict = None,
    ip_address: str = None,
    metadata: dict = None,
):
    import uuid

    # Construct maps
    before_json = before_data if before_data else {}
    after_json = after_data if after_data else {}
    meta_json = metadata if metadata else {}

    await db.auditlog.create(
        data={
            "log_id": str(uuid.uuid4()),
            "actor_id": actor_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "before_data": json.dumps(before_json),
            "after_data": json.dumps(after_json),
            "ip_address": ip_address or "127.0.0.1",
            "metadata": json.dumps(meta_json),
        }
    )


# ─── Compliance Portal API ───────────────────────────────────────────────────
class PolicyCreateRequest(BaseModel):
    title: str
    content: str


@app.get("/api/v1/compliance/portal")
async def get_compliance_portal(request: Request):
    async with httpx.AsyncClient() as client:
        r = await client.get("http://localhost:3003/api/v1/compliance/portal", headers=request.headers)
        return r.json()


@app.post("/api/v1/compliance/policy")
async def frame_compliance_policy(request: Request):
    async with httpx.AsyncClient() as client:
        r = await client.post("http://localhost:3003/api/v1/compliance/policy", content=await request.body(), headers=request.headers)
        return r.json()


# ─── Operations Portal API ────────────────────────────────────────────────────
class KycActionRequest(BaseModel):
    status: str


@app.get("/api/v1/operations/dashboard")
async def get_operations_dashboard(user: dict = Depends(get_current_user)):
    if user["role"] not in ["OPERATIONS", "ADMIN"]:
        raise HTTPException(
            status_code=403, detail="Only operations and admins can access this portal"
        )

    # Onboarding Clients (All clients for operations management)
    clients = await db.client.find_many(
        where={"firm_id": user["firm_id"]},
        include={"advisor": True},
        order={"created_at": "desc"},
    )

    clients_data = []
    for c in clients:
        clients_data.append(
            {
                "client_id": c.client_id,
                "name": c.name,
                "email": c.email,
                "segment": c.segment,
                "risk_profile": c.risk_profile,
                "kyc_status": c.kyc_status,
                "advisor_name": c.advisor.name if c.advisor else "Unassigned",
                "created_at": c.created_at.isoformat(),
            }
        )

    # Trade Settlements (Fetch transactions for accounts of this firm's clients)
    txns = await db.transaction.find_many(
        where={"account": {"client": {"firm_id": user["firm_id"]}}},
        include={"account": {"include": {"client": True}}, "instrument": True},
        order={"executed_at": "desc"},
        take=50,
    )

    transactions_data = []
    for t in txns:
        transactions_data.append(
            {
                "txn_id": t.txn_id,
                "client_name": (
                    t.account.client.name
                    if t.account and t.account.client
                    else "Unknown"
                ),
                "account_type": t.account.account_type if t.account else "N/A",
                "ticker": t.instrument.ticker if t.instrument else "N/A",
                "type": t.type,
                "quantity": float(t.quantity),
                "price": float(t.price),
                "status": t.status,
                "executed_at": t.executed_at.isoformat(),
            }
        )

    # Workflow Exceptions (Block severity alerts)
    exceptions = await db.alert.find_many(
        where={"firm_id": user["firm_id"], "severity": "BLOCK"},
        include={"client": True},
        order={"created_at": "desc"},
    )

    exceptions_data = []
    for ex in exceptions:
        exceptions_data.append(
            {
                "alert_id": ex.alert_id,
                "message": ex.message,
                "alert_type": ex.alert_type,
                "client_name": ex.client.name if ex.client else "Firm Level",
                "created_at": ex.created_at.isoformat(),
            }
        )

    # Document Processing list
    documents = await db.document.find_many(
        where={"firm_id": user["firm_id"]},
        include={"client": True},
        order={"created_at": "desc"},
        take=50,
    )

    documents_data = []
    for d in documents:
        meta = d.metadata
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except:
                meta = {}

        documents_data.append(
            {
                "doc_id": d.doc_id,
                "client_name": d.client.name if d.client else "Firm level",
                "doc_type": d.doc_type,
                "title": d.title,
                "created_at": d.created_at.isoformat(),
                "metadata": meta,
            }
        )

    return {
        "onboarding_clients": clients_data,
        "trade_settlements": transactions_data,
        "workflow_exceptions": exceptions_data,
        "document_processing": documents_data,
    }


@app.post("/api/v1/operations/clients/{client_id}/kyc")
async def update_client_kyc(
    client_id: str, req: KycActionRequest, user: dict = Depends(get_current_user)
):
    if user["role"] not in ["OPERATIONS", "ADMIN"]:
        raise HTTPException(
            status_code=403, detail="Only operations and admins can approve KYC"
        )

    client = await db.client.find_unique(where={"client_id": client_id})
    if not client or client.firm_id != user["firm_id"]:
        raise HTTPException(status_code=404, detail="Client not found in your firm")

    status_val = req.status.upper()
    if status_val not in ["APPROVED", "REJECTED", "PENDING", "EXPIRED"]:
        raise HTTPException(status_code=400, detail="Invalid KYC status value")

    updated = await db.client.update(
        where={"client_id": client_id}, data={"kyc_status": status_val}
    )

    await log_audit_action(
        actor_id=user["sub"],
        entity_type="CLIENT",
        entity_id=client_id,
        action="UPDATE_KYC",
        before_data={"kyc_status": client.kyc_status},
        after_data={"kyc_status": status_val},
    )

    return {
        "status": "success",
        "client": {"client_id": updated.client_id, "kyc_status": updated.kyc_status},
    }


@app.post("/api/v1/operations/transactions/{txn_id}/settle")
async def settle_transaction(txn_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ["OPERATIONS", "ADMIN"]:
        raise HTTPException(
            status_code=403, detail="Only operations and admins can settle transactions"
        )

    txn = await db.transaction.find_unique(
        where={"txn_id": txn_id}, include={"account": {"include": {"client": True}}}
    )
    if not txn or txn.account.client.firm_id != user["firm_id"]:
        raise HTTPException(
            status_code=404, detail="Transaction not found in your firm"
        )

    updated = await db.transaction.update(
        where={"txn_id": txn_id}, data={"status": "SETTLED"}
    )

    await log_audit_action(
        actor_id=user["sub"],
        entity_type="TRANSACTION",
        entity_id=txn_id,
        action="SETTLE_TRADE",
        before_data={"status": txn.status},
        after_data={"status": "SETTLED"},
    )

    return {
        "status": "success",
        "transaction": {"txn_id": updated.txn_id, "status": updated.status},
    }


# ─── Admin Portal API ─────────────────────────────────────────────────────────
class FirmCreateRequest(BaseModel):
    name: str
    regulatory_id: str


@app.get("/api/v1/admin/dashboard")
async def get_admin_dashboard(user: dict = Depends(get_current_user)):
    if user["role"] != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only global administrators can access the admin dashboard",
        )

    firms = await db.firm.find_many(include={"advisors": True})

    firm_list = []
    for f in firms:
        advisors_count = sum(1 for a in f.advisors if a.role == "ADVISOR")
        compliance_count = sum(1 for a in f.advisors if a.role == "COMPLIANCE")
        ops_count = sum(1 for a in f.advisors if a.role == "OPERATIONS")
        admin_count = sum(1 for a in f.advisors if a.role == "ADMIN")

        firm_list.append(
            {
                "firm_id": f.firm_id,
                "name": f.name,
                "regulatory_id": f.regulatory_id,
                "tier": f.tier,
                "advisors_count": advisors_count,
                "compliance_count": compliance_count,
                "ops_count": ops_count,
                "admin_count": admin_count,
                "created_at": f.created_at.isoformat(),
            }
        )

    all_users = await db.advisor.find_many(include={"firm": True})
    user_list = []
    for u in all_users:
        user_list.append(
            {
                "id": u.advisor_id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "status": u.status,
                "firm": u.firm.name if u.firm else "None",
                "created_at": u.created_at.isoformat(),
            }
        )

    return {"firms": firm_list, "users": user_list}


@app.post("/api/v1/admin/firms")
async def admin_create_firm(
    req: FirmCreateRequest, user: dict = Depends(get_current_user)
):
    if user["role"] != "ADMIN":
        raise HTTPException(
            status_code=403, detail="Only admins can register new firms"
        )

    # Check if regulatory_id already exists
    existing = await db.firm.find_unique(where={"regulatory_id": req.regulatory_id})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A firm with this regulatory ID is already registered",
        )

    new_firm = await db.firm.create(
        data={
            "firm_id": str(uuid.uuid4()),
            "name": req.name,
            "regulatory_id": req.regulatory_id,
            "tier": "STANDARD",
        }
    )

    await log_audit_action(
        actor_id=user["sub"],
        entity_type="FIRM",
        entity_id=new_firm.firm_id,
        action="CREATE_FIRM",
        after_data={"name": req.name, "regulatory_id": req.regulatory_id},
    )

    return {
        "status": "success",
        "firm": {
            "firm_id": new_firm.firm_id,
            "name": new_firm.name,
            "regulatory_id": new_firm.regulatory_id,
            "created_at": new_firm.created_at.isoformat(),
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
