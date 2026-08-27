import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { withAuditLogging } from '../audit-logs/audit.extension';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const adapter = new PrismaPg(requireEnv('DATABASE_URL'));
// Wrapped once, here, with the audit-logging Prisma Client Extension — every
// consumer across the app imports this same `prisma` (including Better
// Auth's own adapter below), so CREATE/UPDATE writes on an audited model
// (see audit-logs/entity-config.ts) are logged transparently with no
// explicit audit call anywhere else in the codebase.
export const prisma = withAuditLogging(new PrismaClient({ adapter }));

// Better Auth is the only identity source for SevenCRM — there is no
// separate custom user/auth table. CRM-specific fields (organizationId,
// role, department, status, lastActiveAt) live directly on the Better
// Auth `user` model (see prisma/schema.prisma).
export const auth = betterAuth({
  secret: requireEnv('BETTER_AUTH_SECRET'),
  baseURL: requireEnv('BETTER_AUTH_URL'),

  trustedOrigins: [
    'http://localhost:3000',
    'https://sevencrm.onrender.com',
  ],

  advanced: {
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
    },
  },
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    // Users are provisioned by a Super Admin (Users -> Invite User), not
    // through self-serve sign-up. That flow isn't implemented yet, but
    // public sign-up must stay disabled at the auth layer regardless.
    disableSignUp: true,
  },
  user: {
    // Declares SevenCRM's existing CRM-specific columns to Better Auth so
    // its own user-creation/update mechanisms (e.g. the admin plugin's
    // `createUser`) can set them atomically instead of silently dropping
    // unrecognized fields. `crmRole` is a distinct logical field mapped onto
    // the real `role` column — SevenCRM's authoritative `UserRole` enum,
    // never to be confused with the admin plugin's own `role` concept
    // (see the `admin` plugin config below, which maps to `betterAuthRole`).
    additionalFields: {
      organizationId: {
        type: 'string',
        required: true,
        input: true,
      },
      crmRole: {
        type: 'string',
        required: true,
        input: true,
        fieldName: 'role',
      },
      department: {
        type: 'string',
        required: true,
        input: true,
      },
      status: {
        type: 'string',
        required: false,
        input: true,
        defaultValue: 'ACTIVE',
      },
    },
  },
  plugins: [
    // Server-side administrative user management only (e.g. auth.api.createUser
    // for the bootstrap setup script). Not exposed to the public frontend yet;
    // CRM authorization is handled separately by SevenCRM's own `UserRole`
    // enum in the NestJS service layer, never by this plugin.
    //
    // The plugin's own `role` field is remapped to `betterAuthRole` — a
    // dedicated column — so it can never collide with or overwrite the CRM
    // `role` enum column, which is a distinct, authoritative field.
    admin({
      schema: {
        user: {
          fields: {
            role: 'betterAuthRole',
          },
        },
      },
    }),
  ],
});
