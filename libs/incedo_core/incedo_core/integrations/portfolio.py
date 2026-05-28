import os
from prisma import Prisma


async def get_portfolio_summary(advisor_id: str) -> dict:
    """
    Simulates an Accounting/Portfolio system (Aladdin/Addepar).
    Fetches aggregate metrics for all portfolios managed by this advisor.
    """
    api_key = os.getenv("ALADDIN_API_KEY")
    if api_key:
        print(
            f"[Portfolio Integration] Fetching via Aladdin API using key: {api_key[:4]}..."
        )

    print("[Portfolio Integration] Falling back to local Database.")
    db = Prisma()
    await db.connect()

    # Get all clients for this advisor
    clients = await db.client.find_many(
        where={"advisor_id": advisor_id},
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

    total_aum = 0
    total_cash = 0
    active_portfolios = 0

    for c in clients:
        if c.accounts:
            active_portfolios += len(c.accounts)
            for acc in c.accounts:
                if acc.portfolio_snapshots:
                    snap = acc.portfolio_snapshots[0]
                    total_aum += float(snap.nav)
                    total_cash += float(snap.nav) * 0.05

    return {
        "total_aum": total_aum,
        "total_cash": total_cash,
        "active_portfolios": active_portfolios,
        "active_clients": len(clients),
        "return_ytd": "+4.2%",  # Simulated YTD return metric
        "status": "Healthy",
    }


async def get_client_portfolio(client_id: str) -> dict:
    """Gets detailed portfolio for a specific client"""
    db = Prisma()
    await db.connect()

    accounts = await db.account.find_many(
        where={"client_id": client_id},
        include={
            "portfolio_snapshots": {"orderBy": {"snapshot_ts": "desc"}, "take": 1}
        },
    )
    await db.disconnect()

    portfolios_data = []
    for acc in accounts:
        if acc.portfolio_snapshots:
            snap = acc.portfolio_snapshots[0]
            portfolios_data.append(
                {
                    "id": acc.account_id,
                    "value": float(snap.nav),
                    "cash": float(snap.nav) * 0.05,
                    "strategy": acc.account_type,
                }
            )

    return {"client_id": client_id, "portfolios": portfolios_data}
