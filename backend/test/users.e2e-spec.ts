import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
// Imported from the compiled dist output, not TS source: the
// Prisma-generated client (pulled in transitively via AppModule -> auth.ts)
// requires sibling .js files that only exist after `npm run build`; ts-jest
// re-transpiling the raw .ts source on the fly cannot resolve them. Run
// `npm run build` before `npm run test:e2e`.
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

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let otherOrgUser: { id: string; email: string };

  const createdUserIds: string[] = [];

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
    await app.init();

    orgA = await prisma.organization.create({
      data: { name: `Test Org A ${runId}`, slug: `test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Test Org B ${runId}`, slug: `test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `super-${runId}@test.local`,
      name: 'Test Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `admin-${runId}@test.local`,
      name: 'Test Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `sales-${runId}@test.local`,
      name: 'Test Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgUser = await createFixtureUser({
      email: `other-${runId}@test.local`,
      name: 'Other Org User',
      organizationId: orgB.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });

    createdUserIds.push(superAdmin.id, adminUser.id, salesUser.id, otherOrgUser.id);
  }, 30000);

  afterAll(async () => {
    // Delete by organizationId rather than the tracked id list, so cleanup
    // is robust even if a test failed partway through and never recorded
    // the id of a user it created.
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  it('1. rejects user creation when unauthenticated', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({
        name: 'Nobody',
        email: `unauth-${runId}@test.local`,
        password: FIXTURE_PASSWORD,
        role: 'SALES_EXECUTIVE',
        department: 'Sales',
      })
      .expect(401);
  });

  it('2. rejects user creation by a Sales Executive', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', cookies)
      .send({
        name: 'Blocked',
        email: `blocked-sales-${runId}@test.local`,
        password: FIXTURE_PASSWORD,
        role: 'SALES_EXECUTIVE',
        department: 'Sales',
      })
      .expect(403);
  });

  it('3. rejects user creation by an Admin', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', cookies)
      .send({
        name: 'Blocked',
        email: `blocked-admin-${runId}@test.local`,
        password: FIXTURE_PASSWORD,
        role: 'SALES_EXECUTIVE',
        department: 'Sales',
      })
      .expect(403);
  });

  it('4. allows a Super Admin to create an Admin, assigned to their org, without leaking secrets', async () => {
    const cookies = await signIn(superAdmin.email);
    const email = `created-admin-${runId}@test.local`;
    const res = await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', cookies)
      .send({
        name: 'Created Admin',
        email,
        password: FIXTURE_PASSWORD,
        role: 'ADMIN',
        department: 'Operations',
      })
      .expect(201);

    expect(res.body.role).toBe('ADMIN');
    // 7. assigned to the Super Admin's organization
    expect(res.body.organizationId).toBe(orgA.id);
    // 9. password never returned
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('password');

    createdUserIds.push(res.body.id);
  });

  it('5. allows a Super Admin to create a Sales Executive, assigned to their org', async () => {
    const cookies = await signIn(superAdmin.email);
    const email = `created-sales-${runId}@test.local`;
    const res = await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', cookies)
      .send({
        name: 'Created Sales Exec',
        email,
        password: FIXTURE_PASSWORD,
        role: 'SALES_EXECUTIVE',
        department: 'Sales',
      })
      .expect(201);

    expect(res.body.role).toBe('SALES_EXECUTIVE');
    expect(res.body.organizationId).toBe(orgA.id);
    expect(res.body).not.toHaveProperty('password');

    createdUserIds.push(res.body.id);
  });

  it('6. rejects creation with a duplicate email', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', cookies)
      .send({
        name: 'Duplicate',
        email: adminUser.email,
        password: FIXTURE_PASSWORD,
        role: 'ADMIN',
        department: 'Operations',
      })
      .expect(409);
  });

  it('8. rejects cross-organization user access (404, not 403)', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/users/${otherOrgUser.id}`)
      .set('Cookie', cookies)
      .expect(404);
  });

  it('9. never returns a password field when listing or fetching users', async () => {
    const cookies = await signIn(superAdmin.email);
    const listRes = await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', cookies)
      .expect(200);
    expect(JSON.stringify(listRes.body).toLowerCase()).not.toContain('password');

    const getRes = await request(app.getHttpServer())
      .get(`/users/${adminUser.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(JSON.stringify(getRes.body).toLowerCase()).not.toContain('password');
  });

  it('10. prevents a Super Admin from deactivating themselves', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch(`/users/${superAdmin.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(403);

    const stillActive = await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } });
    expect(stillActive.status).toBe('ACTIVE');
    expect(stillActive.banned).toBe(false);
  });

  it('11. prevents a Super Admin from removing their own SUPER_ADMIN role', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch(`/users/${superAdmin.id}`)
      .set('Cookie', cookies)
      .send({ role: 'ADMIN' })
      .expect(403);

    const stillSuperAdmin = await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } });
    expect(stillSuperAdmin.role).toBe('SUPER_ADMIN');
  });
});
