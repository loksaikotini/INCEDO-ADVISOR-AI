-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADVISOR', 'COMPLIANCE', 'OPERATIONS', 'RELATIONSHIP_MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RiskProfile" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'VERY_AGGRESSIVE');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AdvisorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'CLOSED', 'FROZEN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'REBALANCE', 'FEE');

-- CreateEnum
CREATE TYPE "ComplianceSeverity" AS ENUM ('INFO', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "ComplianceOutcome" AS ENUM ('PASS', 'WARN', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('CROSS_SELL', 'UPSELL', 'REBALANCE', 'OUTREACH', 'RISK_ALERT');

-- CreateEnum
CREATE TYPE "ConversationRole" AS ENUM ('user', 'assistant', 'system');

-- CreateTable
CREATE TABLE "firm" (
    "firm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regulatory_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STANDARD',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firm_pkey" PRIMARY KEY ("firm_id")
);

-- CreateTable
CREATE TABLE "advisor" (
    "advisor_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADVISOR',
    "licenses" JSONB NOT NULL DEFAULT '[]',
    "status" "AdvisorStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_pkey" PRIMARY KEY ("advisor_id")
);

-- CreateTable
CREATE TABLE "client" (
    "client_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "advisor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "profile" JSONB NOT NULL DEFAULT '{}',
    "risk_profile" "RiskProfile" NOT NULL DEFAULT 'MODERATE',
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "segment" TEXT NOT NULL DEFAULT 'RETAIL',
    "life_stage" TEXT,
    "behavioral_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "life_events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("client_id")
);

-- CreateTable
CREATE TABLE "account" (
    "account_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "custodian" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshot" (
    "snapshot_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "snapshot_ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nav" DECIMAL(18,4) NOT NULL,
    "holdings" JSONB NOT NULL DEFAULT '[]',
    "risk_metrics" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "portfolio_snapshot_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "instrument" (
    "instrument_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "isin" TEXT,
    "name" TEXT NOT NULL,
    "asset_class" TEXT NOT NULL,
    "market_data" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instrument_pkey" PRIMARY KEY ("instrument_id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "txn_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SETTLED',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("txn_id")
);

-- CreateTable
CREATE TABLE "compliance_rule" (
    "rule_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ComplianceSeverity" NOT NULL DEFAULT 'WARN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rule_logic" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_rule_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "compliance_event" (
    "event_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "advisor_id" TEXT NOT NULL,
    "outcome" "ComplianceOutcome" NOT NULL DEFAULT 'PASS',
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB NOT NULL DEFAULT '{}',
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "compliance_event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "conv_id" TEXT NOT NULL,
    "advisor_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "client_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("conv_id")
);

-- CreateTable
CREATE TABLE "conversation_turn" (
    "turn_id" TEXT NOT NULL,
    "conv_id" TEXT NOT NULL,
    "role" "ConversationRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "model_used" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_turn_pkey" PRIMARY KEY ("turn_id")
);

-- CreateTable
CREATE TABLE "ai_recommendation" (
    "rec_id" TEXT NOT NULL,
    "advisor_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "rec_type" "RecommendationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "shap_explanation" JSONB NOT NULL DEFAULT '{}',
    "acted_on" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "ai_recommendation_pkey" PRIMARY KEY ("rec_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "log_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "firm_regulatory_id_key" ON "firm"("regulatory_id");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_email_key" ON "advisor"("email");

-- CreateIndex
CREATE INDEX "advisor_firm_id_idx" ON "advisor"("firm_id");

-- CreateIndex
CREATE INDEX "client_advisor_id_idx" ON "client"("advisor_id");

-- CreateIndex
CREATE INDEX "client_firm_id_idx" ON "client"("firm_id");

-- CreateIndex
CREATE INDEX "account_client_id_idx" ON "account"("client_id");

-- CreateIndex
CREATE INDEX "portfolio_snapshot_account_id_snapshot_ts_idx" ON "portfolio_snapshot"("account_id", "snapshot_ts" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "instrument_ticker_key" ON "instrument"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "instrument_isin_key" ON "instrument"("isin");

-- CreateIndex
CREATE INDEX "instrument_ticker_idx" ON "instrument"("ticker");

-- CreateIndex
CREATE INDEX "transaction_account_id_executed_at_idx" ON "transaction"("account_id", "executed_at" DESC);

-- CreateIndex
CREATE INDEX "compliance_rule_firm_id_active_idx" ON "compliance_rule"("firm_id", "active");

-- CreateIndex
CREATE INDEX "compliance_event_advisor_id_triggered_at_idx" ON "compliance_event"("advisor_id", "triggered_at" DESC);

-- CreateIndex
CREATE INDEX "compliance_event_resolved_at_idx" ON "compliance_event"("resolved_at");

-- CreateIndex
CREATE INDEX "conversation_advisor_id_idx" ON "conversation"("advisor_id");

-- CreateIndex
CREATE INDEX "conversation_turn_conv_id_created_at_idx" ON "conversation_turn"("conv_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_recommendation_advisor_id_client_id_idx" ON "ai_recommendation"("advisor_id", "client_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_ts_idx" ON "audit_log"("entity_type", "entity_id", "ts" DESC);

-- CreateIndex
CREATE INDEX "audit_log_actor_id_ts_idx" ON "audit_log"("actor_id", "ts" DESC);

-- AddForeignKey
ALTER TABLE "advisor" ADD CONSTRAINT "advisor_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firm"("firm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firm"("firm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisor"("advisor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("client_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_snapshot" ADD CONSTRAINT "portfolio_snapshot_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instrument"("instrument_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_rule" ADD CONSTRAINT "compliance_rule_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firm"("firm_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_event" ADD CONSTRAINT "compliance_event_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "compliance_rule"("rule_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_event" ADD CONSTRAINT "compliance_event_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisor"("advisor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisor"("advisor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firm"("firm_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("client_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_turn" ADD CONSTRAINT "conversation_turn_conv_id_fkey" FOREIGN KEY ("conv_id") REFERENCES "conversation"("conv_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendation" ADD CONSTRAINT "ai_recommendation_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "advisor"("advisor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendation" ADD CONSTRAINT "ai_recommendation_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
