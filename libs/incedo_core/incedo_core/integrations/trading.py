import os
from prisma import Prisma


async def get_compliance_alerts(firm_id: str, advisor_id: str = None) -> list[dict]:
    """
    Simulates fetching alerts from an OMS (Order Management System) or Compliance Engine.
    Fallback: Queries Prisma Alert table.
    """
    api_key = os.getenv("OMS_API_KEY")
    if api_key:
        print(f"[Trading Integration] Fetching via OMS API using key: {api_key[:4]}...")

    print("[Trading Integration] Falling back to local Database.")
    db = Prisma()
    await db.connect()

    where_clause = {}
    if advisor_id:
        # Get clients for this advisor to filter alerts
        clients = await db.client.find_many(where={"advisor_id": advisor_id})
        client_ids = [c.client_id for c in clients]
        where_clause = {"client_id": {"in": client_ids}}

    alerts = await db.alert.find_many(
        where=where_clause, order={"created_at": "desc"}, take=10
    )
    await db.disconnect()

    return [
        {
            "alert_id": a.alert_id,
            "type": a.alert_type,
            "severity": a.severity,
            "message": a.message,
            "client_id": a.client_id,
        }
        for a in alerts
    ]
