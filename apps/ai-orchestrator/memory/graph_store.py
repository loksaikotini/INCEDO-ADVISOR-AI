from neo4j import AsyncGraphDatabase
import os


class MemoryGraphStore:
    def __init__(self):
        # Default local Neo4j container
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")

        try:
            self.driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
        except Exception as e:
            print("[GraphStore] Warning: Neo4j connection failed.", e)
            self.driver = None

    async def save_interaction(self, advisor_id: str, client_id: str, intent: str):
        """Saves a conversational trace in the knowledge graph."""
        if not self.driver:
            return

        query = """
        MERGE (a:Advisor {id: $advisor_id})
        MERGE (c:Client {id: $client_id})
        MERGE (a)-[r:INTERACTED_WITH {intent: $intent, timestamp: timestamp()}]->(c)
        """
        try:
            async with self.driver.session() as session:
                await session.run(
                    query, advisor_id=advisor_id, client_id=client_id, intent=intent
                )
        except Exception as e:
            print("[GraphStore] Error saving interaction:", e)

    async def close(self):
        if self.driver:
            await self.driver.close()


graph_store = MemoryGraphStore()
