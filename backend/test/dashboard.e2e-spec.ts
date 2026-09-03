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

function createFixtureClient(
  organizationId: string,
  companyName?: string,
  createdAt?: Date,
) {
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
      ...(createdAt ? { createdAt } : {}),
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
      // No default sourceId — source is optional, and there is no fixed
      // enum to default to anymore. A test that cares about a specific
      // source passes `sourceId` in overrides (see the lead-sources fixtures
      // below); everything else is intentionally "Unspecified".
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  });
}

function createFixtureQuotation(
  organizationId: string,
  clientId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.quotation.create({
    data: {
      organizationId,
      clientId,
      quotationNumber: `QT-DASH-${runId}-${uid()}`,
      status: 'DRAFT',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 1000,
      ...overrides,
    },
  });
}

function createFixtureFollowUp(
  organizationId: string,
  clientId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.followUp.create({
    data: {
      organizationId,
      clientId,
      subject: `Fixture Follow-up ${uid()}`,
      type: 'CALL',
      priority: 'MEDIUM',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    },
  });
}

describe('DashboardController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let orgEmpty: { id: string };

  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let emptyOrgAdmin: { id: string; email: string };

  let clientA1: { id: string; companyName: string };
  let clientA2: { id: string };
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
      data: { name: `Dashboard Org A ${runId}`, slug: `dashboard-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Dashboard Org B ${runId}`, slug: `dashboard-test-org-b-${runId}` },
    });
    orgEmpty = await prisma.organization.create({
      data: { name: `Dashboard Org Empty ${runId}`, slug: `dashboard-test-org-empty-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `dash-super-${runId}@test.local`,
      name: 'Dashboard Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `dash-admin-${runId}@test.local`,
      name: 'Dashboard Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `dash-exec-${runId}@test.local`,
      name: 'Dashboard Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    emptyOrgAdmin = await createFixtureUser({
      email: `dash-empty-admin-${runId}@test.local`,
      name: 'Dashboard Empty Org Admin',
      organizationId: orgEmpty.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    clientA1 = await createFixtureClient(orgA.id, `Dash Alpha ${runId}`);
    clientA2 = await createFixtureClient(orgA.id, `Dash Beta ${runId}`);
    clientB = await createFixtureClient(orgB.id, `Dash Org B Client ${runId}`);

    const groupA = await prisma.productGroup.create({
      data: { organizationId: orgA.id, name: `Dash Group ${runId}` },
    });
    await prisma.product.create({
      data: { organizationId: orgA.id, productGroupId: groupA.id, name: `Dash P1 ${runId}`, price: 100 },
    });
    await prisma.product.create({
      data: { organizationId: orgA.id, productGroupId: groupA.id, name: `Dash P2 ${runId}`, price: 200 },
    });

    // --- Org A: 3 open-stage enquiries, 1 WON, 1 LOST -> openEnquiries = 3 ---
    // Real, org-scoped EnquirySource fixtures — there is no fixed enum to
    // reference anymore (see the lead-sources tests below).
    const websiteSource = await prisma.enquirySource.create({
      data: { organizationId: orgA.id, name: 'Website' },
    });
    const referralSource = await prisma.enquirySource.create({
      data: { organizationId: orgA.id, name: 'Referral' },
    });
    const coldCallSource = await prisma.enquirySource.create({
      data: { organizationId: orgA.id, name: 'Cold Call' },
    });
    await createFixtureEnquiry(orgA.id, clientA1.id, { stage: 'NEW', sourceId: websiteSource.id });
    await createFixtureEnquiry(orgA.id, clientA1.id, {
      stage: 'CONTACTED',
      sourceId: referralSource.id,
    });
    await createFixtureEnquiry(orgA.id, clientA2.id, {
      stage: 'FOLLOW_UP_2',
      sourceId: referralSource.id,
    });
    await createFixtureEnquiry(orgA.id, clientA1.id, { stage: 'WON', sourceId: coldCallSource.id });
    await createFixtureEnquiry(orgA.id, clientA2.id, { stage: 'LOST', sourceId: websiteSource.id });

    // --- Recent activity fixtures, explicit timestamps for deterministic order ---
    const t1 = new Date('2025-01-01T00:00:00.000Z');
    const t2 = new Date('2025-01-02T00:00:00.000Z');
    const t3 = new Date('2025-01-03T00:00:00.000Z');
    const t4 = new Date('2025-01-04T00:00:00.000Z');
    await createFixtureClient(orgA.id, `Activity Client ${runId}`, t1);
    await createFixtureEnquiry(orgA.id, clientA1.id, {
      title: `Activity Enquiry ${runId}`,
      createdAt: t2,
    });
    await createFixtureQuotation(orgA.id, clientA1.id, {
      quotationNumber: `QT-ACT-${runId}`,
      createdAt: t3,
    });
    // A still-scheduled follow-up must NOT appear in recent activity.
    await createFixtureFollowUp(orgA.id, clientA1.id, {
      subject: `Not yet completed ${runId}`,
      status: 'SCHEDULED',
    });
    // A completed follow-up, completedAt is the newest of the four fixtures.
    await createFixtureFollowUp(orgA.id, clientA1.id, {
      subject: `Activity Follow-up ${runId}`,
      status: 'COMPLETED',
      outcome: 'Discussed renewal',
      completedAt: t4,
    });

    // --- Org B: distinctive counts, must never leak into Org A responses ---
    for (let i = 0; i < 7; i++) {
      await createFixtureClient(orgB.id, `Org B Client ${i} ${runId}`);
    }
    const partnerSourceB = await prisma.enquirySource.create({
      data: { organizationId: orgB.id, name: 'Partner' },
    });
    await createFixtureEnquiry(orgB.id, clientB.id, { stage: 'NEW', sourceId: partnerSourceB.id });
  }, 60000);

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id, orgEmpty.id];
    await prisma.quotation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.quotationNumberCounter.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.followUp.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.enquiry.deleteMany({ where: { organizationId: { in: orgIds } } });
    // EnquirySource.organizationId is Restrict, not Cascade — must be
    // deleted before the organization itself, same reasoning as every
    // other org-scoped table cleaned up below.
    await prisma.enquirySource.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.product.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.productGroup.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await app.close();
    await prisma.$disconnect();
  }, 60000);

  const ROUTES = [
    '/dashboard/summary',
    '/dashboard/lead-sources',
    '/dashboard/recent-activity',
    '/dashboard/monthly-comparison',
  ];

  // ------------------------------------------------------- authentication

  it('1. rejects every Dashboard route when unauthenticated', async () => {
    for (const route of ROUTES) {
      await request(app.getHttpServer()).get(route).expect(401);
    }
  });

  // -------------------------------------------------------- authorization

  it('2. allows a Super Admin to read every Dashboard route', async () => {
    const cookies = await signIn(superAdmin.email);
    for (const route of ROUTES) {
      await request(app.getHttpServer()).get(route).set('Cookie', cookies).expect(200);
    }
  });

  it('3. allows an Admin to read every Dashboard route', async () => {
    const cookies = await signIn(adminUser.email);
    for (const route of ROUTES) {
      await request(app.getHttpServer()).get(route).set('Cookie', cookies).expect(200);
    }
  });

  it('4. allows a Sales Executive to read every Dashboard route', async () => {
    const cookies = await signIn(salesUser.email);
    for (const route of ROUTES) {
      await request(app.getHttpServer()).get(route).set('Cookie', cookies).expect(200);
    }
  });

  // ------------------------------------------------------------- summary

  it('5. computes totalClients/totalProducts/openEnquiries for Org A', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Cookie', cookies)
      .expect(200);
    // 2 base clients + 1 activity client = 3.
    expect(res.body.totalClients).toBe(3);
    expect(res.body.totalProducts).toBe(2);
    // NEW + CONTACTED + FOLLOW_UP_2 + the extra activity enquiry (default NEW) = 4.
    expect(res.body.openEnquiries).toBe(4);
  });

  it('6. returns a genuine zeroed summary for an organization with no data', async () => {
    const cookies = await signIn(emptyOrgAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body).toEqual({ totalClients: 0, totalProducts: 0, openEnquiries: 0 });
  });

  it('7. never leaks Org B counts into Org A summary', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.totalClients).toBeLessThan(7);
  });

  // -------------------------------------------------------- lead sources

  it('8. zero-fills every organization source, adds an Unspecified bucket, and totals them correctly', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/dashboard/lead-sources')
      .set('Cookie', cookies)
      .expect(200);
    const sources: { id: string | null; name: string; count: number }[] = res.body.sources;
    // Org A's own 3 created sources (Website, Referral, Cold Call) plus the
    // synthetic "Unspecified" bucket — never a fixed global list anymore.
    expect(sources).toHaveLength(4);
    const byName = new Map(sources.map((s) => [s.name, s.count]));
    // Website: the NEW/Website enquiry and the LOST/Website enquiry.
    expect(byName.get('Website')).toBe(2);
    expect(byName.get('Referral')).toBe(2);
    expect(byName.get('Cold Call')).toBe(1);
    // The "Activity Enquiry" fixture has no source override.
    expect(byName.get('Unspecified')).toBe(1);
    expect(res.body.totalLeads).toBe(sources.reduce((s, b) => s + b.count, 0));
    expect(res.body.period.basis).toBe('ENQUIRY_CREATED_AT');
  });

  it('9. rejects an invalid date on lead-sources', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/dashboard/lead-sources?from=not-a-date')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('10. rejects an attempt to inject organizationId as a query parameter', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/dashboard/lead-sources?organizationId=${orgB.id}`)
      .set('Cookie', cookies)
      .expect(400);
  });

  // ------------------------------------------------------- recent activity

  it('11. merges and sorts activity across Client/Enquiry/Quotation/FollowUp, newest first', async () => {
    const cookies = await signIn(superAdmin.email);
    // limit=20 comfortably covers every fixture row seeded so far (3 clients +
    // 6 enquiries + 1 quotation + 1 completed follow-up = 11), so none of the
    // "now"-timestamped base fixtures can push a Jan-2025 marker row out of
    // the result before the ordering assertion below even runs.
    const res = await request(app.getHttpServer())
      .get('/dashboard/recent-activity?limit=20')
      .set('Cookie', cookies)
      .expect(200);
    const activities: { type: string; occurredAt: string }[] = res.body.activities;

    const relevant = activities.filter((a) =>
      [
        `Activity Client ${runId}`,
        `Activity Enquiry ${runId}`,
        `QT-ACT-${runId}`,
        `Activity Follow-up ${runId}`,
      ].some((needle) => JSON.stringify(a).includes(needle)),
    );
    expect(relevant.map((a) => a.type)).toEqual([
      'FOLLOW_UP_COMPLETED',
      'QUOTATION_CREATED',
      'ENQUIRY_CREATED',
      'CLIENT_CREATED',
    ]);
  });

  it('12. never includes a follow-up that has not been completed', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/dashboard/recent-activity?limit=50')
      .set('Cookie', cookies)
      .expect(200);
    const hasScheduled = (res.body.activities as { type: string; subject?: string }[]).some(
      (a) => a.type === 'FOLLOW_UP_COMPLETED' && a.subject === `Not yet completed ${runId}`,
    );
    expect(hasScheduled).toBe(false);
  });

  it('13. respects the limit parameter and rejects an out-of-range value', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/dashboard/recent-activity?limit=2')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.activities).toHaveLength(2);

    await request(app.getHttpServer())
      .get('/dashboard/recent-activity?limit=0')
      .set('Cookie', cookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/dashboard/recent-activity?limit=51')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('14. never leaks Org B activity into Org A recent-activity', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/dashboard/recent-activity?limit=50')
      .set('Cookie', cookies)
      .expect(200);
    const leaked = (res.body.activities as { companyName?: string }[]).some((a) =>
      a.companyName?.startsWith('Org B Client'),
    );
    expect(leaked).toBe(false);
  });

  // ----------------------------------------------------- monthly comparison

  it('15. computes current vs previous calendar-month counts from real rows', async () => {
    const now = new Date();
    const currentMonthDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 12, 0, 0),
    );
    const previousMonthDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12, 0, 0),
    );

    const mcClient = await createFixtureClient(orgA.id, `MC Client ${runId}`);
    await createFixtureEnquiry(orgA.id, mcClient.id, { createdAt: currentMonthDate });
    await createFixtureEnquiry(orgA.id, mcClient.id, {
      createdAt: previousMonthDate,
      stage: 'WON',
    });
    await createFixtureEnquiry(orgA.id, mcClient.id, {
      createdAt: previousMonthDate,
      stage: 'WON',
    });
    await createFixtureFollowUp(orgA.id, mcClient.id, {
      type: 'MEETING',
      createdAt: currentMonthDate,
      scheduledAt: currentMonthDate,
    });
    await createFixtureQuotation(orgA.id, mcClient.id, { createdAt: currentMonthDate });
    await createFixtureQuotation(orgA.id, mcClient.id, { createdAt: currentMonthDate });

    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/dashboard/monthly-comparison')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body.current.leads).toBeGreaterThanOrEqual(1);
    expect(res.body.current.meetings).toBeGreaterThanOrEqual(1);
    expect(res.body.current.quotes).toBeGreaterThanOrEqual(2);
    expect(res.body.previous.wins).toBeGreaterThanOrEqual(2);
  });

  // --------------------------------------------------------------- writes

  it('16. exposes no write routes on /dashboard', async () => {
    const cookies = await signIn(superAdmin.email);
    for (const route of ROUTES) {
      await request(app.getHttpServer()).post(route).set('Cookie', cookies).expect(404);
      await request(app.getHttpServer()).patch(route).set('Cookie', cookies).expect(404);
      await request(app.getHttpServer()).delete(route).set('Cookie', cookies).expect(404);
    }
  });

  // -------------------------------------------------------------------
  // Phase 19 — Sales Executive client ownership
  // -------------------------------------------------------------------

  it('17. Sales Executive dashboard widgets are scoped to their own clients — Products stay organization-wide', async () => {
    const salesCookies = await signIn(salesUser.email);
    const superCookies = await signIn(superAdmin.email);

    const ownClient = await createFixtureClient(orgA.id, `P19 Dash Own Client ${runId}`);
    await prisma.client.update({ where: { id: ownClient.id }, data: { assignedToId: salesUser.id } });
    const otherClient = await createFixtureClient(orgA.id, `P19 Dash Other Client ${runId}`);

    const ownEnquiry = await createFixtureEnquiry(orgA.id, ownClient.id, {
      title: `P19 Dash Own Enquiry ${runId}`,
      stage: 'NEW',
    });
    const otherEnquiry = await createFixtureEnquiry(orgA.id, otherClient.id, {
      title: `P19 Dash Other Enquiry ${runId}`,
      stage: 'NEW',
    });
    await createFixtureQuotation(orgA.id, ownClient.id, {
      quotationNumber: `QT-P19-OWN-${runId}`,
    });
    await createFixtureQuotation(orgA.id, otherClient.id, {
      quotationNumber: `QT-P19-OTHER-${runId}`,
    });
    await createFixtureFollowUp(orgA.id, ownClient.id, {
      subject: `P19 Dash Own Follow-up ${runId}`,
      status: 'COMPLETED',
      outcome: 'Done',
      completedAt: new Date(),
    });
    await createFixtureFollowUp(orgA.id, otherClient.id, {
      subject: `P19 Dash Other Follow-up ${runId}`,
      status: 'COMPLETED',
      outcome: 'Done',
      completedAt: new Date(),
    });

    const [salesSummary, superSummary] = await Promise.all([
      request(app.getHttpServer()).get('/dashboard/summary').set('Cookie', salesCookies).expect(200),
      request(app.getHttpServer()).get('/dashboard/summary').set('Cookie', superCookies).expect(200),
    ]);
    // Sales Executive sees fewer clients/open enquiries than the
    // organization-wide total; totalProducts is identical for both.
    expect(salesSummary.body.totalClients).toBeLessThan(superSummary.body.totalClients);
    expect(salesSummary.body.openEnquiries).toBeLessThan(superSummary.body.openEnquiries);
    expect(salesSummary.body.totalProducts).toBe(superSummary.body.totalProducts);

    const activity = await request(app.getHttpServer())
      .get('/dashboard/recent-activity?limit=50')
      .set('Cookie', salesCookies)
      .expect(200);
    const activityIds: string[] = activity.body.activities.map(
      (a: { clientId?: string; enquiryId?: string; quotationId?: string; followUpId?: string }) =>
        a.clientId ?? a.enquiryId ?? a.quotationId ?? a.followUpId,
    );
    expect(activityIds).toContain(ownClient.id);
    expect(activityIds).toContain(ownEnquiry.id);
    expect(activityIds).not.toContain(otherClient.id);
    expect(activityIds).not.toContain(otherEnquiry.id);

    const [salesLeadSources, superLeadSources] = await Promise.all([
      request(app.getHttpServer()).get('/dashboard/lead-sources').set('Cookie', salesCookies).expect(200),
      request(app.getHttpServer()).get('/dashboard/lead-sources').set('Cookie', superCookies).expect(200),
    ]);
    // ownEnquiry's fixture carries no source override, so it lands in the
    // synthetic "Unspecified" bucket.
    const unspecifiedBucket = salesLeadSources.body.sources.find(
      (s: { name: string }) => s.name === 'Unspecified',
    );
    // The caller's own enquiry contributes to the bucket.
    expect(unspecifiedBucket.count).toBeGreaterThanOrEqual(1);
    // The Sales Executive's total is strictly less than the organization-wide
    // total (same metric, both queried with no period filter), proving the
    // other rep's enquiry did not leak in.
    expect(salesLeadSources.body.totalLeads).toBeLessThan(superLeadSources.body.totalLeads);
  });

  it('18. Admin and Super Admin retain organization-wide dashboard behavior', async () => {
    const adminCookies = await signIn(adminUser.email);
    const superCookies = await signIn(superAdmin.email);

    const [adminSummary, superSummary] = await Promise.all([
      request(app.getHttpServer()).get('/dashboard/summary').set('Cookie', adminCookies).expect(200),
      request(app.getHttpServer()).get('/dashboard/summary').set('Cookie', superCookies).expect(200),
    ]);
    expect(adminSummary.body).toEqual(superSummary.body);
  });
});
