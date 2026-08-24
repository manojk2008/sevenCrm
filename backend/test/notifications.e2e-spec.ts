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

const ALLOWED_TYPES = ['CLIENT_CREATED', 'ENQUIRY_CREATED', 'QUOTATION_CREATED', 'FOLLOW_UP_COMPLETED'];
const APPROVED_FIELDS = ['id', 'type', 'title', 'description', 'timestamp', 'href'].sort();

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

function createFixtureClient(organizationId: string, companyName?: string, createdAt?: Date) {
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
      source: 'WEBSITE',
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
      quotationNumber: `QT-NOTIF-${runId}-${uid()}`,
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

describe('NotificationsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let orgEmpty: { id: string };

  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let emptyOrgAdmin: { id: string; email: string };

  let clientA: { id: string; companyName: string };
  let clientB: { id: string };

  let activityFixtureIds: {
    activityClientId: string;
    activityEnquiryId: string;
    activityQuotationId: string;
    activityFollowUpId: string;
  };

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
      data: { name: `Notif Org A ${runId}`, slug: `notif-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Notif Org B ${runId}`, slug: `notif-test-org-b-${runId}` },
    });
    orgEmpty = await prisma.organization.create({
      data: { name: `Notif Org Empty ${runId}`, slug: `notif-test-org-empty-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `notif-super-${runId}@test.local`,
      name: 'Notif Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `notif-admin-${runId}@test.local`,
      name: 'Notif Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `notif-exec-${runId}@test.local`,
      name: 'Notif Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    emptyOrgAdmin = await createFixtureUser({
      email: `notif-empty-admin-${runId}@test.local`,
      name: 'Notif Empty Org Admin',
      organizationId: orgEmpty.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    clientA = await createFixtureClient(orgA.id, `Notif Alpha ${runId}`);
    clientB = await createFixtureClient(orgB.id, `Notif Org B Client ${runId}`);

    // Deterministic, well-separated timestamps for exact ordering assertions.
    const t1 = new Date('2025-02-01T00:00:00.000Z');
    const t2 = new Date('2025-02-02T00:00:00.000Z');
    const t3 = new Date('2025-02-03T00:00:00.000Z');
    const t4 = new Date('2025-02-04T00:00:00.000Z');

    const activityClient = await createFixtureClient(orgA.id, `Notif Activity Client ${runId}`, t1);
    const activityEnquiry = await createFixtureEnquiry(orgA.id, clientA.id, {
      title: `Notif Activity Enquiry ${runId}`,
      createdAt: t2,
    });
    const activityQuotation = await createFixtureQuotation(orgA.id, clientA.id, {
      quotationNumber: `QT-NOTIF-ACT-${runId}`,
      createdAt: t3,
    });
    const activityFollowUp = await createFixtureFollowUp(orgA.id, clientA.id, {
      subject: `Notif Activity Follow-up ${runId}`,
      status: 'COMPLETED',
      outcome: 'Discussed renewal',
      completedAt: t4,
    });
    // A still-scheduled follow-up must never appear (no completedAt).
    await createFixtureFollowUp(orgA.id, clientA.id, {
      subject: `Notif Not Completed ${runId}`,
      status: 'SCHEDULED',
    });

    // Org B: distinctive, must never leak into Org A responses.
    await createFixtureClient(orgB.id, `Notif Org B Only Client ${runId}`);
    await createFixtureEnquiry(orgB.id, clientB.id, { title: `Notif Org B Only Enquiry ${runId}` });

    activityFixtureIds = {
      activityClientId: activityClient.id,
      activityEnquiryId: activityEnquiry.id,
      activityQuotationId: activityQuotation.id,
      activityFollowUpId: activityFollowUp.id,
    };
  }, 60000);

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id, orgEmpty.id];
    await prisma.quotation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.quotationNumberCounter.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.followUp.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.enquiry.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await app.close();
    await prisma.$disconnect();
  }, 60000);

  // ------------------------------------------------------- authentication

  it('1. rejects GET /notifications when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
  });

  // -------------------------------------------------------- authorization

  it('2. allows a Super Admin to read notifications', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer()).get('/notifications').set('Cookie', cookies).expect(200);
  });

  it('3. allows an Admin to read notifications', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer()).get('/notifications').set('Cookie', cookies).expect(200);
  });

  it('4. allows a Sales Executive to read notifications', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer()).get('/notifications').set('Cookie', cookies).expect(200);
  });

  // ------------------------------------------------------- tenant isolation

  it('5. never leaks Org B events into Org A notifications', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/notifications?limit=50')
      .set('Cookie', cookies)
      .expect(200);
    const leaked = (res.body.notifications as { description: string }[]).some((n) =>
      n.description.includes('Notif Org B'),
    );
    expect(leaked).toBe(false);
  });

  it('6. rejects an attempt to inject organizationId as a query parameter', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/notifications?organizationId=${orgB.id}`)
      .set('Cookie', cookies)
      .expect(400);
  });

  // ------------------------------------------------------------- ordering

  it('7. orders notifications newest-first, deterministically', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/notifications?limit=20')
      .set('Cookie', cookies)
      .expect(200);
    const fixtures = activityFixtureIds;
    const relevant = (res.body.notifications as { type: string; id: string }[]).filter((n) =>
      [
        `client-created:${fixtures.activityClientId}`,
        `enquiry-created:${fixtures.activityEnquiryId}`,
        `quotation-created:${fixtures.activityQuotationId}`,
        `follow-up-completed:${fixtures.activityFollowUpId}`,
      ].includes(n.id),
    );
    expect(relevant.map((n) => n.type)).toEqual([
      'FOLLOW_UP_COMPLETED',
      'QUOTATION_CREATED',
      'ENQUIRY_CREATED',
      'CLIENT_CREATED',
    ]);

    // Deterministic across repeated calls with the same data.
    const res2 = await request(app.getHttpServer())
      .get('/notifications?limit=20')
      .set('Cookie', cookies)
      .expect(200);
    expect(res2.body.notifications.map((n: { id: string }) => n.id)).toEqual(
      res.body.notifications.map((n: { id: string }) => n.id),
    );
  });

  // --------------------------------------------------------- real content

  it('8. real event content: title/description/href match the underlying record', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/notifications?limit=20')
      .set('Cookie', cookies)
      .expect(200);
    const fixtures = activityFixtureIds;
    const notifications: { id: string; title: string; description: string; href: string }[] =
      res.body.notifications;

    const clientNotif = notifications.find((n) => n.id === `client-created:${fixtures.activityClientId}`);
    expect(clientNotif?.title).toBe('New Client');
    expect(clientNotif?.description).toContain(`Notif Activity Client ${runId}`);
    expect(clientNotif?.href).toBe(`/clients/${fixtures.activityClientId}`);

    const quotationNotif = notifications.find(
      (n) => n.id === `quotation-created:${fixtures.activityQuotationId}`,
    );
    expect(quotationNotif?.description).toContain(`QT-NOTIF-ACT-${runId}`);
    expect(quotationNotif?.href).toBe(`/quotations/${fixtures.activityQuotationId}`);

    const followUpNotif = notifications.find(
      (n) => n.id === `follow-up-completed:${fixtures.activityFollowUpId}`,
    );
    expect(followUpNotif?.description).toContain(`Notif Activity Follow-up ${runId}`);
    expect(followUpNotif?.href).toBe('/follow-ups');

    // The still-scheduled follow-up must never surface as a notification.
    const hasScheduled = notifications.some((n) => n.description.includes('Notif Not Completed'));
    expect(hasScheduled).toBe(false);
  });

  // ----------------------------------------------------- deterministic ids

  it('9. event ids are deterministic (type + underlying record id), never random', async () => {
    const cookies = await signIn(superAdmin.email);
    const fixtures = activityFixtureIds;
    const res = await request(app.getHttpServer())
      .get('/notifications?limit=20')
      .set('Cookie', cookies)
      .expect(200);
    const ids: string[] = res.body.notifications.map((n: { id: string }) => n.id);
    expect(ids).toContain(`client-created:${fixtures.activityClientId}`);
    expect(ids).toContain(`enquiry-created:${fixtures.activityEnquiryId}`);
    expect(ids).toContain(`quotation-created:${fixtures.activityQuotationId}`);
    expect(ids).toContain(`follow-up-completed:${fixtures.activityFollowUpId}`);
    // No duplicate ids in a single response.
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ------------------------------------------------------- event vocabulary

  it('10. every notification uses only the approved event vocabulary', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/notifications?limit=50')
      .set('Cookie', cookies)
      .expect(200);
    const types: string[] = res.body.notifications.map((n: { type: string }) => n.type);
    for (const type of types) {
      expect(ALLOWED_TYPES).toContain(type);
    }
  });

  it('15. every notification exposes only the approved SafeNotification fields', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/notifications?limit=50')
      .set('Cookie', cookies)
      .expect(200);
    const notifications: Record<string, unknown>[] = res.body.notifications;
    expect(notifications.length).toBeGreaterThan(0);
    for (const notif of notifications) {
      expect(Object.keys(notif).sort()).toEqual(APPROVED_FIELDS);
    }
  });

  // ----------------------------------------------------------- empty state

  it('11. returns a genuine empty feed for an organization with no events', async () => {
    const cookies = await signIn(emptyOrgAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body).toEqual({ notifications: [] });
  });

  // -------------------------------------------------------------- limit

  it('12. rejects a limit of 0', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/notifications?limit=0')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('13. rejects a limit above 50 and respects a valid limit', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/notifications?limit=51')
      .set('Cookie', cookies)
      .expect(400);

    const res = await request(app.getHttpServer())
      .get('/notifications?limit=2')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.notifications).toHaveLength(2);
  });

  // --------------------------------------------------------------- writes

  it('14. exposes no write routes on /notifications', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer()).post('/notifications').set('Cookie', cookies).expect(404);
    await request(app.getHttpServer()).patch('/notifications').set('Cookie', cookies).expect(404);
    await request(app.getHttpServer()).delete('/notifications').set('Cookie', cookies).expect(404);
    await request(app.getHttpServer())
      .patch('/notifications/read')
      .set('Cookie', cookies)
      .expect(404);
  });
});
