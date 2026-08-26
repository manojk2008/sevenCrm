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

interface AuditLogListItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: { id: string; name: string; email: string } | null;
  entityLabel: string | null;
  createdAt: string;
}

interface AuditLogDetail extends AuditLogListItem {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface AuditLogListResponse {
  data: AuditLogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

describe('AuditLogsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let otherSalesUser: { id: string; email: string };
  let otherOrgUser: { id: string; email: string };

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

  async function listAuditLogs(
    cookies: string[],
    qs = '',
  ): Promise<AuditLogListResponse> {
    const res = await request(app.getHttpServer())
      .get(`/audit-logs${qs}`)
      .set('Cookie', cookies)
      .expect(200);
    return res.body as AuditLogListResponse;
  }

  /**
   * The audit write runs fully decoupled from the primary mutation's HTTP
   * response (see audit.extension.ts) — it is no longer guaranteed to exist
   * the instant the mutating request returns, only "soon after". Polls
   * briefly rather than assuming synchronous consistency.
   */
  async function findAuditLogFor(
    cookies: string[],
    entityType: string,
    entityId: string,
    action?: string,
  ): Promise<AuditLogListItem> {
    const qs = `?entityType=${entityType}&entityId=${entityId}${action ? `&action=${action}` : ''}&pageSize=100`;
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = await listAuditLogs(cookies, qs);
      const match = result.data.find((row) =>
        action ? row.action === action : true,
      );
      if (match) return match;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(
      `No audit log found for ${entityType}/${entityId}${action ? `/${action}` : ''}`,
    );
  }

  async function getAuditLogDetail(cookies: string[], id: string) {
    const res = await request(app.getHttpServer())
      .get(`/audit-logs/${id}`)
      .set('Cookie', cookies)
      .expect(200);
    return res.body as AuditLogDetail;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    orgA = await prisma.organization.create({
      data: {
        name: `Audit Test Org A ${runId}`,
        slug: `audit-test-org-a-${runId}`,
      },
    });
    orgB = await prisma.organization.create({
      data: {
        name: `Audit Test Org B ${runId}`,
        slug: `audit-test-org-b-${runId}`,
      },
    });

    superAdmin = await createFixtureUser({
      email: `audit-super-${runId}@test.local`,
      name: 'Audit Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `audit-admin-${runId}@test.local`,
      name: 'Audit Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `audit-sales-${runId}@test.local`,
      name: 'Audit Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherSalesUser = await createFixtureUser({
      email: `audit-sales-other-${runId}@test.local`,
      name: 'Other Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgUser = await createFixtureUser({
      email: `audit-otherorg-${runId}@test.local`,
      name: 'Other Org Super Admin',
      organizationId: orgB.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
  }, 30000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.task.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.client.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.user.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  // -------------------------------------------------------------------
  // AUTH
  // -------------------------------------------------------------------

  it('1. rejects unauthenticated GET /audit-logs with 401', async () => {
    await request(app.getHttpServer()).get('/audit-logs').expect(401);
  });

  it('2. rejects unauthenticated GET /audit-logs/:id with 401', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs/nonexistent')
      .expect(401);
  });

  // -------------------------------------------------------------------
  // IMMUTABLE / GET-ONLY API
  // -------------------------------------------------------------------

  it('3. there is no POST /audit-logs route', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/audit-logs')
      .set('Cookie', cookies)
      .send({})
      .expect(404);
  });

  it('4. there is no PATCH /audit-logs/:id route', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/audit-logs/whatever')
      .set('Cookie', cookies)
      .send({ action: 'DELETE' })
      .expect(404);
  });

  it('5. there is no DELETE /audit-logs/:id route', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .delete('/audit-logs/whatever')
      .set('Cookie', cookies)
      .expect(404);
  });

  // -------------------------------------------------------------------
  // RBAC — every role can read the endpoint, visibility differs (below)
  // -------------------------------------------------------------------

  it('6. SUPER_ADMIN can list audit logs', async () => {
    const cookies = await signIn(superAdmin.email);
    await listAuditLogs(cookies);
  });

