# FILE: apps/ai-orchestrator/agents/llm_router.py
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv()

# Langchain LLMs
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_aws import ChatBedrock
from langchain_openai import AzureChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

def get_llm_router(temperature: float = 0.0) -> BaseChatModel:
    """
    Returns a unified Langchain Chat Model that automatically falls back across providers.
    
    Priority Order:
    1. AWS Bedrock (Claude 3.5 Sonnet)
    2. Azure OpenAI (GPT-4o)
    3. Google Gemini (Gemini Flash)
    
    If a provider's credentials are missing, it is simply skipped in the fallback chain.
    """
    primary_llm: Optional[BaseChatModel] = None
    fallbacks: list[BaseChatModel] = []

    # 1. AWS Bedrock (Primary)
    if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
        bedrock = ChatBedrock(
            model_id=os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0"),
            region_name=os.getenv("AWS_BEDROCK_REGION", "us-east-1"),
            model_kwargs={"temperature": temperature},
            # Adaptive retry for throttling is handled by botocore globally or can be configured via boto3 config
        )
        if not primary_llm:
            primary_llm = bedrock
        else:
            fallbacks.append(bedrock)

    # 2. Azure OpenAI (Fallback 1)
    if os.getenv("AZURE_OPENAI_API_KEY") and os.getenv("AZURE_OPENAI_ENDPOINT"):
        azure = AzureChatOpenAI(
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview"),
            azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o"),
            temperature=temperature,
            max_retries=3,
        )
        if not primary_llm:
            primary_llm = azure
        else:
            fallbacks.append(azure)

    # 3. Google Gemini (Fallback 2)
    if os.getenv("GEMINI_API_KEY"):
        gemini = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=temperature,
            max_retries=3,
        )
        if not primary_llm:
            primary_llm = gemini
        else:
            fallbacks.append(gemini)

    # Compile the routing chain
    if not primary_llm:
        raise ValueError("No LLM providers configured! Add Bedrock, Azure, or Gemini credentials to .env")

    if fallbacks:
        return primary_llm.with_fallbacks(fallbacks)
    
    return primary_llm
