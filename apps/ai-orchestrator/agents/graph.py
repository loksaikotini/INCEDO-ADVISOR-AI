import os
from typing import TypedDict, Sequence
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from dotenv import load_dotenv

# Load root .env
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from incedo_core.integrations.crm import get_top_clients
from incedo_core.integrations.portfolio import get_portfolio_summary
from incedo_core.integrations.trading import get_compliance_alerts
from incedo_core.integrations.research import get_market_trends
from memory.vector_store import rag_pipeline


from agents.prompts import (
    INTENT_ROUTER_PROMPT,
    CRM_AGENT_PROMPT,
    PORTFOLIO_AGENT_PROMPT,
    COMPLIANCE_AGENT_PROMPT,
    RESEARCH_AGENT_PROMPT,
    GENERAL_AGENT_PROMPT,
)

class AgentState(TypedDict):
    messages: Sequence[BaseMessage]
    intent: str
    client_id: str | None
    advisor_id: str | None
    firm_id: str | None
    portfolio_data: dict | None
    compliance_alerts: list | None
    crm_data: list | None
    market_data: dict | None
    rag_docs: list | None      # Phase 2 reranked docs injected into all agents


# ─── LLM Setup ────────────────────────────────────────────────────────
from agents.llm_router import get_llm_router

llm = get_llm_router(temperature=0.0)


# ─── Nodes ─────────────────────────────────────────────────────────────


async def intent_router(state: AgentState):
    """Detect the user's intent using the LLM."""
    last_message = state["messages"][-1].content

    prompt = INTENT_ROUTER_PROMPT.replace("{last_message}", last_message)

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    intent = response.content.strip().lower()

    # Fallback validation
    if intent not in ["portfolio", "compliance", "crm", "research"]:
        intent = "general"

    return {"intent": intent}


async def crm_agent(state: AgentState):
    """Handles CRM/Client queries, augmented with RAG knowledge base context."""
    advisor_id = state.get("advisor_id")
    clients = await get_top_clients(advisor_id=advisor_id)

    # RAG: enrich with knowledge base docs relevant to CRM query
    last_message = state["messages"][-1].content
    rag_docs = await rag_pipeline.search(query=last_message)
    rag_context = "\n---\n".join([d.get("content", "") for d in rag_docs]) if rag_docs else ""

    data_str = f"Top Clients: {clients}"
    if rag_context:
        data_str += f"\n\nRelevant Knowledge Base Context:\n{rag_context}"

    sys_prompt = CRM_AGENT_PROMPT.replace("{data_str}", data_str)
    messages = [SystemMessage(content=sys_prompt)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {"messages": [response], "crm_data": clients, "rag_docs": rag_docs}


async def portfolio_agent(state: AgentState):
    """Handles portfolio queries, augmented with RAG knowledge base context."""
    advisor_id = state.get("advisor_id")
    summary = await get_portfolio_summary(advisor_id=advisor_id)

    # RAG: enrich with research reports / market data relevant to this portfolio query
    last_message = state["messages"][-1].content
    rag_docs = await rag_pipeline.search(query=last_message)
    rag_context = "\n---\n".join([d.get("content", "") for d in rag_docs]) if rag_docs else ""

    data_str = f"Portfolio Summary: {summary}"
    if rag_context:
        data_str += f"\n\nRelevant Research & Market Context:\n{rag_context}"

    sys_prompt = PORTFOLIO_AGENT_PROMPT.replace("{data_str}", data_str)
    messages = [SystemMessage(content=sys_prompt)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {"messages": [response], "portfolio_data": summary, "rag_docs": rag_docs}


async def compliance_agent(state: AgentState):
    """Handles compliance checks, augmented with RAG policy knowledge base."""
    advisor_id = state.get("advisor_id")
    firm_id = state.get("firm_id")
    alerts = await get_compliance_alerts(firm_id=firm_id, advisor_id=advisor_id)

    # RAG: retrieve compliance rules, regulatory statutes, policy documents
    last_message = state["messages"][-1].content
    rag_docs = await rag_pipeline.search(query=last_message)
    rag_context = "\n---\n".join([d.get("content", "") for d in rag_docs]) if rag_docs else ""

    data_str = f"Alerts: {alerts}"
    if rag_context:
        data_str += f"\n\nRelevant Compliance Policies & Regulations:\n{rag_context}"

    sys_prompt = COMPLIANCE_AGENT_PROMPT.replace("{data_str}", data_str)
    messages = [SystemMessage(content=sys_prompt)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {"messages": [response], "compliance_alerts": alerts, "rag_docs": rag_docs}


async def research_agent(state: AgentState):
    """Handles market research queries, augmented with RAG knowledge base."""
    trends = await get_market_trends()

    # RAG: retrieve research reports, analyst notes, fund documents
    last_message = state["messages"][-1].content
    rag_docs = await rag_pipeline.search(query=last_message)
    rag_context = "\n---\n".join([d.get("content", "") for d in rag_docs]) if rag_docs else ""

    data_str = f"Market Trends: {trends}"
    if rag_context:
        data_str += f"\n\nAdditional Research Context from Knowledge Base:\n{rag_context}"

    sys_prompt = RESEARCH_AGENT_PROMPT.replace("{data_str}", data_str)
    messages = [SystemMessage(content=sys_prompt)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {"messages": [response], "market_data": trends, "rag_docs": rag_docs}


async def general_agent(state: AgentState):
    """Fallback agent: pure RAG — full two-phase hybrid retrieval + cross-encoder reranking."""
    last_message = state["messages"][-1].content

    # Full two-phase RAG pipeline: BM25 + Vector CC → Cross-Encoder rerank → top-5
    rag_docs = await rag_pipeline.search(query=last_message)
    context_str = (
        "\n\n---\n\n".join(
            [f"[Source: {d.get('doc_type','DOC')} | Score: {d.get('_rerank_score', 0):.3f}]\n{d.get('content', '')}"
             for d in rag_docs]
        )
        if rag_docs
        else "No relevant documents found in the knowledge base."
    )

    sys_prompt = GENERAL_AGENT_PROMPT.replace("{context_str}", context_str)
    messages = [SystemMessage(content=sys_prompt)] + list(state["messages"])
    response = await llm.ainvoke(messages)

    return {"messages": [response], "rag_docs": rag_docs}


# ─── Edges ─────────────────────────────────────────────────────────────


def route_based_on_intent(state: AgentState) -> str:
    return state["intent"]


# ─── Graph Construction ────────────────────────────────────────────────

workflow = StateGraph(AgentState)

workflow.add_node("router", intent_router)
workflow.add_node("portfolio", portfolio_agent)
workflow.add_node("compliance", compliance_agent)
workflow.add_node("crm", crm_agent)
workflow.add_node("research", research_agent)
workflow.add_node("general", general_agent)

workflow.set_entry_point("router")

workflow.add_conditional_edges(
    "router",
    route_based_on_intent,
    {
        "portfolio": "portfolio",
        "compliance": "compliance",
        "crm": "crm",
        "research": "research",
        "general": "general",
    },
)

workflow.add_edge("portfolio", END)
workflow.add_edge("compliance", END)
workflow.add_edge("crm", END)
workflow.add_edge("research", END)
workflow.add_edge("general", END)

copilot_app = workflow.compile()
