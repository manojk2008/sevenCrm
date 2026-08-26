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

const OLD_CREATED_AT = new Date('2024-01-15T00:00:00.000Z');

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

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

function createFixtureClient(organizationId: string, companyName?: string) {
  return prisma.client.create({
    data: {
      organizationId,
      companyName: companyName ?? `Fixture Client ${uid()}`,
      industry: 'IT Services',
      email: `client-${uid()}@test.local`,
      phone: '+919876500000',
      addressLine1: '123 Business Park',
      addressCity: 'Mumbai',
      addressState: 'Maharashtra',
      addressPincode: '400001',
    },
  });
}

function createFixtureEnquiry(
  organizationId: string,
  clientId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.enquiry.create({
    data: {
      organizationId,
      clientId,
      title: `Fixture Enquiry ${uid()}`,
      expectedRevenue: 50000,
      probability: 50,
      priority: 'MEDIUM',
      source: 'WEBSITE',
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  });
}

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let orgEmpty: { id: string };

  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let emptyOrgAdmin: { id: string; email: string };

  let clientA: { id: string };
  let clientB: { id: string };

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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    orgA = await prisma.organization.create({
      data: { name: `Analytics Org A ${runId}`, slug: `analytics-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Analytics Org B ${runId}`, slug: `analytics-test-org-b-${runId}` },
    });
    orgEmpty = await prisma.organization.create({
      data: { name: `Analytics Org Empty ${runId}`, slug: `analytics-test-org-empty-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `analytics-super-${runId}@test.local`,
      name: 'Analytics Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `analytics-admin-${runId}@test.local`,
      name: 'Analytics Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `analytics-exec-${runId}@test.local`,
      name: 'Analytics Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    emptyOrgAdmin = await createFixtureUser({
      email: `analytics-empty-admin-${runId}@test.local`,
      name: 'Analytics Empty Org Admin',
      organizationId: orgEmpty.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    clientA = await createFixtureClient(orgA.id, `Analytics Client A ${runId}`);
    clientB = await createFixtureClient(orgB.id, `Analytics Client B ${runId}`);

    // 2 enquiries raised "recently" (default createdAt = now), 1 raised long ago.
    await createFixtureEnquiry(orgA.id, clientA.id);
    await createFixtureEnquiry(orgA.id, clientA.id);
    await createFixtureEnquiry(orgA.id, clientA.id, { createdAt: OLD_CREATED_AT });

    // Org B: distinctive count, must never leak into Org A.
    for (let i = 0; i < 9; i++) {
      await createFixtureEnquiry(orgB.id, clientB.id);
    }
  }, 60000);

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id, orgEmpty.id];
    await prisma.enquiry.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await app.close();
    await prisma.$disconnect();
  }, 60000);

  // ------------------------------------------------------- authentication

  it('1. rejects /analytics/summary when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/analytics/summary').expect(401);
  });

  // -------------------------------------------------------- authorization

  it('2. allows a Super Admin to read /analytics/summary', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/analytics/summary')
      .set('Cookie', cookies)
      .expect(200);
  });

  it('3. allows an Admin to read /analytics/summary', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .get('/analytics/summary')
      .set('Cookie', cookies)
      .expect(200);
  });

  it('4. allows a Sales Executive to read /analytics/summary', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .get('/analytics/summary')
      .set('Cookie', cookies)
      .expect(200);
  });

  // ------------------------------------------------------------- summary

  it('5. counts every enquiry raised in Org A when no period is given', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/analytics/summary')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.newEnquiries).toBe(3);
    expect(res.body.period.basis).toBe('ENQUIRY_CREATED_AT');
  });

  it('6. filters newEnquiries by Enquiry.createdAt when a period is given', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/analytics/summary?from=2025-01-01T00:00:00.000Z')
      .set('Cookie', cookies)
      .expect(200);
    // Only the 2 recently-created enquiries fall after 2025-01-01; the one
    // seeded at OLD_CREATED_AT (2024) is excluded.
    expect(res.body.newEnquiries).toBe(2);
  });

  it('7. declares CAC and Sales Velocity as unavailable rather than fabricating them', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/analytics/summary')
      .set('Cookie', cookies)
      .expect(200);
    const keys = (res.body.unavailableMetrics as { key: string }[]).map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(['cac', 'salesVelocity']));
  });

  it('8. returns a genuine zero for an organization with no enquiries', async () => {
    const cookies = await signIn(emptyOrgAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/analytics/summary')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.newEnquiries).toBe(0);
  });

  it('9. never leaks Org B counts into Org A', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/analytics/summary')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.newEnquiries).toBeLessThan(9);
  });

  // ---------------------------------------------------------- validation

  it('10. rejects an invalid date', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/analytics/summary?from=not-a-date')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('11. rejects an attempt to inject organizationId as a query parameter', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/analytics/summary?organizationId=${orgB.id}`)
      .set('Cookie', cookies)
      .expect(400);
  });

  // --------------------------------------------------------------- writes

  it('12. exposes no write routes on /analytics', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/analytics/summary')
      .set('Cookie', cookies)
      .expect(404);
    await request(app.getHttpServer())
      .patch('/analytics/summary')
      .set('Cookie', cookies)
      .expect(404);
    await request(app.getHttpServer())
      .delete('/analytics/summary')
      .set('Cookie', cookies)
      .expect(404);
  });

  // -------------------------------------------------------------------
  // Phase 19 — Sales Executive client ownership
  // -------------------------------------------------------------------

  it('13. Sales Executive newEnquiries is scoped to enquiries of assigned clients', async () => {
    const salesCookies = await signIn(salesUser.email);
    const superCookies = await signIn(superAdmin.email);

    const ownClient = await createFixtureClient(orgA.id, `P19 Analytics Own Client ${runId}`);
    await prisma.client.update({ where: { id: ownClient.id }, data: { assignedToId: salesUser.id } });
    const otherClient = await createFixtureClient(orgA.id, `P19 Analytics Other Client ${runId}`);

    await createFixtureEnquiry(orgA.id, ownClient.id);
    await createFixtureEnquiry(orgA.id, otherClient.id);

    const [salesRes, superRes] = await Promise.all([
      request(app.getHttpServer()).get('/analytics/summary').set('Cookie', salesCookies).expect(200),
      request(app.getHttpServer()).get('/analytics/summary').set('Cookie', superCookies).expect(200),
    ]);
    // The Sales Executive's count is strictly less than the
    // organization-wide total, proving the other rep's enquiry did not
    // leak in even though it was raised in the same window.
    expect(salesRes.body.newEnquiries).toBeLessThan(superRes.body.newEnquiries);
  });

  it('14. Admin and Super Admin retain organization-wide analytics behavior', async () => {
    const adminCookies = await signIn(adminUser.email);
    const superCookies = await signIn(superAdmin.email);

    const [adminRes, superRes] = await Promise.all([
      request(app.getHttpServer()).get('/analytics/summary').set('Cookie', adminCookies).expect(200),
      request(app.getHttpServer()).get('/analytics/summary').set('Cookie', superCookies).expect(200),
    ]);
    expect(adminRes.body.newEnquiries).toBe(superRes.body.newEnquiries);
  });
});
