import os
from prisma import Prisma


async def get_top_clients(advisor_id: str, limit: int = 5) -> list[dict]:
    """
    Simulates fetching top clients from a CRM like Salesforce.
    Fallback: Queries local PostgreSQL database via Prisma.
    """
    api_key = os.getenv("SALESFORCE_API_KEY")

    if api_key:
        # Simulate real API call
        print(
            f"[CRM Integration] Fetching data via Salesforce API using key: {api_key[:4]}..."
        )
        # In a real scenario, we'd use httpx to call the Salesforce API
        # For demo purposes, we will still use Prisma but format it to look like Salesforce's response

    print("[CRM Integration] Falling back to local Database.")
    db = Prisma()
    await db.connect()

    clients = await db.client.find_many(
        where={"advisor_id": advisor_id},
        take=limit,
        include={
            "accounts": {
                "include": {
                    "portfolio_snapshots": {
                        "orderBy": {"snapshot_ts": "desc"},
                        "take": 1,
                    }
                }
            }
        },
    )
    await db.disconnect()

    # Format the data into a standard schema
    result = []
    for c in clients:
        # Aggregate AUM from portfolios
        aum = 0
        if c.accounts:
            for acc in c.accounts:
                if acc.portfolio_snapshots:
                    aum += float(acc.portfolio_snapshots[0].nav)

        c_dict = c.model_dump()
        result.append(
            {
                "client_id": c_dict.get("client_id"),
                "name": c_dict.get("name"),
                "email": c_dict.get("email"),
                "type": c_dict.get("segment"),
                "kyc_status": c_dict.get("kyc_status"),
                "aum": float(aum),
            }
        )

    return sorted(result, key=lambda x: x["aum"], reverse=True)
