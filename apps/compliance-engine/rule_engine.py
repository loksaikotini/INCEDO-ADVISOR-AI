import logging
import json
from cachetools import TTLCache
import rule_engine
from prisma import Prisma

logger = logging.getLogger(__name__)

# Cache active rules for 30s to allow hot-reloading without service restart
# Ref: Blueprint §6 Task 5 — DB-backed hot-reload
_rule_cache = TTLCache(maxsize=100, ttl=30)

class RuleEngineService:
    """
    Ref: Blueprint §6 Task 5 — Rule evaluation engine
    """
    def __init__(self, db: Prisma):
        self.db = db

    async def get_active_rules(self, firm_id: str):
        cache_key = f"compliance:rules:{firm_id}"
        
        if cache_key in _rule_cache:
            return _rule_cache[cache_key]
            
        rules = await self.db.compliancerule.find_many(
            where={"firm_id": firm_id, "active": True},
            order={"created_at": "asc"}
        )
        
        # Sort by severity locally since Prisma Python doesn't support complex enums easily in orderBy
        def severity_rank(sev):
            return {"BLOCK": 3, "WARN": 2, "INFO": 1}.get(sev, 0)
        
        rules.sort(key=lambda r: severity_rank(r.severity), reverse=True)
        
        _rule_cache[cache_key] = rules
        logger.debug(f"Loaded {len(rules)} active rules for firm {firm_id}")
        
        return rules

    def invalidate_rule_cache(self, firm_id: str):
        cache_key = f"compliance:rules:{firm_id}"
        if cache_key in _rule_cache:
            del _rule_cache[cache_key]
            logger.info(f"Rule cache invalidated for firm {firm_id} — hot-reload active")

    def evaluate_rule(self, rule, facts: dict) -> dict:
        try:
            # We assume rule_logic is a JSON string or dict that contains a 'condition' (python rule_engine string)
            # The reference used json-rules-engine. We will use python rule-engine.
            rule_logic = rule.rule_logic
            if isinstance(rule_logic, str):
                rule_logic = json.loads(rule_logic)
                
            condition_str = rule_logic.get("condition", "False")
            
            # Create a Rule object
            re = rule_engine.Rule(condition_str)
            
            # Evaluate against facts
            is_triggered = re.matches(facts)
            
            events = []
            if is_triggered:
                events.append({
                    "type": rule_logic.get("event", {}).get("type", "violation"),
                    "params": rule_logic.get("event", {}).get("params", {})
                })
                
            return {
                "triggered": is_triggered,
                "events": events
            }
            
        except Exception as err:
            logger.error(f"Rule evaluation failed for rule {rule.rule_id}: {err}")
            return {"triggered": False, "events": []}

    async def evaluate_all_rules(self, rules: list, facts: dict) -> list:
        # Evaluate rules sequentially (in Python it's fast enough in-memory)
        results = []
        for rule in rules:
            res = self.evaluate_rule(rule, facts)
            results.append({"rule": rule, "result": res})
        return results

    def build_evaluation_facts(self, recommendation_text: str, payload: dict, advisor_id: str, client_id: str, context_type: str) -> dict:
        return {
            "recommendation_text": recommendation_text,
            "context_type": context_type,
            "advisor_id": advisor_id,
            "client_id": client_id,
            "sector_concentration": payload.get("sector_concentration", 0),
            "equity_allocation": payload.get("equity_allocation", 0),
            "leverage_ratio": payload.get("leverage_ratio", 0),
            "ticker": payload.get("ticker", ""),
            "client_risk_profile": payload.get("client_risk_profile", "MODERATE"),
            "trade_value": payload.get("trade_value", 0),
            "contains_restricted_security": self._check_for_restricted_securities(recommendation_text)
        }

    def _check_for_restricted_securities(self, text: str) -> bool:
        restricted_patterns = ["RESTRICTED_A", "RESTRICTED_B"]
        text_upper = text.upper()
        return any(p in text_upper for p in restricted_patterns)
