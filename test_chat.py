import asyncio
import httpx
import json
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "libs/incedo_core"))
from incedo_core.auth import create_access_token

async def test_stream():
    url = "http://localhost:3002/api/v1/chat/stream"
    token = create_access_token({
        "sub": "adv_123",
        "firm_id": "firm_1",
        "role": "advisor",
    })
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "message": "Hello, how are you?",
        "session_id": "test-session-1234",
        "modality": "text"
    }
    
    print("Sending request...")
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", url, headers=headers, json=payload, timeout=60.0) as response:
                print(f"Status Code: {response.status_code}")
                if response.status_code != 200:
                    text = await response.aread()
                    print(f"Error Body: {text}")
                    return
                    
                print("Streaming response:")
                async for chunk in response.aiter_text():
                    print(chunk, end="")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_stream())
