import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The "who" behind a write, threaded through to audit.extension.ts without
 * any explicit passing through service/controller call sites — see
 * actor-context.middleware.ts, the sole place this is populated.
 */
export interface AuditActorContext {
  actorId: string;
  actorName: string;
  actorEmail: string;
}

export const actorContextStorage = new AsyncLocalStorage<AuditActorContext>();

export function getActorContext(): AuditActorContext | undefined {
  return actorContextStorage.getStore();
}
