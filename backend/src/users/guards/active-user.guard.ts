import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AppSession } from '../../auth/session.types';

/**
 * Better Auth's admin-plugin `banned` hook only blocks *new* sign-ins (see
 * src/auth/auth.ts) — a session issued before a user was deactivated stays
 * valid until it expires naturally. This guard closes that gap for
 * SevenCRM's own API surface by re-checking the caller's current CRM
 * `status` on every request, using the session Better Auth's global
 * AuthGuard already fetched fresh from the database (not client input).
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { session?: AppSession | null }>();
    const session = request.session;
    if (!session?.user) {
      throw new UnauthorizedException();
    }
    if (session.user.status === 'INACTIVE') {
      throw new UnauthorizedException('This account has been deactivated.');
    }
    return true;
  }
}
