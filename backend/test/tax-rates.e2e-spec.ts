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

describe('TaxRatesController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
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
        name: `Tax Test Org A ${runId}`,
        slug: `tax-test-org-a-${runId}`,
      },
    });
    orgB = await prisma.organization.create({
      data: {
        name: `Tax Test Org B ${runId}`,
        slug: `tax-test-org-b-${runId}`,
      },
    });

    superAdmin = await createFixtureUser({
      email: `tax-super-${runId}@test.local`,
      name: 'Tax Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `tax-admin-${runId}@test.local`,
      name: 'Tax Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `tax-sales-${runId}@test.local`,
      name: 'Tax Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgUser = await createFixtureUser({
      email: `tax-otherorg-${runId}@test.local`,
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
    await prisma.taxRate.deleteMany({
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

  it('1. rejects unauthenticated GET /tax-rates with 401', async () => {
    await request(app.getHttpServer()).get('/tax-rates').expect(401);
  });

  it('2. rejects unauthenticated POST /tax-rates with 401', async () => {
    await request(app.getHttpServer())
      .post('/tax-rates')
      .send({ name: 'X', rate: 10 })
      .expect(401);
  });

  // -------------------------------------------------------------------
  // RBAC — SUPER_ADMIN / ADMIN full access
  // -------------------------------------------------------------------

  it('3. SUPER_ADMIN can create, read, update and change status', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `SA Rate ${runId}`, rate: 9 })
      .expect(201);
    expect(created.body.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ rate: 12 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);
  });

  it('4. ADMIN can create, read, update and change status', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Admin Rate ${runId}`, rate: 18 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ name: `Admin Rate Renamed ${runId}` })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);
  });

  // -------------------------------------------------------------------
  // RBAC — SALES_EXECUTIVE read-only
  // -------------------------------------------------------------------

  it('5. SALES_EXECUTIVE can read tax rates', async () => {
    const superCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', superCookies)
      .send({ name: `Sales Visible Rate ${runId}`, rate: 5 })
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .get('/tax-rates')
      .set('Cookie', salesCookies)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/tax-rates/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(200);
  });

  it('6. SALES_EXECUTIVE cannot create a tax rate (403)', async () => {
    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', salesCookies)
      .send({ name: `Sales Attempt ${runId}`, rate: 10 })
      .expect(403);
  });

  it('7. SALES_EXECUTIVE cannot update a tax rate (403)', async () => {
    const superCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', superCookies)
      .send({ name: `Sales Update Target ${runId}`, rate: 10 })
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ rate: 20 })
      .expect(403);
  });

  it('8. SALES_EXECUTIVE cannot change tax rate status (403)', async () => {
    const superCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', superCookies)
      .send({ name: `Sales Status Target ${runId}`, rate: 10 })
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}/status`)
      .set('Cookie', salesCookies)
      .send({ status: 'INACTIVE' })
      .expect(403);
  });

  // -------------------------------------------------------------------
  // TENANT ISOLATION
  // -------------------------------------------------------------------

  it('9. cross-org GET returns 404', async () => {
    const ownerCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', ownerCookies)
      .send({ name: `Org A Only ${runId}`, rate: 10 })
      .expect(201);

    const otherOrgCookies = await signIn(otherOrgUser.email);
    await request(app.getHttpServer())
      .get(`/tax-rates/${created.body.id}`)
      .set('Cookie', otherOrgCookies)
      .expect(404);
  });

  it('10. cross-org PATCH returns 404', async () => {
    const ownerCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', ownerCookies)
      .send({ name: `Org A Patch Target ${runId}`, rate: 10 })
      .expect(201);

    const otherOrgCookies = await signIn(otherOrgUser.email);
    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}`)
      .set('Cookie', otherOrgCookies)
      .send({ rate: 99 })
      .expect(404);
  });

  it('11. organizationId injection is rejected on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Injected ${runId}`, rate: 10, organizationId: orgB.id })
      .expect(400);
  });

  // -------------------------------------------------------------------
  // VALIDATION
  // -------------------------------------------------------------------

  it('12. rejects a missing name', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ rate: 10 })
      .expect(400);
  });

  it('13. rejects a missing rate', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `No Rate ${runId}` })
      .expect(400);
  });

  it('14. rejects a negative rate', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Negative ${runId}`, rate: -1 })
      .expect(400);
  });

  it('15. rejects a rate over 100', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `TooHigh ${runId}`, rate: 100.01 })
      .expect(400);
  });

  it('16. accepts a rate of exactly 100', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Exactly100 ${runId}`, rate: 100 })
      .expect(201);
  });

  it('17. rejects unknown fields on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Unknown ${runId}`, rate: 10, favoriteColor: 'blue' })
      .expect(400);
  });

  it('18. rejects status on create (only via status endpoint)', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Status Injection ${runId}`, rate: 10, status: 'INACTIVE' })
      .expect(400);
  });

  it('19. rejects an invalid status value', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Bad Status Target ${runId}`, rate: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'DELETED' })
      .expect(400);
  });

  // -------------------------------------------------------------------
  // CREATE / LIST / GET / UPDATE
  // -------------------------------------------------------------------

  it('20. valid create succeeds and response matches the exact SafeTaxRate shape', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Shape Check ${runId}`, rate: 9.5 })
      .expect(201);
    expect(res.body.name).toBe(`Shape Check ${runId}`);
    expect(res.body.rate).toBe(9.5);
    expect(res.body.isDefault).toBe(false);
    expect(res.body.status).toBe('ACTIVE');
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'id',
        'organizationId',
        'name',
        'rate',
        'isDefault',
        'status',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });

  it('21. list returns a newly created rate', async () => {
    const cookies = await signIn(superAdmin.email);
    const unique = `List Findable ${runId}`;
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: unique, rate: 10 })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/tax-rates?search=${encodeURIComponent(unique)}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(
      list.body.data.some((r: { id: string }) => r.id === created.body.id),
    ).toBe(true);
  });

  it('22. GET by id returns the correct rate', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Get By Id ${runId}`, rate: 7 })
      .expect(201);
    const fetched = await request(app.getHttpServer())
      .get(`/tax-rates/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(fetched.body.id).toBe(created.body.id);
  });

  it('23. PATCH persists changes', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Before Update ${runId}`, rate: 5 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ name: `After Update ${runId}`, rate: 6 })
      .expect(200);
    expect(updated.body.name).toBe(`After Update ${runId}`);
    expect(updated.body.rate).toBe(6);

    const stored = await prisma.taxRate.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(stored.name).toBe(`After Update ${runId}`);
  });

  it('24. omitted fields on PATCH remain unchanged', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Keep Rate ${runId}`, rate: 15 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ name: `Renamed Only ${runId}` })
      .expect(200);
    expect(updated.body.rate).toBe(15);
  });

  it('25. status change to INACTIVE persists', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `To Deactivate ${runId}`, rate: 10 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);
    expect(updated.body.status).toBe('INACTIVE');
  });

  // -------------------------------------------------------------------
  // DEFAULT UNIQUENESS
  // -------------------------------------------------------------------

  it('26. creating a second default unsets the first', async () => {
    const cookies = await signIn(superAdmin.email);
    const first = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Default One ${runId}`, rate: 9, isDefault: true })
      .expect(201);
    expect(first.body.isDefault).toBe(true);

    const second = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Default Two ${runId}`, rate: 18, isDefault: true })
      .expect(201);
    expect(second.body.isDefault).toBe(true);

    const refreshedFirst = await request(app.getHttpServer())
      .get(`/tax-rates/${first.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(refreshedFirst.body.isDefault).toBe(false);
  });

  it('27. PATCH isDefault=true on one rate unsets the others', async () => {
    const cookies = await signIn(superAdmin.email);
    const a = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Patch Default A ${runId}`, rate: 9, isDefault: true })
      .expect(201);
    const b = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Patch Default B ${runId}`, rate: 18 })
      .expect(201);

    const updatedB = await request(app.getHttpServer())
      .patch(`/tax-rates/${b.body.id}`)
      .set('Cookie', cookies)
      .send({ isDefault: true })
      .expect(200);
    expect(updatedB.body.isDefault).toBe(true);

    const refreshedA = await request(app.getHttpServer())
      .get(`/tax-rates/${a.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(refreshedA.body.isDefault).toBe(false);
  });

  it('28. deactivating the current default clears isDefault', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({
        name: `Default To Deactivate ${runId}`,
        rate: 9,
        isDefault: true,
      })
      .expect(201);
    expect(created.body.isDefault).toBe(true);

    const deactivated = await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);
    expect(deactivated.body.isDefault).toBe(false);
    expect(deactivated.body.status).toBe('INACTIVE');
  });

  // -------------------------------------------------------------------
  // PERSISTENCE / INVALID IDS / NO DELETE
  // -------------------------------------------------------------------

  it('29. changes survive a fresh authenticated request', async () => {
    const firstCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', firstCookies)
      .send({ name: `Before Fresh ${runId}`, rate: 8 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}`)
      .set('Cookie', firstCookies)
      .send({ name: `Survives Fresh ${runId}` })
      .expect(200);

    const freshCookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/tax-rates/${created.body.id}`)
      .set('Cookie', freshCookies)
      .expect(200);
    expect(res.body.name).toBe(`Survives Fresh ${runId}`);
  });

  it('30. GET with a nonexistent id returns 404', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/tax-rates/nonexistent-id')
      .set('Cookie', cookies)
      .expect(404);
  });

  it('31. PATCH with a nonexistent id returns 404', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/tax-rates/nonexistent-id')
      .set('Cookie', cookies)
      .send({ rate: 5 })
      .expect(404);
  });

  it('32. there is no DELETE /tax-rates/:id route', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `No Delete ${runId}`, rate: 5 })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/tax-rates/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(404);
  });

  // -------------------------------------------------------------------
  // FILTERS / PAGINATION
  // -------------------------------------------------------------------

  it('33. status filter works', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/tax-rates')
      .set('Cookie', cookies)
      .send({ name: `Status Filter ${runId}`, rate: 5 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/tax-rates/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/tax-rates?status=INACTIVE&pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    expect(
      res.body.data.every((r: { status: string }) => r.status === 'INACTIVE'),
    ).toBe(true);
    expect(
      res.body.data.some((r: { id: string }) => r.id === created.body.id),
    ).toBe(true);
  });

  it('34. pageSize=100 is accepted, pageSize=101 is rejected', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/tax-rates?pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    await request(app.getHttpServer())
      .get('/tax-rates?pageSize=101')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('35. list ordering is deterministic across repeated requests', async () => {
    const cookies = await signIn(superAdmin.email);
    const first = await request(app.getHttpServer())
      .get('/tax-rates?pageSize=50')
      .set('Cookie', cookies)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/tax-rates?pageSize=50')
      .set('Cookie', cookies)
      .expect(200);
    expect(first.body.data.map((r: { id: string }) => r.id)).toEqual(
      second.body.data.map((r: { id: string }) => r.id),
    );
  });
});
