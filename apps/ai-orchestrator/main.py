import uuid
import json
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
load_dotenv()
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from prisma import Prisma
from incedo_core.auth import create_access_token, get_current_user
from agents.graph import copilot_app

db = Prisma()

import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Staggered startup to prevent Prisma engine binary lock collision with API Gateway
    await asyncio.sleep(3)
    for attempt in range(5):
        try:
            await db.connect(timeout=20)
            break
        except Exception as e:
            print(f"Prisma connection failed (attempt {attempt+1}/5): {e}")
            if attempt == 4:
                raise
            await asyncio.sleep(3)
    yield
    await db.disconnect()

app = FastAPI(title="AI Orchestrator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    client_id: str = None
    session_id: str = None

async def orchestrate_chat(message: str, session_id: str, client_id: str, advisor_id: str, firm_id: str, role: str):
    # Fetch recent history
    conv = await db.conversation.find_unique(where={"conv_id": session_id})
    messages = []
    if conv:
        turns = await db.conversationturn.find_many(
            where={"conv_id": session_id},
            order={"created_at": "asc"}
        )
        from langchain_core.messages import HumanMessage, AIMessage
        for t in turns:
            if t.role == "user":
                messages.append(HumanMessage(content=t.content or ""))
            else:
                messages.append(AIMessage(content=t.content or ""))
    
    from langchain_core.messages import HumanMessage
    messages.append(HumanMessage(content=message))
    
    state = {
        "messages": messages,
        "client_id": client_id,
        "advisor_id": advisor_id,
        "firm_id": firm_id
    }
    
    try:
        async for s in copilot_app.astream(state):
            for key, value in s.items():
                if "messages" in value and len(value["messages"]) > 0:
                    content = value["messages"][-1].content
                    # Simulate streaming for a GPT-like typewriter effect
                    chunk_size = 8
                    for i in range(0, len(content), chunk_size):
                        yield content[i:i+chunk_size]
                        await asyncio.sleep(0.01)
    except Exception as e:
        yield f"Error: {str(e)}"

@app.post("/api/v1/chat/stream")
async def chat_stream(request: ChatRequest, req: Request, user: dict = Depends(get_current_user)):
    print(f"DEBUG: Entered chat_stream with session {request.session_id}")
    session_id = request.session_id or str(uuid.uuid4())
    client_id = request.client_id if request.client_id else None
    
    try:
        # Check if conversation exists using ORM
        conv = await db.conversation.find_unique(where={"conv_id": session_id})
        if not conv:
            title = request.message[:35] + "..." if len(request.message) > 35 else request.message
            await db.conversation.create(
                data={
                    "conv_id": session_id,
                    "advisor_id": user["sub"],
                    "firm_id": user.get("firm_id", "default_firm"),
                    "client_id": client_id,
                    "context": json.dumps({"title": title})
                }
            )
            
        await db.conversationturn.create(
            data={
                "turn_id": str(uuid.uuid4()),
                "conv_id": session_id,
                "role": "user",
                "content": request.message
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"DB Error: {str(e)}")
    
    accumulated = []
    async def event_generator():
        try:
            async for chunk in orchestrate_chat(request.message, session_id, request.client_id, user["sub"], user.get("firm_id", "default_firm"), user.get("role", "advisor")):
                accumulated.append(chunk)
                yield {"data": json.dumps({"type": "chunk", "content": chunk})}
            full = "".join(accumulated)
            await db.conversationturn.create(
                data={
                    "turn_id": str(uuid.uuid4()),
                    "conv_id": session_id,
                    "role": "assistant",
                    "content": full
                }
            )
            yield {"data": json.dumps({"type": "done", "metadata": {"session_id": session_id}})}
            yield {"data": "[DONE]"}
        except Exception as e:
            yield {"data": json.dumps({"type": "error", "content": str(e)})}
            yield {"data": "[DONE]"}
    return EventSourceResponse(event_generator())

@app.get("/api/v1/chat/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    try:
        conversations = await db.conversation.find_many(
            where={"advisor_id": user["sub"]},
            order={"started_at": "desc"}
        )
        list_data = []
        for c in conversations:
            title = "Untitled Conversation"
            try:
                context_val = c.context
                if context_val:
                    context = json.loads(context_val) if isinstance(context_val, str) else context_val
                    if isinstance(context, dict): title = context.get("title", title)
            except: pass
            
            started_at = c.started_at
            time_str = started_at.isoformat() if hasattr(started_at, 'isoformat') else str(started_at)
            list_data.append({"id": c.conv_id, "title": title, "time": time_str, "client_id": c.client_id})
        return list_data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/v1/chat/conversations/{conv_id}")
async def get_conversation_details(conv_id: str, user: dict = Depends(get_current_user)):
    try:
        conv = await db.conversation.find_unique(where={"conv_id": conv_id})
        if not conv or conv.advisor_id != user["sub"]: 
            raise HTTPException(404, "Not found")
            
        turns = await db.conversationturn.find_many(
            where={"conv_id": conv_id},
            order={"created_at": "asc"}
        )
        
        return {
            "sessionId": conv.conv_id, 
            "clientId": conv.client_id, 
            "messages": [{"id": t.turn_id, "role": t.role, "content": t.content or ""} for t in turns]
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.delete("/api/v1/chat/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    conv = await db.conversation.find_unique(where={"conv_id": conv_id})
    if not conv or conv.advisor_id != user["sub"]: raise HTTPException(404, "Not found")
    await db.conversationturn.delete_many(where={"conv_id": conv_id})
    await db.conversation.delete(where={"conv_id": conv_id})
    return {"status": "deleted"}

@app.get("/health")
def health(): return {"status": "ok", "service": "ai-orchestrator"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3002, reload=True)
