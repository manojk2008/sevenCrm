import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { auth } from './auth';

/**
 * The session shape returned by `@Session()`, typed with SevenCRM's
 * `additionalFields` (organizationId, crmRole, department, status) so
 * controllers get them without an extra Prisma round-trip.
 */
export type AppSession = UserSession<typeof auth>;
