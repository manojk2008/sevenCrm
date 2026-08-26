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

describe('TasksController (e2e)', () => {
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
      data: { name: `Task Test Org A ${runId}`, slug: `task-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Task Test Org B ${runId}`, slug: `task-test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `task-super-${runId}@test.local`,
      name: 'Task Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `task-admin-${runId}@test.local`,
      name: 'Task Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `task-sales-${runId}@test.local`,
      name: 'Task Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherSalesUser = await createFixtureUser({
      email: `task-sales-other-${runId}@test.local`,
      name: 'Other Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgUser = await createFixtureUser({
      email: `task-otherorg-${runId}@test.local`,
      name: 'Other Org Super Admin',
      organizationId: orgB.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
  }, 30000);

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  // -------------------------------------------------------------------
  // AUTH
  // -------------------------------------------------------------------

  it('1. rejects unauthenticated GET /tasks with 401', async () => {
    await request(app.getHttpServer()).get('/tasks').expect(401);
  });

  it('2. rejects unauthenticated POST /tasks with 401', async () => {
    await request(app.getHttpServer()).post('/tasks').send({ title: 'Nope' }).expect(401);
  });

  // -------------------------------------------------------------------
  // RBAC
  // -------------------------------------------------------------------

  it('3. SUPER_ADMIN has full task access', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Super admin task', assignedToId: adminUser.id })
      .expect(201);
    expect(created.body.assignedToId).toBe(adminUser.id);

    await request(app.getHttpServer())
      .get(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
  });

  it('4. ADMIN has full task access', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Admin task', assignedToId: salesUser.id })
      .expect(201);
    expect(created.body.assignedToId).toBe(salesUser.id);

    await request(app.getHttpServer())
      .get(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
  });

  it('5. SALES_EXECUTIVE has own-task access', async () => {
    const cookies = await signIn(salesUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'My own task' })
      .expect(201);
    expect(created.body.assignedToId).toBe(salesUser.id);

    await request(app.getHttpServer())
      .get(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
  });

  // -------------------------------------------------------------------
  // TENANT ISOLATION
  // -------------------------------------------------------------------

  it('6. cross-org task GET returns 404', async () => {
    const ownerCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', ownerCookies)
      .send({ title: 'Org A task' })
      .expect(201);

    const otherOrgCookies = await signIn(otherOrgUser.email);
    await request(app.getHttpServer())
      .get(`/tasks/${created.body.id}`)
      .set('Cookie', otherOrgCookies)
      .expect(404);
  });

  it('7. cross-org task PATCH returns 404', async () => {
    const ownerCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', ownerCookies)
      .send({ title: 'Org A task to patch' })
      .expect(201);

    const otherOrgCookies = await signIn(otherOrgUser.email);
    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', otherOrgCookies)
      .send({ title: 'Hijacked' })
      .expect(404);
  });

  it('8. cross-org assignedToId is rejected on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Bad assignment', assignedToId: otherOrgUser.id })
      .expect(400);
  });

  // -------------------------------------------------------------------
  // SALES EXECUTIVE ISOLATION
  // -------------------------------------------------------------------

  it('9. list only returns the caller own tasks for SALES_EXECUTIVE', async () => {
    const salesCookies = await signIn(salesUser.email);
    const otherSalesCookies = await signIn(otherSalesUser.email);

    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', salesCookies)
      .send({ title: 'Mine A' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', otherSalesCookies)
      .send({ title: 'Not mine' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/tasks?pageSize=100')
      .set('Cookie', salesCookies)
      .expect(200);

    expect(list.body.data.every((t: { assignedToId: string }) => t.assignedToId === salesUser.id)).toBe(
      true,
    );
    expect(list.body.data.some((t: { title: string }) => t.title === 'Not mine')).toBe(false);
  });

  it('10. cannot GET another user task (404)', async () => {
    const otherSalesCookies = await signIn(otherSalesUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', otherSalesCookies)
      .send({ title: 'Belongs to other sales exec' })
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .get(`/tasks/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(404);
  });

  it('11. cannot PATCH another user task (404)', async () => {
    const otherSalesCookies = await signIn(otherSalesUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', otherSalesCookies)
      .send({ title: 'Another task to protect' })
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ title: 'Hijacked' })
      .expect(404);
  });

  it('12. cannot complete another user task (404)', async () => {
    const otherSalesCookies = await signIn(otherSalesUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', otherSalesCookies)
      .send({ title: 'Another task to complete' })
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', salesCookies)
      .send({ status: 'COMPLETED' })
      .expect(404);
  });

  it('13. cannot create a task assigned to another user (400)', async () => {
    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', salesCookies)
      .send({ title: 'Sneaky assignment', assignedToId: otherSalesUser.id })
      .expect(400);
  });

  it('14. omitted assignedToId automatically assigns the current user', async () => {
    const salesCookies = await signIn(salesUser.email);
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', salesCookies)
      .send({ title: 'Auto assigned' })
      .expect(201);
    expect(res.body.assignedToId).toBe(salesUser.id);
  });

  it('15. assignedToId=currentUser.id is accepted', async () => {
    const salesCookies = await signIn(salesUser.email);
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', salesCookies)
      .send({ title: 'Explicit self assign', assignedToId: salesUser.id })
      .expect(201);
    expect(res.body.assignedToId).toBe(salesUser.id);
  });

  it('16. assignedToId query filter cannot bypass ownership restriction', async () => {
    const salesCookies = await signIn(salesUser.email);
    const list = await request(app.getHttpServer())
      .get(`/tasks?assignedToId=${otherSalesUser.id}&pageSize=100`)
      .set('Cookie', salesCookies)
      .expect(200);

    expect(list.body.data.every((t: { assignedToId: string }) => t.assignedToId === salesUser.id)).toBe(
      true,
    );
  });

  // -------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------

  it('17. valid create succeeds', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Valid task', priority: 'HIGH' })
      .expect(201);
    expect(res.body.title).toBe('Valid task');
    expect(res.body.priority).toBe('HIGH');
  });

  it('18. new task defaults to completed=false', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Starts incomplete' })
      .expect(201);
    expect(res.body.completed).toBe(false);
    expect(res.body.completedAt).toBeNull();
  });

  it('19. timestamps are server-generated', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Timestamped task' })
      .expect(201);
    expect(typeof res.body.createdAt).toBe('string');
    expect(typeof res.body.updatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.createdAt))).toBe(false);
  });

  it('20. invalid (empty) title is rejected', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: '' })
      .expect(400);
  });

  it('21. invalid priority is rejected', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Bad priority', priority: 'CRITICAL' })
      .expect(400);
  });

  it('22. completed injection is rejected on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Injected', completed: true })
      .expect(400);
  });

  it('23. completedAt injection is rejected on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Injected', completedAt: new Date().toISOString() })
      .expect(400);
  });

  it('24. organizationId injection is rejected on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Injected', organizationId: orgB.id })
      .expect(400);
  });

  it('25. unknown fields are rejected on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Injected', favoriteColor: 'blue' })
      .expect(400);
  });

  // -------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------

  it('26. PATCH persists changes', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Before update' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ title: 'After update' })
      .expect(200);
    expect(updated.body.title).toBe('After update');

    const stored = await prisma.task.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored.title).toBe('After update');
  });

  it('27. omitted fields on PATCH remain unchanged', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Keep priority', priority: 'URGENT' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ title: 'Renamed only' })
      .expect(200);
    expect(updated.body.priority).toBe('URGENT');
  });

  it('28. Sales Executive cannot reassign a task', async () => {
    const salesCookies = await signIn(salesUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', salesCookies)
      .send({ title: 'Cannot reassign' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ assignedToId: otherSalesUser.id })
      .expect(400);
  });

  it('29. Admin can reassign a task', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Reassignable', assignedToId: salesUser.id })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ assignedToId: otherSalesUser.id })
      .expect(200);
    expect(updated.body.assignedToId).toBe(otherSalesUser.id);
  });

  it('30. Admin can unassign a task', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Unassignable', assignedToId: salesUser.id })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ assignedToId: null })
      .expect(200);
    expect(updated.body.assignedToId).toBeNull();
  });

  // -------------------------------------------------------------------
  // STATUS
  // -------------------------------------------------------------------

  it('31. PENDING to COMPLETED transition works', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'To complete' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(updated.body.completed).toBe(true);
  });

  it('32. server stamps completedAt on completion', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Stamp completedAt' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(updated.body.completedAt).not.toBeNull();
    expect(Number.isNaN(Date.parse(updated.body.completedAt))).toBe(false);
  });

  it('33. COMPLETED to PENDING transition works', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Round trip' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PENDING' })
      .expect(200);
    expect(updated.body.completed).toBe(false);
  });

  it('34. completedAt clears when moved back to PENDING', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Clear completedAt' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'PENDING' })
      .expect(200);
    expect(updated.body.completedAt).toBeNull();
  });

  it('35. completedAt injection is rejected on the status endpoint', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Status injection' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', completedAt: '2000-01-01T00:00:00.000Z' })
      .expect(400);
  });

  // -------------------------------------------------------------------
  // FILTERING / PAGINATION
  // -------------------------------------------------------------------

  it('36. search filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    const unique = `Findable-${runId}`;
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: unique })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/tasks?search=${unique}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.data.some((t: { title: string }) => t.title === unique)).toBe(true);
  });

  it('37. completed filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: `Completed filter ${runId}` })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/tasks?completed=true&pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.data.every((t: { completed: boolean }) => t.completed === true)).toBe(true);
    expect(res.body.data.some((t: { id: string }) => t.id === created.body.id)).toBe(true);
  });

  it('38. priority filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: `Urgent filter ${runId}`, priority: 'URGENT' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/tasks?priority=URGENT&pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.data.every((t: { priority: string }) => t.priority === 'URGENT')).toBe(true);
  });

  it('39. assignedToId filter works for ADMIN', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: `Assigned filter ${runId}`, assignedToId: salesUser.id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/tasks?assignedToId=${salesUser.id}&pageSize=100`)
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.data.every((t: { assignedToId: string }) => t.assignedToId === salesUser.id)).toBe(
      true,
    );
  });

  it('40. dueFrom/dueTo range filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    const dueDate = new Date('2030-06-15T00:00:00.000Z').toISOString();
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: `Ranged ${runId}`, dueDate })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/tasks?dueFrom=2030-06-01T00:00:00.000Z&dueTo=2030-06-30T00:00:00.000Z&pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.data.some((t: { id: string }) => t.id === created.body.id)).toBe(true);

    const outOfRange = await request(app.getHttpServer())
      .get('/tasks?dueFrom=2031-01-01T00:00:00.000Z&pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    expect(outOfRange.body.data.some((t: { id: string }) => t.id === created.body.id)).toBe(false);
  });

  it('41. pagination returns correct page metadata', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/tasks?page=1&pageSize=1')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('42. pageSize=100 is accepted', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/tasks?pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
  });

  it('43. pageSize=101 is rejected', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/tasks?pageSize=101')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('44. combined filters work together', async () => {
    const cookies = await signIn(superAdmin.email);
    const unique = `Combined-${runId}`;
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: unique, priority: 'LOW' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/tasks?search=${unique}&priority=LOW&completed=false&pageSize=100`)
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.data.some((t: { id: string }) => t.id === created.body.id)).toBe(true);
  });

  // -------------------------------------------------------------------
  // RESPONSE SHAPE
  // -------------------------------------------------------------------

  it('45. response matches the exact SafeTask shape', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'Shape check', assignedToId: adminUser.id })
      .expect(201);

    expect(Object.keys(created.body).sort()).toEqual(
      [
        'id',
        'organizationId',
        'assignedToId',
        'assignedTo',
        'title',
        'dueDate',
        'priority',
        'completed',
        'completedAt',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    expect(Object.keys(created.body.assignedTo).sort()).toEqual(['id', 'name', 'email'].sort());
  });

  it('46. no sensitive User fields leak through assignedTo', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', cookies)
      .send({ title: 'No leaks', assignedToId: adminUser.id })
      .expect(201);

    expect(JSON.stringify(created.body).toLowerCase()).not.toContain('password');
    expect(created.body.assignedTo).not.toHaveProperty('banned');
    expect(created.body.assignedTo).not.toHaveProperty('role');
    expect(created.body.assignedTo).not.toHaveProperty('organizationId');
  });

  it('47. list ordering is deterministic across repeated requests', async () => {
    const cookies = await signIn(superAdmin.email);
    const first = await request(app.getHttpServer())
      .get('/tasks?pageSize=50')
      .set('Cookie', cookies)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/tasks?pageSize=50')
      .set('Cookie', cookies)
      .expect(200);
    expect(first.body.data.map((t: { id: string }) => t.id)).toEqual(
      second.body.data.map((t: { id: string }) => t.id),
    );
  });

  // -------------------------------------------------------------------
  // PERSISTENCE
  // -------------------------------------------------------------------

  it('48. changes survive a fresh authenticated request', async () => {
    const firstCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', firstCookies)
      .send({ title: 'Before fresh request' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/tasks/${created.body.id}`)
      .set('Cookie', firstCookies)
      .send({ title: 'Survives fresh request' })
      .expect(200);

    const freshCookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/tasks/${created.body.id}`)
      .set('Cookie', freshCookies)
      .expect(200);
    expect(res.body.title).toBe('Survives fresh request');
  });
});
