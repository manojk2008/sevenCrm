import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
// See users.e2e-spec.ts for why this imports from ../dist rather than the
// raw TS source — the Prisma-generated client needs the compiled output.
import { AppModule } from '../dist/src/app.module';
import { auth, prisma } from '../dist/src/auth/auth';

const FIXTURE_PASSWORD = 'TestPassw0rd!123';
const runId = Date.now();

async function createFixtureUser(params: {
  email: string;
  name: string;
  organizationId: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SALES_EXECUTIVE';
  department: string;
}) {
  const created = await auth.api.createUser({
    body: {
      email: params.email,
      name: params.name,
      password: FIXTURE_PASSWORD,
      data: {
        organizationId: params.organizationId,
        crmRole: params.role,
        department: params.department,
        status: 'ACTIVE',
        emailVerified: true,
      },
    },
  });
  if (!created?.user) {
    throw new Error(`Failed to create fixture user ${params.email}`);
  }
  return created.user;
}

describe('UsersController - self-service profile (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };

  async function signIn(email: string): Promise<string[]> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: FIXTURE_PASSWORD })
      .expect(200);
    const cookies = res.get('set-cookie');
    if (!cookies) {
      throw new Error(`Sign-in for ${email} did not return a session cookie`);
    }
    return Array.isArray(cookies) ? cookies : [cookies];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    // Mirrors src/main.ts's bootstrap() exactly — the TestingModule route
    // here never goes through main.ts, so the global ValidationPipe (and
    // therefore whitelist/forbidNonWhitelisted/transform) must be
    // registered explicitly or DTO validation silently never runs.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    orgA = await prisma.organization.create({
      data: { name: `Profile Test Org A ${runId}`, slug: `profile-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Profile Test Org B ${runId}`, slug: `profile-test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `profile-super-${runId}@test.local`,
      name: 'Profile Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `profile-admin-${runId}@test.local`,
      name: 'Profile Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `profile-sales-${runId}@test.local`,
      name: 'Profile Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  it('1. rejects PATCH /users/me when unauthenticated', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ name: 'Nobody' })
      .expect(401);
  });

  it('2. allows a SUPER_ADMIN to update their own profile', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ name: 'Updated Super Admin', department: 'Executive' })
      .expect(200);

    expect(res.body.name).toBe('Updated Super Admin');
    expect(res.body.department).toBe('Executive');
    expect(res.body.role).toBe('SUPER_ADMIN');
  });

  it('3. allows an ADMIN to update their own profile', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ name: 'Updated Admin', department: 'Ops Updated' })
      .expect(200);

    expect(res.body.name).toBe('Updated Admin');
    expect(res.body.department).toBe('Ops Updated');
    expect(res.body.role).toBe('ADMIN');
  });

  it('4. allows a SALES_EXECUTIVE to update their own profile', async () => {
    const cookies = await signIn(salesUser.email);
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ name: 'Updated Sales Exec', department: 'Sales Updated' })
      .expect(200);

    expect(res.body.name).toBe('Updated Sales Exec');
    expect(res.body.department).toBe('Sales Updated');
    expect(res.body.role).toBe('SALES_EXECUTIVE');
  });

  it('5. persists a name update to the database', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ name: 'Persisted Name' })
      .expect(200);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: salesUser.id } });
    expect(stored.name).toBe('Persisted Name');
  });

  it('6. persists a department update to the database', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ department: 'Persisted Department' })
      .expect(200);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: salesUser.id } });
    expect(stored.department).toBe('Persisted Department');
  });

  it('7. leaves an omitted field unchanged', async () => {
    const cookies = await signIn(salesUser.email);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: salesUser.id } });

    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ name: 'Name Only Change' })
      .expect(200);

    expect(res.body.name).toBe('Name Only Change');
    expect(res.body.department).toBe(before.department);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: salesUser.id } });
    expect(after.department).toBe(before.department);
  });

  it('8. rejects an invalid (empty) name', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ name: '' })
      .expect(400);
  });

  it('9. rejects an invalid (empty) department', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ department: '' })
      .expect(400);
  });

  it('10. rejects unknown fields', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ favoriteColor: 'blue' })
      .expect(400);
  });

  it('11. rejects id/userId injection', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ id: 'some-other-id', name: 'Should Not Save' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ userId: 'some-other-id', name: 'Should Not Save' })
      .expect(400);
  });

  it('12. rejects organizationId injection and never moves the user to another org', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ organizationId: orgB.id, name: 'Should Not Save' })
      .expect(400);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: salesUser.id } });
    expect(stored.organizationId).toBe(orgA.id);
  });

  it('13. rejects role injection and never changes the caller role', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ role: 'SUPER_ADMIN', name: 'Should Not Save' })
      .expect(400);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: salesUser.id } });
    expect(stored.role).toBe('SALES_EXECUTIVE');
  });

  it('14. rejects email injection', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ email: 'hijacked@test.local', name: 'Should Not Save' })
      .expect(400);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: salesUser.id } });
    expect(stored.email).toBe(salesUser.email);
  });

  it('15. rejects createdAt/updatedAt injection', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ createdAt: '2000-01-01T00:00:00.000Z', name: 'Should Not Save' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ updatedAt: '2000-01-01T00:00:00.000Z', name: 'Should Not Save' })
      .expect(400);
  });

  it('16. cannot modify another user profile through /users/me', async () => {
    const cookies = await signIn(salesUser.email);
    const adminBefore = await prisma.user.findUniqueOrThrow({ where: { id: adminUser.id } });

    // /users/me has no target-id field at all; an id in the body is
    // rejected outright by the whitelist, so the admin's row is untouched.
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ id: adminUser.id, name: 'Hijacked Admin Name' })
      .expect(400);

    const adminAfter = await prisma.user.findUniqueOrThrow({ where: { id: adminUser.id } });
    expect(adminAfter.name).toBe(adminBefore.name);
  });

  it('17. response does not expose sensitive authentication fields', async () => {
    const cookies = await signIn(salesUser.email);
    const res = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookies)
      .send({ name: 'Safe Response Check' })
      .expect(200);

    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('banned');
    expect(res.body).not.toHaveProperty('banReason');
    expect(res.body).not.toHaveProperty('banExpires');
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('password');
  });

  it('18. changes survive a fresh authenticated request', async () => {
    const firstCookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', firstCookies)
      .send({ name: 'Survives Reload' })
      .expect(200);

    // A brand-new sign-in (fresh session/cookie), mirroring a hard reload
    // that re-fetches the session from scratch.
    const freshCookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get(`/users/${adminUser.id}`)
      .set('Cookie', freshCookies)
      .expect(200);

    expect(res.body.name).toBe('Survives Reload');
  });

  it('19. existing PATCH /users/:id admin behavior remains unchanged', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .patch(`/users/${salesUser.id}`)
      .set('Cookie', cookies)
      .send({ department: 'Admin Set Department' })
      .expect(200);

    expect(res.body.department).toBe('Admin Set Department');

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: salesUser.id } });
    expect(stored.department).toBe('Admin Set Department');
  });

  it('20. non-admin cannot use PATCH /users/:id to modify another user', async () => {
    const cookies = await signIn(salesUser.email);
    const adminBefore = await prisma.user.findUniqueOrThrow({ where: { id: adminUser.id } });

    await request(app.getHttpServer())
      .patch(`/users/${adminUser.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Should Not Apply' })
      .expect(403);

    const adminAfter = await prisma.user.findUniqueOrThrow({ where: { id: adminUser.id } });
    expect(adminAfter.name).toBe(adminBefore.name);
  });
});
