import { Logger } from '@nestjs/common';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { AuditAction } from '../../generated/prisma/enums';
import { getActorContext } from './actor-context';
import { AUDITED_MODELS, type AuditModelConfig } from './entity-config';

const logger = new Logger('AuditExtension');

type Row = Record<string, unknown>;

/** Prisma.Decimal and Date aren't JSON-serializable as-is. */
function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  return value ?? null;
}

function snapshot(row: Row | null, fields: readonly string[]): Row | null {
  if (!row) return null;
  const out: Row = {};
  for (const field of fields) {
    out[field] = serializeValue(row[field]);
  }
  return out;
}

/** Whitelisted fields whose serialized value differs between before/after. */
function changedFields(
  before: Row | null,
  after: Row,
  fields: readonly string[],
): string[] {
  if (!before) return [...fields];
  return fields.filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}

type FindUniqueDelegate = (findArgs: { where: unknown }) => Promise<Row | null>;

/** "Task" -> "task", "FollowUp" -> "followUp", "ProductGroup" -> "productGroup" — the
 * Prisma model name to the client property name, which is always the model
 * name with its first character lowercased. */
function modelDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Reads through `client` (the plain base client captured by
 * withAuditLogging below), not `Prisma.getExtensionContext(this)` — that
 * context object does not expose `findUnique` for a
 * `$allModels.$allOperations` hook in this Prisma version.
 */
async function readBeforeRow(
  client: PrismaClient,
  model: string,
  args: unknown,
): Promise<Row | null> {
  const delegate = (
    client as unknown as Record<string, { findUnique: FindUniqueDelegate }>
  )[modelDelegateName(model)];
  return delegate.findUnique({ where: (args as { where: unknown }).where });
}

/**
 * Writes one best-effort audit row after a CREATE/UPDATE on an audited
 * model. Called with `client` — the same (already-extended) client the
 * extension itself is attached to, captured by closure in
 * withAuditLogging below — never a fresh import, which would create a
 * circular import between this file and auth.ts.
 *
 * Every failure path here is swallowed and logged, never thrown: an audit
 * write must never fail or roll back the primary CRM mutation it describes
 * (Phase 16 decision log item 2). This also means an update that touches no
 * whitelisted field (e.g. Better Auth bumping a column outside our
 * whitelist) is silently skipped rather than logged as a no-op change.
 */
async function recordAuditEntry(
  client: PrismaClient,
  params: {
    model: string;
    operation: 'create' | 'update';
    config: AuditModelConfig;
    beforeRow: Row | null;
    after: unknown;
  },
): Promise<void> {
  const { model, operation, config, beforeRow, after } = params;
  if (!after || typeof after !== 'object') return;
  const afterRow = after as Row;

  const organizationId = (
    model === 'Organization' ? afterRow.id : afterRow.organizationId
  ) as string | undefined;
  const entityId = afterRow.id as string | undefined;
  if (!organizationId || !entityId) {
    logger.error(
      `Skipped audit log for ${model}.${operation}: result had no organizationId/id`,
    );
    return;
  }

  const beforeSnapshot =
    operation === 'create' ? null : snapshot(beforeRow, config.fields);
  const afterSnapshot = snapshot(afterRow, config.fields);
  if (!afterSnapshot) return;

  let action: AuditAction =
    operation === 'create' ? AuditAction.CREATE : AuditAction.UPDATE;
  if (operation === 'update') {
    const changed = changedFields(beforeSnapshot, afterSnapshot, config.fields);
    if (changed.length === 0) return;
    if (config.statusField && changed.includes(config.statusField)) {
      action = AuditAction.STATUS_CHANGE;
    }
  }

  const actor = getActorContext();

  await client.auditLog.create({
    data: {
      organizationId,
      actorId: actor?.actorId ?? null,
      actorName: actor?.actorName ?? null,
      actorEmail: actor?.actorEmail ?? null,
      action,
      entityType: config.entityType,
      entityId,
      entityLabel: config.label(afterRow),
      before:
        beforeSnapshot === null
          ? Prisma.JsonNull
          : (beforeSnapshot as Prisma.InputJsonValue),
      after: afterSnapshot as Prisma.InputJsonValue,
    },
  });
}

/**
 * Prisma Client Extension: the sole place audit rows are generated (no
 * interceptor, no middleware-based audit generation, no EventEmitter, no
 * database triggers — Phase 16 decision log item 3). Wrap the base client
 * once in auth.ts and every existing service's `prisma.<model>.create/
 * update(...)` call is audited transparently, with zero changes to those
 * services.
 *
 * Only `create` and `update` are handled — the only operations any current
 * service performs on an audited model (there is no delete call site or
 * endpoint yet; see the AuditAction.DELETE comment in schema.prisma).
 * `updateMany`/`upsert`/etc. pass through unaudited rather than guessing at
 * before/after semantics for them.
 *
 * Both the pre-update read and the eventual audit write run fully decoupled
 * from the primary operation — neither is ever awaited before `query(args)`
 * resolves and its result is returned. This was not the original design:
 * awaiting them inline caused `QuotationsService.create/update` (which runs
 * inside `prisma.$transaction(...)`) to occasionally blow Prisma's 5s
 * interactive-transaction timeout under load, because each extra query here
 * competes with the open transaction for a pooled connection. Decoupling
 * them means the audit side-channel can never delay, let alone fail, the
 * primary CRM mutation it describes (Phase 16 decision log item 2) —
 * regardless of whether that mutation happens to run inside a transaction,
 * which is also why this needs no transaction-specific branching.
 */
export function withAuditLogging<T extends PrismaClient>(client: T): T {
  const extended = client.$extends({
    name: 'audit-logging',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const config = model ? AUDITED_MODELS[model] : undefined;
          if (!config || (operation !== 'create' && operation !== 'update')) {
            return query(args);
          }

          const beforeRowPromise: Promise<Row | null> =
            operation === 'update'
              ? readBeforeRow(client, model as string, args).catch(
                  (error: unknown) => {
                    logger.error(
                      `Failed to read pre-update state for ${model}`,
                      error as Error,
                    );
                    return null;
                  },
                )
              : Promise.resolve(null);

          const result = await query(args);

          void beforeRowPromise
            .then((beforeRow) =>
              recordAuditEntry(client, {
                model: model,
                operation,
                config,
                beforeRow,
                after: result,
              }),
            )
            .catch((error: unknown) => {
              logger.error(
                `Failed to write audit log for ${model}.${operation}`,
                error as Error,
              );
            });

          return result;
        },
      },
    },
  });

  return extended as unknown as T;
}
