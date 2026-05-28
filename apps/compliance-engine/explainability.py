import logging

logger = logging.getLogger(__name__)

class ExplainabilityService:
    """
    Ref: Blueprint §6 Task 5 — SHAP value formatter → human-readable rationale
    Generates explainability for compliance checks.
    """
    
    def generate_explainability(self, violations: list[dict], total_rules_evaluated: int, payload: dict) -> dict:
        reasoning_steps = self._build_reasoning_steps(violations, total_rules_evaluated)
        shap_values = self._compute_shap_values(violations, payload)
        confidence_score = self._compute_confidence(violations, total_rules_evaluated)
        human_review_required = any(v.get("severity") == "BLOCK" for v in violations)
        
        return {
            "reasoning_steps": reasoning_steps,
            "data_sources_used": ["compliance_rule_db", "portfolio_snapshot", "client_profile"],
            "shap_values": shap_values,
            "confidence_score": confidence_score,
            "human_review_required": human_review_required,
            "doc_section_refs": [
                "Blueprint §4.5 — Compliance & Supervision",
                "Blueprint §6 Task 5 — Compliance Engine",
                "Blueprint §10 — Governance & Risk Controls"
            ]
        }

    def _build_reasoning_steps(self, violations: list[dict], total_rules: int) -> list[str]:
        steps = [f"Loaded and evaluated {total_rules} active compliance rules from database"]
        
        if not violations:
            steps.append("All rules passed — no violations detected")
            steps.append("Response approved for delivery to advisor")
        else:
            steps.append(f"Detected {len(violations)} rule violation(s):")
            for i, v in enumerate(violations):
                steps.append(f"  {i + 1}. [{v.get('severity')}] {v.get('rule_name')}: {v.get('description')} ({v.get('regulatory_reference')})")
            
            has_block = any(v.get('severity') == 'BLOCK' for v in violations)
            if has_block:
                steps.append("BLOCK violation detected — response withheld from advisor")
                steps.append("Compliance event logged; advisor notified of block")
            else:
                steps.append("WARN violation(s) detected — response delivered with disclosure")
                steps.append("Mandatory disclosure appended to advisor response")
                
        return steps

    def _compute_shap_values(self, violations: list[dict], payload: dict) -> dict:
        # Pseudo-SHAP values for rule-based attribution
        shap_values = {}
        
        for v in violations:
            sev = v.get("severity", "INFO")
            weight = {"BLOCK": 1.0, "WARN": 0.6, "INFO": 0.2}.get(sev, 0.2)
            shap_values[f"rule_{v.get('rule_id')}"] = weight
            
        # Payload attributions
        if isinstance(payload.get("sector_concentration"), (int, float)):
            shap_values["sector_concentration"] = min(1.0, payload["sector_concentration"] / 0.4)
            
        if isinstance(payload.get("equity_allocation"), (int, float)):
            shap_values["equity_allocation"] = min(1.0, payload["equity_allocation"] / 0.8)
            
        if isinstance(payload.get("leverage_ratio"), (int, float)):
            shap_values["leverage_ratio"] = min(1.0, payload["leverage_ratio"] / 2.0)
            
        return shap_values

    def _compute_confidence(self, violations: list[dict], total_rules: int) -> float:
        if total_rules == 0:
            return 0.5
            
        base_confidence = min(1.0, total_rules / 10.0)
        
        has_only_warn = len(violations) > 0 and all(v.get("severity") == "WARN" for v in violations)
        adjustment = -0.1 if has_only_warn else 0.0
        
        return max(0.1, min(1.0, base_confidence + adjustment))
