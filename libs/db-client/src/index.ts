// FILE: libs/db-client/src/index.ts
// Ref: Blueprint §6 Task 2 — Singleton Prisma client with connection pooling
// Ref: Blueprint §4.5 — Data Consistency: ACID transactions for portfolio mutations

import { PrismaClient } from './generated/client';

// ─── Singleton Prisma Client ──────────────────────────────────────────────────
// Prevents connection pool exhaustion in serverless / hot-reload environments
// Ref: Blueprint §3.3 — Redis Cluster + PostgreSQL connection pooling via PgBouncer

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'minimal',
  });
}

// In development, reuse the global instance across hot reloads
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// ─── Audit Log Helper ─────────────────────────────────────────────────────────
// Ref: Blueprint §4.1 — audit_log is append-only; §5 — Immutable audit trail
export async function writeAuditLog(params: {
  actor_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  ip_address?: string;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const entry = await prisma.auditLog.create({
    data: {
      actor_id: params.actor_id,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      action: params.action,
      ip_address: params.ip_address,
      before_data: params.before_data ? (params.before_data as any) : undefined,
      after_data: params.after_data ? (params.after_data as any) : undefined,
      metadata: params.metadata ? (params.metadata as any) : {},
    },
    select: { log_id: true },
  });
  return entry.log_id;
}

// ─── RLS Context Helper ────────────────────────────────────────────────────────
// Ref: Blueprint §4.4 — RLS policies: advisors read only their firm's data
// Sets PostgreSQL session variable for RLS policy enforcement
export async function withRlsContext<T>(
  firmId: string,
  advisorId: string,
  operation: () => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Set RLS context variables (picked up by PostgreSQL RLS policies)
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_firm_id', $1, TRUE)`,
      firmId,
    );
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_advisor_id', $1, TRUE)`,
      advisorId,
    );
    return operation();
  });
}

// Re-export Prisma types for convenience
export * from './generated/client';
export { PrismaClient };
