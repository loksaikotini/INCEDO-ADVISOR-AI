// FILE: libs/types/src/index.ts
// Ref: Blueprint §8.2 — API contracts between services must reference @advisor-ai/types DTOs
// Ref: Blueprint §4.1 — Core Entity Design
// Ref: Blueprint §2.4 — API Design Approach: spec-first with OpenAPI 3.1

// ─── Enums ───────────────────────────────────────────────────────────────────

/** Ref: Blueprint §2.5 — RBAC roles: Advisor | Compliance | Operations | Admin */
export enum UserRole {
  ADVISOR = 'ADVISOR',
  COMPLIANCE = 'COMPLIANCE',
  OPERATIONS = 'OPERATIONS',
  RELATIONSHIP_MANAGER = 'RELATIONSHIP_MANAGER',
  ADMIN = 'ADMIN',
}

/** Ref: Blueprint §4.1 — client.risk_profile_enum */
export enum RiskProfile {
  CONSERVATIVE = 'CONSERVATIVE',
  MODERATE = 'MODERATE',
  AGGRESSIVE = 'AGGRESSIVE',
  VERY_AGGRESSIVE = 'VERY_AGGRESSIVE',
}

/** Ref: Blueprint §4.1 — compliance_rule.severity_enum */
export enum ComplianceSeverity {
  BLOCK = 'BLOCK',
  WARN = 'WARN',
  INFO = 'INFO',
}

/** Ref: Blueprint §4.1 — compliance_event outcome */
export enum ComplianceOutcome {
  PASS = 'PASS',
  WARN = 'WARN',
  BLOCKED = 'BLOCKED',
}

/** Ref: Blueprint §4.1 — conversation_turn.role_enum */
export enum ConversationRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

/** Ref: Blueprint §4.1 — ai_recommendation.rec_type_enum */
export enum RecommendationType {
  CROSS_SELL = 'CROSS_SELL',
  UPSELL = 'UPSELL',
  REBALANCE = 'REBALANCE',
  OUTREACH = 'OUTREACH',
  RISK_ALERT = 'RISK_ALERT',
}

/** Ref: Blueprint §4.1 — transaction.type_enum */
export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  DIVIDEND = 'DIVIDEND',
  REBALANCE = 'REBALANCE',
  FEE = 'FEE',
}

// ─── Auth DTOs ───────────────────────────────────────────────────────────────

