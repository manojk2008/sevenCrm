import 'dotenv/config';
import { auth, prisma } from '../auth/auth';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const ORG_NAME = 'SevenCRM';
const ORG_SLUG = 'sevencrm';
const ADMIN_DEPARTMENT = 'Management';

async function ensureOrganization() {
  const organization = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: { name: ORG_NAME, slug: ORG_SLUG },
  });
  console.log(`[setup:admin] Organization ready: ${organization.name} (${organization.slug})`);
  return organization;
}

async function main() {
  const name = requireEnv('INITIAL_ADMIN_NAME');
  const email = requireEnv('INITIAL_ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('INITIAL_ADMIN_PASSWORD');

  const organization = await ensureOrganization();

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (existingSuperAdmin) {
    if (existingSuperAdmin.email === email) {
      console.log(
        `[setup:admin] Super Admin already exists (${existingSuperAdmin.email}). Nothing to do.`,
      );
      return;
    }
    console.log(
      `[setup:admin] A Super Admin already exists (${existingSuperAdmin.email}). ` +
        'Exactly one initial Super Admin is allowed, so no new account will be created. ' +
        'Skipping.',
    );
    return;
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    console.error(
      `[setup:admin] FAILED: a user with email "${email}" already exists (role: ${existingByEmail.role}). ` +
        'Refusing to modify an existing account. Choose a different INITIAL_ADMIN_EMAIL or ' +
        'resolve the conflict manually.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[setup:admin] Creating initial Super Admin (${email})...`);

  // Single atomic call through Better Auth's admin-plugin `createUser` API
  // (auth.api.createUser — server-side only, not HTTP-exposed here). CRM
  // fields ride along as declared `additionalFields` (see src/auth/auth.ts)
  // so Better Auth itself performs the insert and password hashing; this
  // script never touches the account/credential table or hashes anything.
  const created = await auth.api.createUser({
    body: {
      email,
      name,
      password,
      data: {
        organizationId: organization.id,
        crmRole: 'SUPER_ADMIN',
        department: ADMIN_DEPARTMENT,
        status: 'ACTIVE',
        emailVerified: true,
      },
    },
  });

  if (!created?.user) {
    console.error('[setup:admin] FAILED: Better Auth did not return a created user.');
    process.exitCode = 1;
    return;
  }

  const finalUser = await prisma.user.findUniqueOrThrow({
    where: { id: created.user.id },
    include: { accounts: { select: { providerId: true } } },
  });

  const hasCredentialAccount = finalUser.accounts.some((a) => a.providerId === 'credential');
  if (!hasCredentialAccount) {
    console.error('[setup:admin] FAILED: user was created but has no credential account.');
    process.exitCode = 1;
    return;
  }

  console.log('[setup:admin] Super Admin created successfully:');
  console.log(`  name:           ${finalUser.name}`);
  console.log(`  email:          ${finalUser.email}`);
  console.log(`  role:           ${finalUser.role}`);
  console.log(`  department:     ${finalUser.department}`);
  console.log(`  status:         ${finalUser.status}`);
  console.log(`  organization:   ${organization.name} (${organization.slug})`);
  console.log('  credential account: present');
}

main()
  .catch((error) => {
    console.error('[setup:admin] FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