  it('7. ADMIN can list audit logs', async () => {
    const cookies = await signIn(adminUser.email);
    await listAuditLogs(cookies);
  });

  it('8. SALES_EXECUTIVE can list audit logs', async () => {
    const cookies = await signIn(salesUser.email);
    await listAuditLogs(cookies);
  });

  // -------------------------------------------------------------------
  // CREATE / UPDATE / STATUS_CHANGE generation (Task)
  // -------------------------------------------------------------------

  it('9. creating a Task records a CREATE audit entry with the whitelisted after-snapshot', async () => {
    const cookies = await signIn(superAdmin.email);
    const title = `Audited task ${runId}-create`;
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title, priority: 'HIGH' })
      .expect(201);

    const entry = await findAuditLogFor(
      cookies,
      'TASK',
      created.body.id,
      'CREATE',
    );
    expect(entry.entityLabel).toBe(title);
    expect(entry.actor).toEqual({
      id: superAdmin.id,
      name: 'Audit Super Admin',
      email: superAdmin.email,
    });

    const detail = await getAuditLogDetail(cookies, entry.id);
    expect(detail.before).toBeNull();
    expect(detail.after).toMatchObject({
      title,
      priority: 'HIGH',
      completed: false,
    });
    expect(Object.keys(detail.after ?? {}).sort()).toEqual(
      [
        'title',
        'dueDate',
        'priority',
        'completed',
        'completedAt',
        'assignedToId',
      ].sort(),
    );
  });

  it('10. updating a Task (non-status field) records an UPDATE entry with correct before/after', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: `Before rename ${runId}` })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ title: `After rename ${runId}` })
      .expect(200);

    const entry = await findAuditLogFor(
      cookies,
      'TASK',
      created.body.id,
      'UPDATE',
    );
    const detail = await getAuditLogDetail(cookies, entry.id);
    expect(detail.before?.title).toBe(`Before rename ${runId}`);
    expect(detail.after?.title).toBe(`After rename ${runId}`);
  });

  it('11. completing a Task (status endpoint) records a STATUS_CHANGE entry, not UPDATE', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: `Status change ${runId}` })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const entry = await findAuditLogFor(
      cookies,
      'TASK',
      created.body.id,
      'STATUS_CHANGE',
    );
    const detail = await getAuditLogDetail(cookies, entry.id);
    expect(detail.before?.completed).toBe(false);
    expect(detail.after?.completed).toBe(true);
    expect(detail.before?.completedAt).toBeNull();
    expect(detail.after?.completedAt).not.toBeNull();

    // The plain PATCH /tasks/:id path (test 10) never produces STATUS_CHANGE.
    const updateEntries = (
      await listAuditLogs(
        cookies,
        `?entityType=TASK&entityId=${created.body.id}&action=UPDATE`,
      )
    ).data;
    expect(updateEntries.length).toBe(0);
  });

  it('12. a PATCH that changes no whitelisted field records no new entry', async () => {
    const cookies = await signIn(superAdmin.email);
    const title = `Unchanged ${runId}`;
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title })
      .expect(201);

    // Wait for the CREATE entry to actually land (it's written asynchronously
    // — see audit.extension.ts) before taking the baseline count, otherwise
    // it could land during the "after" window instead and produce a false
    // mismatch below.
    await findAuditLogFor(cookies, 'TASK', created.body.id, 'CREATE');
    const before = await listAuditLogs(
      cookies,
      `?entityType=TASK&entityId=${created.body.id}&pageSize=100`,
    );

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ title })
      .expect(200);

    const after = await listAuditLogs(
      cookies,
      `?entityType=TASK&entityId=${created.body.id}&pageSize=100`,
    );
    expect(after.total).toBe(before.total);
  });

  // -------------------------------------------------------------------
  // A second entity type (Client) — different whitelist, different label
  // field, and a status change that carries an extra field (churnReason).
  // -------------------------------------------------------------------

  it('13. creating and deactivating a Client records CREATE then STATUS_CHANGE with churnReason', async () => {
    const cookies = await signIn(superAdmin.email);
    const companyName = `Audited Co ${runId}`;
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send({
        companyName,
        industry: 'Software',
        email: `client-${runId}@example.com`,
        phone: '9999999999',
        addressLine1: '1 Main St',
        addressCity: 'Mumbai',
        addressState: 'Maharashtra',
        addressPincode: '400001',
      })
      .expect(201);

    const createEntry = await findAuditLogFor(
      cookies,
      'CLIENT',
      created.body.id,
      'CREATE',
    );
    expect(createEntry.entityLabel).toBe(companyName);

    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE', churnReason: 'Budget cuts' })
      .expect(200);

    const statusEntry = await findAuditLogFor(
      cookies,
      'CLIENT',
      created.body.id,
      'STATUS_CHANGE',
    );
    const detail = await getAuditLogDetail(cookies, statusEntry.id);
    expect(detail.before?.status).toBe('ACTIVE');
    expect(detail.after?.status).toBe('INACTIVE');
    expect(detail.after?.churnReason).toBe('Budget cuts');
  });

  // -------------------------------------------------------------------
  // SALES EXECUTIVE ACTOR-ONLY RESTRICTION
  // -------------------------------------------------------------------

  it('14. SALES_EXECUTIVE only sees their own actor events in the list', async () => {
    const salesCookies = await signIn(salesUser.email);
    const otherSalesCookies = await signIn(otherSalesUser.email);

    const mine = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', salesCookies)
      .send({ title: `Mine ${runId}` })
      .expect(201);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', otherSalesCookies)
      .send({ title: `Not mine ${runId}` })
      .expect(201);

    await findAuditLogFor(salesCookies, 'TASK', mine.body.id, 'CREATE');
    const list = await listAuditLogs(salesCookies, '?pageSize=100');
    expect(list.data.every((row) => row.actor?.id === salesUser.id)).toBe(true);
    expect(list.data.some((row) => row.entityId === mine.body.id)).toBe(true);
  });

  it("15. SALES_EXECUTIVE's actorId query filter cannot bypass the own-events restriction", async () => {
    const salesCookies = await signIn(salesUser.email);
    const list = await listAuditLogs(
      salesCookies,
      `?actorId=${otherSalesUser.id}&pageSize=100`,
    );
    expect(list.data.every((row) => row.actor?.id === salesUser.id)).toBe(true);
  });

  it('16. SALES_EXECUTIVE cannot GET another actor audit log by id (404)', async () => {
    const otherSalesCookies = await signIn(otherSalesUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', otherSalesCookies)
      .send({ title: `Belongs to other sales exec ${runId}` })
      .expect(201);
    const entry = await findAuditLogFor(
      otherSalesCookies,
      'TASK',
      created.body.id,
      'CREATE',
    );

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .get(`/audit-logs/${entry.id}`)
      .set('Cookie', salesCookies)
      .expect(404);
  });

  it('17. ADMIN sees audit events for every actor in the organization', async () => {
    const adminCookies = await signIn(adminUser.email);
    const list = await listAuditLogs(adminCookies, '?pageSize=100');
    const actorIds = new Set(list.data.map((row) => row.actor?.id));
    expect(actorIds.has(salesUser.id)).toBe(true);
    expect(actorIds.has(otherSalesUser.id)).toBe(true);
  });

  // -------------------------------------------------------------------
  // TENANT ISOLATION
  // -------------------------------------------------------------------

  it('18. cross-org audit log GET returns 404', async () => {
    const ownerCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', ownerCookies)
      .send({ title: `Org A only ${runId}` })
      .expect(201);
    const entry = await findAuditLogFor(
      ownerCookies,
      'TASK',
      created.body.id,
      'CREATE',
    );

    const otherOrgCookies = await signIn(otherOrgUser.email);
    await request(app.getHttpServer())
      .get(`/audit-logs/${entry.id}`)
      .set('Cookie', otherOrgCookies)
      .expect(404);
  });

  it('19. cross-org list never includes another organization CRM events', async () => {
    const otherOrgCookies = await signIn(otherOrgUser.email);
    const list = await listAuditLogs(otherOrgCookies, '?pageSize=100');
    // orgB's only legitimate audit history is orgB itself and its fixture
    // user being created in beforeAll (an ORGANIZATION CREATE and a USER
    // CREATE) — every Task/Client in this suite was created in orgA, so
    // those entity types must never appear here.
    expect(
      list.data.every(
        (row) => row.entityType === 'USER' || row.entityType === 'ORGANIZATION',
      ),
    ).toBe(true);
    expect(list.data.some((row) => row.entityId === otherOrgUser.id)).toBe(
      true,
    );
  });

  it('20. organizationId is not an accepted query filter (injection rejected)', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/audit-logs?organizationId=${orgB.id}`)
      .set('Cookie', cookies)
      .expect(400);
  });

  // -------------------------------------------------------------------
  // SENSITIVE DATA PROTECTION
  // -------------------------------------------------------------------

  it('21. audit entries never contain credential-shaped data', async () => {
    const cookies = await signIn(superAdmin.email);
    const list = await listAuditLogs(cookies, '?pageSize=100');
    // Fetched in parallel, not a sequential loop over every accumulated
    // row from earlier tests in this suite — this is a whitelist-coverage
    // check (every entity type appears many times over by test 21), not
    // an exhaustive one, so a representative sample is enough and keeps
    // the test fast.
    const sample = list.data.slice(0, 20);
    const details = await Promise.all(
      sample.map((row) => getAuditLogDetail(cookies, row.id)),
    );
    for (const detail of details) {
      const raw = JSON.stringify(detail).toLowerCase();
      expect(raw).not.toContain('password');
      expect(raw).not.toContain('accesstoken');
      expect(raw).not.toContain('refreshtoken');
      expect(raw).not.toContain('idtoken');
      expect(raw).not.toContain('sessiontoken');
      expect(raw).not.toContain('verificationtoken');
    }
  }, 30000);

  it('22. a User CREATE audit entry only exposes whitelisted, non-credential fields', async () => {
    const cookies = await signIn(superAdmin.email);
    const entry = await findAuditLogFor(
      cookies,
      'USER',
      salesUser.id,
      'CREATE',
    );
    const detail = await getAuditLogDetail(cookies, entry.id);
    expect(Object.keys(detail.after ?? {}).sort()).toEqual(
      ['name', 'email', 'role', 'department', 'status'].sort(),
    );
  });

  // -------------------------------------------------------------------
  // FILTERS
  // -------------------------------------------------------------------

  it('23. action filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    const result = await listAuditLogs(cookies, '?action=CREATE&pageSize=100');
    expect(result.data.every((row) => row.action === 'CREATE')).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('24. entityType filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    const result = await listAuditLogs(
      cookies,
      '?entityType=CLIENT&pageSize=100',
    );
    expect(result.data.every((row) => row.entityType === 'CLIENT')).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('25. invalid entityType is rejected', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/audit-logs?entityType=BOGUS')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('26. entityId filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: `EntityId filter ${runId}` })
      .expect(201);

    await findAuditLogFor(cookies, 'TASK', created.body.id, 'CREATE');
    const result = await listAuditLogs(cookies, `?entityId=${created.body.id}`);
    expect(result.data.every((row) => row.entityId === created.body.id)).toBe(
      true,
    );
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('27. actorId filter works for ADMIN', async () => {
    const cookies = await signIn(adminUser.email);
    const result = await listAuditLogs(
      cookies,
      `?actorId=${salesUser.id}&pageSize=100`,
    );
    expect(result.data.every((row) => row.actor?.id === salesUser.id)).toBe(
      true,
    );
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('28. search filter matches entityLabel', async () => {
    const cookies = await signIn(superAdmin.email);
    const unique = `Findable-${runId}`;
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: unique })
      .expect(201);
    await findAuditLogFor(cookies, 'TASK', created.body.id, 'CREATE');

    const result = await listAuditLogs(cookies, `?search=${unique}`);
    expect(result.data.some((row) => row.entityLabel === unique)).toBe(true);
  });

  it('29. dateFrom/dateTo range filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: `Date ranged ${runId}` })
      .expect(201);
    const entry = await findAuditLogFor(
      cookies,
      'TASK',
      created.body.id,
      'CREATE',
    );

    const farFuture = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const inRange = await listAuditLogs(
      cookies,
      `?dateFrom=2020-01-01T00:00:00.000Z&dateTo=${farFuture}`,
    );
    expect(inRange.data.some((row) => row.id === entry.id)).toBe(true);

    const outOfRange = await listAuditLogs(cookies, `?dateFrom=${farFuture}`);
    expect(outOfRange.data.some((row) => row.id === entry.id)).toBe(false);
  });

  it('30. combined filters work together', async () => {
    const cookies = await signIn(superAdmin.email);
    const unique = `Combined-${runId}`;
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: unique })
      .expect(201);
    await findAuditLogFor(cookies, 'TASK', created.body.id, 'CREATE');

    const result = await listAuditLogs(
      cookies,
      `?search=${unique}&action=CREATE&entityType=TASK`,
    );
    expect(result.data.some((row) => row.entityLabel === unique)).toBe(true);
  });

  // -------------------------------------------------------------------
  // PAGINATION / ORDERING
  // -------------------------------------------------------------------

  it('31. pagination returns correct page metadata', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await listAuditLogs(cookies, '?page=1&pageSize=1');
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(1);
    expect(res.data.length).toBeLessThanOrEqual(1);
  });

  it('32. pageSize=100 is accepted', async () => {
    const cookies = await signIn(superAdmin.email);
    await listAuditLogs(cookies, '?pageSize=100');
  });

  it('33. pageSize=101 is rejected', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/audit-logs?pageSize=101')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('34. list ordering is deterministic across repeated requests', async () => {
    const cookies = await signIn(superAdmin.email);
    const first = await listAuditLogs(cookies, '?pageSize=50');
    const second = await listAuditLogs(cookies, '?pageSize=50');
    expect(first.data.map((row) => row.id)).toEqual(
      second.data.map((row) => row.id),
    );
  });

  it('35. list is ordered createdAt DESC', async () => {
    const cookies = await signIn(superAdmin.email);
    const result = await listAuditLogs(cookies, '?pageSize=50');
    const timestamps = result.data.map((row) =>
      new Date(row.createdAt).getTime(),
    );
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  // -------------------------------------------------------------------
  // RESPONSE SHAPE
  // -------------------------------------------------------------------

  it('36. list item shape excludes before/after', async () => {
    const cookies = await signIn(superAdmin.email);
    const result = await listAuditLogs(cookies, '?pageSize=1');
    expect(result.data.length).toBeGreaterThan(0);
    expect(Object.keys(result.data[0]).sort()).toEqual(
      [
        'id',
        'action',
        'entityType',
        'entityId',
        'actor',
        'entityLabel',
        'createdAt',
      ].sort(),
    );
  });

  it('37. detail shape adds before/after on top of the list shape', async () => {
    const cookies = await signIn(superAdmin.email);
    const result = await listAuditLogs(cookies, '?pageSize=1');
    const detail = await getAuditLogDetail(cookies, result.data[0].id);
    expect(Object.keys(detail).sort()).toEqual(
      [
        'id',
        'action',
        'entityType',
        'entityId',
        'actor',
        'entityLabel',
        'createdAt',
        'before',
        'after',
      ].sort(),
    );
  });

  // -------------------------------------------------------------------
  // PERSISTENCE
  // -------------------------------------------------------------------

  it('38. an audit entry survives a fresh authenticated request', async () => {
    const firstCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', firstCookies)
      .send({ title: `Persisted ${runId}` })
      .expect(201);
    const entry = await findAuditLogFor(
      firstCookies,
      'TASK',
      created.body.id,
      'CREATE',
    );

    const freshCookies = await signIn(superAdmin.email);
    const detail = await getAuditLogDetail(freshCookies, entry.id);
    expect(detail.entityLabel).toBe(`Persisted ${runId}`);
  });
});