/** Ref: Blueprint §6 Task 3 — Auth constraints: only sub, role, firm_id, exp in payload */
export interface JwtPayload {
  sub: string;           // advisor_id — NO PII
  role: UserRole;
  firm_id: string;
  exp: number;
  iat: number;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface AuthTokensDto {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;   // seconds
}

export interface AuthUserDto {
  id: string;
  firm_id: string;
  name: string;
  email: string;
  role: UserRole;
}

// ─── Explainability DTO ───────────────────────────────────────────────────────
/** Ref: Blueprint §5 — Explainability requirements; §3.4 — SHAP explainability */
export interface ExplainabilityDto {
  reasoning_steps: string[];
  data_sources_used: string[];
  shap_values?: Record<string, number>;
  confidence_score: number;         // 0.0 – 1.0
  human_review_required: boolean;  // Ref: Blueprint §10 — Human-in-the-loop
  doc_section_refs: string[];
}

// ─── Chat / Conversational AI DTOs ────────────────────────────────────────────
/** Ref: Blueprint §1.3 — Conversational AI Interface: multi-turn, context retention */
export interface ChatRequestDto {
  session_id: string;
  message: string;
  modality: 'text' | 'voice';
  client_id?: string;    // Optional: scopes query to specific client
}

export interface ConversationTurnDto {
  role: ConversationRole;
  content: string;
  created_at: string;
  tokens_used?: number;
  latency_ms?: number;
}

/** Ref: Blueprint §2.3 — step 6: response with rationale via SSE */
export interface ChatResponseDto {
  turn_id: string;
  session_id: string;
  content: string;
  use_case_detected: UseCaseType;
  explainability: ExplainabilityDto;
  compliance_outcome: ComplianceOutcome;
  audit_id: string;
  latency_ms: number;
  model_used: string;
}

/** Ref: Blueprint §1.3 — Core Use Cases §4.1–4.6 */
export type UseCaseType =
  | 'ADVISOR_PRODUCTIVITY'
  | 'CLIENT_INTELLIGENCE'
  | 'PORTFOLIO_INSIGHTS'
  | 'CONVERSATIONAL_SEARCH'
  | 'COMPLIANCE_SUPERVISION'
  | 'REVENUE_ENABLEMENT';

// ─── Portfolio DTOs ───────────────────────────────────────────────────────────
/** Ref: Blueprint §4.1 — portfolio_snapshot entity */
export interface HoldingDto {
  ticker: string;
  name: string;
  isin?: string;
  asset_class: string;
  quantity: number;
  current_price: number;
  market_value: number;
  weight_pct: number;
  daily_pnl: number;
  daily_pnl_pct: number;
  sector: string;
}

export interface RiskMetricsDto {
  var_95: number;          // Value at Risk (95% confidence)
  sharpe_ratio: number;
  beta: number;
  max_drawdown_pct: number;
  concentration_risk: string[];   // Overweight sectors/positions
  rebalancing_needed: boolean;
  rebalancing_suggestions?: string[];
}

/** Ref: Blueprint §4.3 — Portfolio Insights: real-time performance, risk, rebalancing */
export interface PortfolioSnapshotDto {
  snapshot_id: string;
  account_id: string;
  client_id: string;
  advisor_id: string;
  nav: number;
  daily_return_pct: number;
  ytd_return_pct: number;
  holdings: HoldingDto[];
  risk_metrics: RiskMetricsDto;
  snapshot_ts: string;
}

// ─── Client DTOs ──────────────────────────────────────────────────────────────
/** Ref: Blueprint §4.1 — client entity; §4.2 — Client Intelligence */
export interface ClientProfileDto {
  client_id: string;
  firm_id: string;
  advisor_id: string;
  name: string;
  email?: string;        // Masked per role scope — Blueprint §5 PII masking
  risk_profile: RiskProfile;
  kyc_status: string;
  segment: string;
  life_stage?: string;
  aum: number;
  behavioral_flags: string[];
  life_events_detected: string[];  // Ref: Blueprint §4.2 — Life-event detection
  last_interaction_date?: string;
}

// ─── Compliance DTOs ──────────────────────────────────────────────────────────
/** Ref: Blueprint §6 Task 5 — Compliance Engine */
export interface ComplianceCheckRequestDto {
  context_type: 'AI_RECOMMENDATION' | 'PRE_TRADE' | 'POST_TRADE';
  advisor_id: string;
  firm_id: string;
  client_id?: string;
  payload: Record<string, unknown>;  // Context being validated
  recommendation_text?: string;
}

export interface ComplianceViolationDto {
  rule_id: string;
  rule_name: string;
  severity: ComplianceSeverity;
  description: string;
  regulatory_reference: string;   // e.g., "SEC Rule 15c3-5"
}

export interface ComplianceCheckResponseDto {
  check_id: string;
  outcome: ComplianceOutcome;
  violations: ComplianceViolationDto[];
  disclosure_text?: string;       // Appended for WARN severity
  explainability: ExplainabilityDto;
  audit_id: string;
  evaluated_at: string;
}

// ─── Recommendation DTOs ──────────────────────────────────────────────────────
/** Ref: Blueprint §4.6 — Revenue Enablement; §4.2 — Next Best Action */
export interface NextBestActionDto {
  rec_id: string;
  rec_type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  product_name?: string;
  estimated_revenue_impact?: number;
  suitability_score: number;      // 0.0 – 1.0
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  explainability: ExplainabilityDto;
}

export interface RecommendationResponseDto {
  client_id: string;
  advisor_id: string;
  recommendations: NextBestActionDto[];
  life_event_detected?: string;
  generated_at: string;
  audit_id: string;
}

// ─── NER DTOs (for gRPC service interface) ────────────────────────────────────
/** Ref: Blueprint §3.4 — spaCy NER gRPC service for financial entity extraction */
export interface NerEntity {
  text: string;
  label: string;    // PERSON | ORG | TICKER | ACCOUNT | INSTRUMENT | MONEY
  start: number;
  end: number;
  confidence: number;
}

export interface NerRequestDto {
  text: string;
  session_id: string;
}

export interface NerResponseDto {
  entities: NerEntity[];
  processed_in_ms: number;
}

// ─── Advisor DTOs ─────────────────────────────────────────────────────────────
export interface AdvisorDto {
  advisor_id: string;
  firm_id: string;
  name: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  client_count?: number;
  total_aum?: number;
}

// ─── Audit DTOs ───────────────────────────────────────────────────────────────
/** Ref: Blueprint §4.1 — audit_log (append-only); §5 Production Readiness */
export interface AuditLogEntryDto {
  log_id: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  ip_address?: string;
  ts: string;
}

// ─── SSE Event Types ──────────────────────────────────────────────────────────
/** Ref: Blueprint §2.4 — SSE for LLM streaming responses */
export interface SseChunkDto {
  type: 'chunk' | 'done' | 'error' | 'compliance_check';
  content?: string;
  metadata?: Partial<ChatResponseDto>;
  error?: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  pagination: PaginationDto;
}
