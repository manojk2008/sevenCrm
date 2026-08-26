import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth';
import { actorContextStorage } from './actor-context';

const logger = new Logger('ActorContextMiddleware');

/**
 * Populates the audit log's AsyncLocalStorage actor context for the
 * lifetime of one request (see actor-context.ts). This is the one and only
 * place that context is set.
 *
 * It fetches the session itself — the same `auth.api.getSession(...)` call
 * Better Auth's own global AuthGuard makes — rather than reading
 * `request.session`. That guard populates `request.session` from inside its
 * own `canActivate()`, and NestJS does not guarantee the relative order of
 * multiple global enhancers from different modules, so this middleware
 * cannot assume it runs after that guard. Being self-sufficient sidesteps
 * that ordering question entirely, at the cost of one extra session lookup
 * per request.
 *
 * Deliberately middleware, not a guard: this must wrap the *entire*
 * downstream request (guards, interceptors, the controller handler, and the
 * Prisma calls beneath it) in one AsyncLocalStorage.run() call so the
 * context is actually visible when audit.extension.ts reads it later.
 * `enterWith()` in a guard was tried first and does not work here — Nest's
 * router chains guards into the handler via `await`, and empirically the
 * context set by `enterWith` inside a guard was not visible by the time the
 * Prisma extension ran during the same request. `run()` around `next()`
 * does not have that problem, because it explicitly scopes everything
 * `next()` triggers, synchronously and asynchronously.
 *
 * This is not "middleware-based audit generation" (decision log item 3,
 * disallowed): it writes no audit rows and knows nothing about
 * CREATE/UPDATE/STATUS_CHANGE — it only makes "who is making this request"
 * available to the Prisma Client Extension, which remains the sole place
 * audit rows are ever written.
 */
@Injectable()
export class ActorContextMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
    try {
      session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    } catch (error) {
      logger.error('Failed to resolve session for actor context', error as Error);
    }

    if (!session?.user) {
      next();
      return;
    }

    actorContextStorage.run(
      {
        actorId: session.user.id,
        actorName: session.user.name,
        actorEmail: session.user.email,
      },
      () => next(),
    );
  }
}
