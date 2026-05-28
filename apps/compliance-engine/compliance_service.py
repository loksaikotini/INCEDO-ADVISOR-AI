import time
import logging
import uuid
import json
from datetime import datetime
from rule_engine import RuleEngineService
from explainability import ExplainabilityService
from prisma import Prisma

logger = logging.getLogger(__name__)

class ComplianceService:
    """
    Ref: Blueprint §6 Task 5 — Compliance Engine: validates AI recommendations against firm rules
    """
    def __init__(self, db: Prisma):
        self.db = db
        self.rule_engine = RuleEngineService(db)
        self.explainability = ExplainabilityService()

    async def validate(self, request: dict) -> dict:
        start_ts = time.perf_counter()
        check_id = str(uuid.uuid4())
        
        firm_id = request.get("firm_id")
        advisor_id = request.get("advisor_id")
        client_id = request.get("client_id", "")
        recommendation_text = request.get("recommendation_text", "")
        payload = request.get("payload", {})
        context_type = request.get("context_type", "GENERAL")

        # ── Load Active Rules for Firm ────────────────────────────────────────────
        rules = await self.rule_engine.get_active_rules(firm_id)

        # ── Evaluate All Rules ────────────────────────────────────────────────────
        violations = []
        highest_severity = "INFO"
        
        facts = self.rule_engine.build_evaluation_facts(
            recommendation_text, payload, advisor_id, client_id, context_type
        )
        
        results = await self.rule_engine.evaluate_all_rules(rules, facts)
        
        for res in results:
            if res["result"]["triggered"]:
                rule = res["rule"]
                
                rule_logic = rule.rule_logic
                if isinstance(rule_logic, str):
                    rule_logic = json.loads(rule_logic)
                    
                reg_ref = rule_logic.get("event", {}).get("params", {}).get("regulatory_reference", "Internal Policy")
                
                violation = {
                    "rule_id": rule.rule_id,
                    "rule_name": rule.name,
                    "severity": rule.severity,
                    "description": rule.description,
                    "regulatory_reference": reg_ref
                }
                violations.append(violation)
                
                if self._severity_rank(rule.severity) > self._severity_rank(highest_severity):
                    highest_severity = rule.severity

        # ── Determine Overall Outcome ─────────────────────────────────────────────
        outcome = self._determine_outcome(violations)

        # ── Generate Explainability ───────────────────────────────────────────────
        explainability_data = self.explainability.generate_explainability(violations, len(rules), payload)

        # ── Generate Disclosure Text for WARN ─────────────────────────────────────
        disclosure_text = self._generate_disclosure(violations, outcome)

        # ── Write Compliance Event (ALL outcomes including PASS) ──────────────────
        await self._write_compliance_event(request, violations, outcome, check_id, rules)

        # ── Write Audit Log ───────────────────────────────────────────────────────
        audit_id = str(uuid.uuid4())
        await self.db.auditlog.create(data={
            "log_id": audit_id,
            "actor_id": advisor_id,
            "entity_type": "COMPLIANCE_CHECK",
            "entity_id": check_id,
            "action": f"COMPLIANCE_{outcome}",
            "before_data": "{}",
            "after_data": json.dumps({
                "outcome": outcome,
                "violation_count": len(violations),
                "context_type": context_type
            }),
            "ip_address": "127.0.0.1",
            "metadata": "{}"
        })

        latency_ms = int((time.perf_counter() - start_ts) * 1000)
        if latency_ms > 50:
            logger.warning(f"Compliance check took {latency_ms}ms — exceeds 50ms target")

        return {
            "check_id": check_id,
            "outcome": outcome,
            "violations": violations,
            "disclosure_text": disclosure_text,
            "explainability": explainability_data,
            "audit_id": audit_id,
            "evaluated_at": datetime.utcnow().isoformat() + "Z"
        }

    def _determine_outcome(self, violations: list) -> str:
        if any(v.get("severity") == "BLOCK" for v in violations):
            return "BLOCKED"
        if any(v.get("severity") == "WARN" for v in violations):
            return "WARN"
        return "PASS"

    def _generate_disclosure(self, violations: list, outcome: str) -> str:
        if outcome == "PASS" or not violations:
            return None
            
        disclosures = []
        for v in violations:
            if v.get("severity") == "WARN":
                disclosures.append(f"⚠️ {v.get('description')} [{v.get('regulatory_reference')}]")
                
        if not disclosures:
            return None
            
        disclosure_body = "\n".join(disclosures)
        reg_ref = violations[0].get("regulatory_reference", "firm policy")
        
        return f"\n\n---\n**COMPLIANCE DISCLOSURE**\n{disclosure_body}\n*This disclosure is required by {reg_ref}.*"

    async def _write_compliance_event(self, request: dict, violations: list, outcome: str, check_id: str, rules: list):
        advisor_id = request.get("advisor_id")
        client_id = request.get("client_id")
        context_type = request.get("context_type")
        
        try:
            for v in violations:
                await self.db.complianceevent.create(data={
                    "rule_id": v["rule_id"],
                    "advisor_id": advisor_id,
                    "outcome": outcome,
                    "context": json.dumps({
                        "check_id": check_id,
                        "context_type": context_type,
                        "client_id": client_id,
                        "violation_description": v["description"]
                    })
                })
                
            if not violations and rules:
                await self.db.complianceevent.create(data={
                    "rule_id": rules[0].rule_id,
                    "advisor_id": advisor_id,
                    "outcome": "PASS",
                    "context": json.dumps({
                        "check_id": check_id,
                        "context_type": context_type,
                        "client_id": client_id
                    })
                })
        except Exception as err:
            logger.error(f"Failed to write compliance event: {err}")

    def _severity_rank(self, severity: str) -> int:
        return {"INFO": 1, "WARN": 2, "BLOCK": 3}.get(severity, 0)
