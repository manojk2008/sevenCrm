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

async function createFixtureClient(
  organizationId: string,
  options: { companyName?: string; assignedToId?: string } = {},
) {
  return prisma.client.create({
    data: {
      organizationId,
      companyName: options.companyName ?? `Enquiry Client ${uid()}`,
      industry: 'IT Services',
      email: `enq-client-${uid()}@test.local`,
      phone: '+919876500000',
      addressLine1: '1 Pipeline Road',
      addressCity: 'Mumbai',
      addressState: 'Maharashtra',
      addressPincode: '400001',
      assignedToId: options.assignedToId ?? null,
    },
  });
}

describe('EnquiriesController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let salesUserB: { id: string; email: string };
  let otherOrgAdmin: { id: string; email: string };
  let clientA: { id: string; companyName: string };
  let clientB: { id: string; companyName: string };
  let clientOwnedBySales: { id: string; companyName: string };

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      title: `Enquiry ${uid()}`,
      clientId: clientA.id,
      expectedRevenue: 150000.5,
      probability: 40,
      priority: 'HIGH',
      // No default sourceId — source is optional, and the global
      // forbidNonWhitelisted pipe would reject an unknown `source` key
      // outright (there is no such DTO field anymore). Tests that care
      // about a specific source pass `sourceId` in overrides.
      expectedCloseDate: '2026-12-31T00:00:00.000Z',
      ...overrides,
    };
  }

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
    // Mirrors src/main.ts's bootstrap() exactly — see clients.e2e-spec.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    orgA = await prisma.organization.create({
      data: { name: `Enq Org A ${runId}`, slug: `enquiries-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Enq Org B ${runId}`, slug: `enquiries-test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `enq-super-${runId}@test.local`,
      name: 'Enq Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `enq-admin-${runId}@test.local`,
      name: 'Enq Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `enq-sales-${runId}@test.local`,
      name: 'Enq Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    salesUserB = await createFixtureUser({
      email: `enq-sales-b-${runId}@test.local`,
      name: 'Enq Sales Executive B',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgAdmin = await createFixtureUser({
      email: `enq-other-admin-${runId}@test.local`,
      name: 'Enq Other Org Admin',
      organizationId: orgB.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    clientA = await createFixtureClient(orgA.id);
    clientB = await createFixtureClient(orgB.id);
    clientOwnedBySales = await createFixtureClient(orgA.id, { assignedToId: salesUser.id });
  }, 30000);

  afterAll(async () => {
    // Enquiry.clientId and .organizationId are both onDelete: Restrict, so
    // enquiries must be removed before clients, and clients before orgs.
    await prisma.enquiry.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  // ---------------------------------------------------------------- auth

  it('1. rejects GET /enquiries when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/enquiries').expect(401);
  });

  it('2. rejects POST /enquiries when unauthenticated', async () => {
    await request(app.getHttpServer()).post('/enquiries').send(basePayload()).expect(401);
  });

  // -------------------------------------------------------------- create

  it('3. allows a Super Admin to create an enquiry scoped to their org', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    expect(res.body.organizationId).toBe(orgA.id);
    expect(res.body.clientId).toBe(clientA.id);
    expect(res.body.stage).toBe('NEW');
    expect(res.body.lostReason).toBeNull();
    expect(res.body.assignedTo).toBeNull();
    expect(res.body.tags).toEqual([]);
  });

  it('4. role boundaries: Admin and Sales Executive can both create', async () => {
    const adminCookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', adminCookies)
      .send(basePayload())
      .expect(201);

    // Phase 19: a Sales Executive can only create against a client assigned
    // to themselves — basePayload()'s default clientId (clientA) is
    // unassigned, so clientOwnedBySales is used here instead.
    const salesCookies = await signIn(salesUser.email);
    const res = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: clientOwnedBySales.id }))
      .expect(201);
    expect(res.body.organizationId).toBe(orgA.id);
  });

  it('5. role boundaries: Sales Executive can read, update and change stage', async () => {
    const adminCookies = await signIn(adminUser.email);
    // Phase 19: created against clientOwnedBySales so the Sales Executive
    // below is actually authorized to reach it (client ownership is the
    // visibility boundary, not who created the enquiry).
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: clientOwnedBySales.id }))
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .get(`/enquiries/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ notes: 'touched by sales exec' })
      .expect(200);
    // Stage changes are ordinary pipeline work, unlike Clients' admin-only
    // status change — a Sales Executive moving a kanban card must succeed.
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', salesCookies)
      .send({ stage: 'CONTACTED' })
      .expect(200);
  });

  it('6. preserves decimal precision on expectedRevenue', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ expectedRevenue: 1234567.89 }))
      .expect(201);
    expect(res.body.expectedRevenue).toBe(1234567.89);

    const row = await prisma.enquiry.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(Number(row.expectedRevenue)).toBe(1234567.89);
  });

  // ---------------------------------------------------------- validation

  it('7. rejects a missing title', async () => {
    const cookies = await signIn(superAdmin.email);
    const payload = basePayload();
    delete (payload as Record<string, unknown>).title;
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(payload)
      .expect(400);
  });

  it('8. rejects probability outside 0-100 and non-integer probability', async () => {
    const cookies = await signIn(superAdmin.email);
    for (const probability of [-1, 101, 40.5]) {
      await request(app.getHttpServer())
        .post('/enquiries')
        .set('Cookie', cookies)
        .send(basePayload({ probability }))
        .expect(400);
    }
    // boundaries are valid
    for (const probability of [0, 100]) {
      await request(app.getHttpServer())
        .post('/enquiries')
        .set('Cookie', cookies)
        .send(basePayload({ probability }))
        .expect(201);
    }
  }, 40000);

  it('9. rejects an invalid priority and a sourceId that does not exist', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ priority: 'CRITICAL' }))
      .expect(400);
    // sourceId is no longer a fixed enum — an unknown id is rejected by
    // EnquiriesService.assertSourceInOrg, not by DTO enum validation.
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ sourceId: 'nonexistent-source-id' }))
      .expect(400);
  });

  it('10. rejects a missing/invalid expectedCloseDate and >2dp expectedRevenue', async () => {
    const cookies = await signIn(superAdmin.email);
    const noDate = basePayload();
    delete (noDate as Record<string, unknown>).expectedCloseDate;
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(noDate)
      .expect(400);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ expectedCloseDate: 'not-a-date' }))
      .expect(400);
    // Decimal(14,2) cannot store 3 decimal places — rejected, not rounded.
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ expectedRevenue: 100.123 }))
      .expect(400);
  });

  it('11. rejects unknown DTO fields and a body-supplied organizationId', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ notARealField: 'nope' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ organizationId: orgB.id }))
      .expect(400);
  });

  it('12. rejects creating directly in LOST without a lostReason', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ stage: 'LOST' }))
      .expect(400);

    const ok = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ stage: 'LOST', lostReason: 'Lost on price' }))
      .expect(201);
    expect(ok.body.stage).toBe('LOST');
    expect(ok.body.lostReason).toBe('Lost on price');
  });

  // ------------------------------------------------- relational validity

  it('13. rejects a non-existent clientId', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ clientId: 'clnonexistent000000000000' }))
      .expect(400);
  });

  it('14. rejects a clientId belonging to another organization', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ clientId: clientB.id }))
      .expect(400);

    // and the enquiry was genuinely not written
    const leaked = await prisma.enquiry.findFirst({ where: { clientId: clientB.id } });
    expect(leaked).toBeNull();
  });

  it('15. rejects an assignedToId from another organization, accepts one from the caller org', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ assignedToId: otherOrgAdmin.id }))
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ assignedToId: salesUser.id }))
      .expect(201);
    expect(created.body.assignedTo).toEqual({
      id: salesUser.id,
      name: 'Enq Sales Executive',
      email: salesUser.email,
    });

    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ assignedToId: otherOrgAdmin.id })
      .expect(400);
  });

  // ---------------------------------------------------------- list/query

  it('16. GET /enquiries returns only the caller organization records', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookiesB)
      .send({ ...basePayload(), clientId: clientB.id })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    const listRes = await request(app.getHttpServer())
      .get('/enquiries?pageSize=100')
      .set('Cookie', cookiesA)
      .expect(200);

    const ids: string[] = listRes.body.data.map((e: { id: string }) => e.id);
    expect(ids).not.toContain(orgBEnquiry.body.id);
    for (const enquiry of listRes.body.data) {
      expect(enquiry.organizationId).toBe(orgA.id);
    }
  });

  it('17. returns a paginated envelope and honours page/pageSize', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/enquiries?page=1&pageSize=2')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 2,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );
    expect(res.body.data.length).toBeLessThanOrEqual(2);

    const page2 = await request(app.getHttpServer())
      .get('/enquiries?page=2&pageSize=2')
      .set('Cookie', cookies)
      .expect(200);
    const page1Ids = res.body.data.map((e: { id: string }) => e.id);
    const page2Ids = page2.body.data.map((e: { id: string }) => e.id);
    expect(page1Ids.filter((id: string) => page2Ids.includes(id))).toHaveLength(0);
  });

  it('18. caps pageSize at 100, matching Clients', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/enquiries?pageSize=101')
      .set('Cookie', cookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/enquiries?pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
  });

  it('19. search matches enquiry title and client company name', async () => {
    const cookies = await signIn(superAdmin.email);
    const marker = `Zeta${uid()}`;
    const namedClient = await createFixtureClient(orgA.id, { companyName: `SearchCo${marker}` });

    const byTitle = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ title: `Renewal ${marker}` }))
      .expect(201);
    const byClient = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ clientId: namedClient.id, title: 'Unrelated title' }))
      .expect(201);

    const titleHit = await request(app.getHttpServer())
      .get(`/enquiries?search=${marker}&pageSize=100`)
      .set('Cookie', cookies)
      .expect(200);
    const hitIds = titleHit.body.data.map((e: { id: string }) => e.id);
    expect(hitIds).toContain(byTitle.body.id);
    expect(hitIds).toContain(byClient.body.id);

    // case-insensitive
    const lower = await request(app.getHttpServer())
      .get(`/enquiries?search=${marker.toLowerCase()}&pageSize=100`)
      .set('Cookie', cookies)
      .expect(200);
    expect(lower.body.data.map((e: { id: string }) => e.id)).toContain(byTitle.body.id);
  }, 40000);

  it('20. filters by stage', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'NEGOTIATION' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/enquiries?stage=NEGOTIATION&pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.data.map((e: { id: string }) => e.id)).toContain(created.body.id);
    for (const enquiry of res.body.data) {
      expect(enquiry.stage).toBe('NEGOTIATION');
    }
  });

  it('21. filters by priority and by assignedToId', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ priority: 'URGENT', assignedToId: adminUser.id }))
      .expect(201);

    const byPriority = await request(app.getHttpServer())
      .get('/enquiries?priority=URGENT&pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    expect(byPriority.body.data.map((e: { id: string }) => e.id)).toContain(created.body.id);
    for (const enquiry of byPriority.body.data) {
      expect(enquiry.priority).toBe('URGENT');
    }

    const byAssignee = await request(app.getHttpServer())
      .get(`/enquiries?assignedToId=${adminUser.id}&pageSize=100`)
      .set('Cookie', cookies)
      .expect(200);
    expect(byAssignee.body.data.map((e: { id: string }) => e.id)).toContain(created.body.id);
    for (const enquiry of byAssignee.body.data) {
      expect(enquiry.assignedTo.id).toBe(adminUser.id);
    }
  });

  it('22. rejects an invalid stage/priority filter value', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/enquiries?stage=NOT_A_STAGE')
      .set('Cookie', cookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/enquiries?priority=NOT_A_PRIORITY')
      .set('Cookie', cookies)
      .expect(400);
  });

  // ------------------------------------------------------------ get byId

  it('23. GET /enquiries/:id returns the serialized shape with resolved relations', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ assignedToId: salesUser.id, tags: ['renewal'] }))
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);

    // clientName/clientCompany come from the Client relation, not a column.
    expect(res.body.clientName).toBe(clientA.companyName);
    expect(res.body.clientCompany).toBe(clientA.companyName);
    expect(res.body.assignedTo).toEqual({
      id: salesUser.id,
      name: 'Enq Sales Executive',
      email: salesUser.email,
    });
    expect(typeof res.body.expectedRevenue).toBe('number');
    expect(res.body.tags).toEqual(['renewal']);
    // raw Prisma internals must not leak through
    expect(res.body.client).toBeUndefined();
    expect(res.body.assignedToId).toBeUndefined();
  });

  it('24. GET /enquiries/:id for another organization returns 404, not 403', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookiesB)
      .send({ ...basePayload(), clientId: clientB.id })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/enquiries/${orgBEnquiry.body.id}`)
      .set('Cookie', cookiesA)
      .expect(404);
  });

  it('25. GET /enquiries/:id for an unknown id returns 404', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/enquiries/enqnonexistent0000000000')
      .set('Cookie', cookies)
      .expect(404);
  });

  // ------------------------------------------------------------- update

  it('26. PATCH /enquiries/:id updates editable fields', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ title: 'Renamed Enquiry', probability: 75, priority: 'LOW' })
      .expect(200);

    expect(updated.body.id).toBe(created.body.id);
    expect(updated.body.title).toBe('Renamed Enquiry');
    expect(updated.body.probability).toBe(75);
    expect(updated.body.priority).toBe('LOW');
  });

  it('27. PATCH /enquiries/:id cannot change id, organizationId, clientId or timestamps', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    for (const body of [
      { organizationId: orgB.id },
      { id: 'hijacked-id' },
      { clientId: clientB.id },
      { createdAt: '2000-01-01T00:00:00.000Z' },
      { updatedAt: '2000-01-01T00:00:00.000Z' },
    ]) {
      await request(app.getHttpServer())
        .patch(`/enquiries/${created.body.id}`)
        .set('Cookie', cookies)
        .send(body)
        .expect(400);
    }

    const unchanged = await prisma.enquiry.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(unchanged.organizationId).toBe(orgA.id);
    expect(unchanged.clientId).toBe(clientA.id);
  });

  it('28. PATCH /enquiries/:id for another organization returns 404 and does not mutate', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookiesB)
      .send({ ...basePayload(), clientId: clientB.id, title: 'Org B Enquiry' })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch(`/enquiries/${orgBEnquiry.body.id}`)
      .set('Cookie', cookiesA)
      .send({ title: 'Hijacked' })
      .expect(404);

    const intact = await prisma.enquiry.findUniqueOrThrow({ where: { id: orgBEnquiry.body.id } });
    expect(intact.title).toBe('Org B Enquiry');
  });

  // ------------------------------------------------------ stage handling

  it('29. PATCH /enquiries/:id/stage moves through non-LOST stages', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    for (const stage of ['CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION', 'WON']) {
      const res = await request(app.getHttpServer())
        .patch(`/enquiries/${created.body.id}/stage`)
        .set('Cookie', cookies)
        .send({ stage })
        .expect(200);
      expect(res.body.stage).toBe(stage);
      expect(res.body.lostReason).toBeNull();
    }
  }, 40000);

  it('30. moving to LOST requires a non-blank lostReason', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    // missing entirely
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'LOST' })
      .expect(400);
    // blank / whitespace-only
    for (const lostReason of ['', '   ']) {
      await request(app.getHttpServer())
        .patch(`/enquiries/${created.body.id}/stage`)
        .set('Cookie', cookies)
        .send({ stage: 'LOST', lostReason })
        .expect(400);
    }

    // stage did not change on any rejected attempt
    const stillOpen = await prisma.enquiry.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stillOpen.stage).toBe('NEW');

    const lost = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'LOST', lostReason: 'Chose a competitor' })
      .expect(200);
    expect(lost.body.stage).toBe('LOST');
    expect(lost.body.lostReason).toBe('Chose a competitor');
  }, 40000);

  it('31. moving away from LOST preserves the existing lostReason and never fabricates one', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'LOST', lostReason: 'Budget frozen' })
      .expect(200);

    // reopening does not require a lostReason, and keeps the prior one as history
    const reopened = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'NEGOTIATION' })
      .expect(200);
    expect(reopened.body.stage).toBe('NEGOTIATION');
    expect(reopened.body.lostReason).toBe('Budget frozen');

    // a never-lost enquiry still has a null lostReason — none was invented
    const fresh = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    const moved = await request(app.getHttpServer())
      .patch(`/enquiries/${fresh.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'WON' })
      .expect(200);
    expect(moved.body.lostReason).toBeNull();
  }, 40000);

  it('32. rejects an invalid stage value and unknown fields on the stage endpoint', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'ARCHIVED' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'WON', somethingElse: true })
      .expect(400);
  });

  it('33. PATCH /enquiries/:id/stage for another organization returns 404', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookiesB)
      .send({ ...basePayload(), clientId: clientB.id })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch(`/enquiries/${orgBEnquiry.body.id}/stage`)
      .set('Cookie', cookiesA)
      .send({ stage: 'WON' })
      .expect(404);
  });

  it('34. there is no hard-delete route for enquiries', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(404);

    const stillThere = await prisma.enquiry.findUnique({ where: { id: created.body.id } });
    expect(stillThere).not.toBeNull();
  });

  // -------------------------------------------------------------------
  // Phase 19 — Sales Executive client ownership
  // -------------------------------------------------------------------

  it('35. Sales Executive list shows only enquiries whose client they own', async () => {
    const adminCookies = await signIn(adminUser.email);
    const salesCookies = await signIn(salesUser.email);
    const otherRepClient = await createFixtureClient(orgA.id, { assignedToId: salesUserB.id });
    const unassignedClient = await createFixtureClient(orgA.id);

    const ownEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: clientOwnedBySales.id }))
      .expect(201);
    const otherRepEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: otherRepClient.id }))
      .expect(201);
    const unassignedEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: unassignedClient.id }))
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/enquiries?pageSize=100')
      .set('Cookie', salesCookies)
      .expect(200);
    const ids: string[] = listRes.body.data.map((e: { id: string }) => e.id);
    expect(ids).toContain(ownEnquiry.body.id);
    expect(ids).not.toContain(otherRepEnquiry.body.id);
    expect(ids).not.toContain(unassignedEnquiry.body.id);
  });

  it('36. Sales Executive detail 404s on another-client and unassigned-client enquiries', async () => {
    const adminCookies = await signIn(adminUser.email);
    const salesCookies = await signIn(salesUser.email);
    const otherRepClient = await createFixtureClient(orgA.id, { assignedToId: salesUserB.id });
    const unassignedClient = await createFixtureClient(orgA.id);

    const otherRepEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: otherRepClient.id }))
      .expect(201);
    const unassignedEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: unassignedClient.id }))
      .expect(201);

    await request(app.getHttpServer())
      .get(`/enquiries/${otherRepEnquiry.body.id}`)
      .set('Cookie', salesCookies)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/enquiries/${unassignedEnquiry.body.id}`)
      .set('Cookie', salesCookies)
      .expect(404);
  });

  it('37. Sales Executive create against another user client is rejected (400)', async () => {
    const salesCookies = await signIn(salesUser.email);
    const otherRepClient = await createFixtureClient(orgA.id, { assignedToId: salesUserB.id });
    const unassignedClient = await createFixtureClient(orgA.id);

    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: otherRepClient.id }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: unassignedClient.id }))
      .expect(400);
  });

  it('38. Sales Executive create against own client works, and Enquiry.assignedToId remains freely settable', async () => {
    const salesCookies = await signIn(salesUser.email);
    // assignedToId is a distinct, secondary field — client ownership alone
    // governs visibility, so it may still be set to any org user (even a
    // colleague) without affecting who can see this enquiry going forward.
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: clientOwnedBySales.id, assignedToId: salesUserB.id }))
      .expect(201);
    expect(created.body.assignedTo.id).toBe(salesUserB.id);

    // Still visible to the owning Sales Executive despite assignedToId
    // pointing at a colleague — client ownership is authoritative.
    await request(app.getHttpServer())
      .get(`/enquiries/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(200);
  });

  it('39. Admin and Super Admin retain organization-wide enquiry visibility', async () => {
    const salesCookies = await signIn(salesUser.email);
    const adminCookies = await signIn(adminUser.email);
    const superCookies = await signIn(superAdmin.email);

    const ownEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: clientOwnedBySales.id }))
      .expect(201);

    await request(app.getHttpServer())
      .get(`/enquiries/${ownEnquiry.body.id}`)
      .set('Cookie', adminCookies)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get('/enquiries?pageSize=100')
      .set('Cookie', superCookies)
      .expect(200);
    const ids: string[] = listRes.body.data.map((e: { id: string }) => e.id);
    expect(ids).toContain(ownEnquiry.body.id);
  });
});
