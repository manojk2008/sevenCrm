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

describe('ProductGroupsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let otherOrgAdmin: { id: string; email: string };

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      name: `Product Group ${uid()}`,
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
      data: { name: `PG Org A ${runId}`, slug: `product-groups-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `PG Org B ${runId}`, slug: `product-groups-test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `pg-super-${runId}@test.local`,
      name: 'PG Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `pg-admin-${runId}@test.local`,
      name: 'PG Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `pg-sales-${runId}@test.local`,
      name: 'PG Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgAdmin = await createFixtureUser({
      email: `pg-other-admin-${runId}@test.local`,
      name: 'PG Other Org Admin',
      organizationId: orgB.id,
      role: 'ADMIN',
      department: 'Operations',
    });
  }, 30000);

  afterAll(async () => {
    // ProductGroup.organizationId is onDelete: Restrict, and
    // Product.productGroupId is also Restrict, so products must be removed
    // before their groups, and groups before the orgs/users.
    await prisma.product.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.productGroup.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  // ---------------------------------------------------------- auth/authz

  it('1. rejects GET /product-groups when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/product-groups').expect(401);
  });

  it('2. rejects POST /product-groups when unauthenticated', async () => {
    await request(app.getHttpServer()).post('/product-groups').send(basePayload()).expect(401);
  });

  it('3. rejects PATCH /product-groups/:id when unauthenticated', async () => {
    await request(app.getHttpServer())
      .patch('/product-groups/does-not-matter')
      .send({ name: 'x' })
      .expect(401);
  });

  it('4. allows a Super Admin to create a product group, assigned to their org', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    expect(res.body.organizationId).toBe(orgA.id);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.productCount).toBe(0);
  });

  it('5. allows an Admin to create a product group', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(res.body.organizationId).toBe(orgA.id);
  });

  it('6. rejects a Sales Executive creating, updating, or changing status of a product group, but allows read', async () => {
    const adminCookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', adminCookies)
      .send(basePayload())
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', salesCookies)
      .send(basePayload())
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/product-groups/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ name: 'Renamed by sales' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/product-groups/${created.body.id}/status`)
      .set('Cookie', salesCookies)
      .send({ status: 'INACTIVE' })
      .expect(403);
    // read is allowed for all three roles
    await request(app.getHttpServer())
      .get(`/product-groups/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(200);
    await request(app.getHttpServer()).get('/product-groups').set('Cookie', salesCookies).expect(200);
  });

  // ------------------------------------------------------------ validation

  it('7. rejects a missing name', async () => {
    const cookies = await signIn(superAdmin.email);
    const payload = basePayload();
    delete (payload as Record<string, unknown>).name;
    await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(payload)
      .expect(400);
  });

  it('8. rejects unknown DTO fields and a body-supplied organizationId', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(basePayload({ notARealField: 'nope' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(basePayload({ organizationId: orgB.id }))
      .expect(400);
  });

  it('9. rejects a duplicate name within the same organization (409), allows it in a different organization', async () => {
    const cookiesA = await signIn(superAdmin.email);
    const cookiesB = await signIn(otherOrgAdmin.email);
    const name = `Dup Group ${uid()}`;

    await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookiesA)
      .send(basePayload({ name }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookiesA)
      .send(basePayload({ name }))
      .expect(409);

    // same name, different organization — allowed
    await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookiesB)
      .send(basePayload({ name }))
      .expect(201);
  });

  // ---------------------------------------------------------- list/query

  it('10. GET /product-groups returns only the caller organization records', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBGroup = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookiesB)
      .send(basePayload())
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    const listRes = await request(app.getHttpServer())
      .get('/product-groups?pageSize=100')
      .set('Cookie', cookiesA)
      .expect(200);

    const ids: string[] = listRes.body.data.map((g: { id: string }) => g.id);
    expect(ids).not.toContain(orgBGroup.body.id);
    for (const group of listRes.body.data) {
      expect(group.organizationId).toBe(orgA.id);
    }
  });

  it('11. GET /product-groups/:id cannot access another organization record (404)', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBGroup = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookiesB)
      .send(basePayload())
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/product-groups/${orgBGroup.body.id}`)
      .set('Cookie', cookiesA)
      .expect(404);
  });

  it('12. PATCH /product-groups/:id updates the correct record and rejects organizationId (unknown field)', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/product-groups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Renamed Group', description: 'Updated description' })
      .expect(200);
    expect(updated.body.name).toBe('Renamed Group');
    expect(updated.body.description).toBe('Updated description');

    await request(app.getHttpServer())
      .patch(`/product-groups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ organizationId: orgB.id })
      .expect(400);

    const stillOrgA = await prisma.productGroup.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stillOrgA.organizationId).toBe(orgA.id);
  });

  it('13. PATCH /product-groups/:id for another organization returns 404 and does not mutate', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBGroup = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookiesB)
      .send(basePayload({ name: `Org B Group ${uid()}` }))
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch(`/product-groups/${orgBGroup.body.id}`)
      .set('Cookie', cookiesA)
      .send({ name: 'Hijacked' })
      .expect(404);

    const unchanged = await prisma.productGroup.findUniqueOrThrow({ where: { id: orgBGroup.body.id } });
    expect(unchanged.name).toBe(orgBGroup.body.name);
  });

  it('14. status: ACTIVE -> INACTIVE -> ACTIVE works and the row is never hard-deleted', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    const deactivated = await request(app.getHttpServer())
      .patch(`/product-groups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);
    expect(deactivated.body.status).toBe('INACTIVE');

    // there is no hard-delete route at all
    await request(app.getHttpServer())
      .delete(`/product-groups/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(404);

    const reactivated = await request(app.getHttpServer())
      .patch(`/product-groups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(reactivated.body.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .patch(`/product-groups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'NOT_A_STATUS' })
      .expect(400);
  });

  it('15. search matches product group name, status filter works, pagination is bounded', async () => {
    const cookies = await signIn(superAdmin.email);
    const uniqueTerm = `Findable${uid()}`;
    await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(basePayload({ name: `${uniqueTerm} Group` }))
      .expect(201);

    const searchRes = await request(app.getHttpServer())
      .get(`/product-groups?search=${uniqueTerm}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);
    for (const group of searchRes.body.data) {
      expect(group.name).toContain(uniqueTerm);
    }

    const statusRes = await request(app.getHttpServer())
      .get('/product-groups?status=ACTIVE')
      .set('Cookie', cookies)
      .expect(200);
    for (const group of statusRes.body.data) {
      expect(group.status).toBe('ACTIVE');
    }

    await request(app.getHttpServer())
      .get('/product-groups?pageSize=101')
      .set('Cookie', cookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/product-groups?pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
  });

  it('16. productCount reflects the number of products assigned to the group', async () => {
    const cookies = await signIn(superAdmin.email);
    const group = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(group.body.productCount).toBe(0);

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/products')
        .set('Cookie', cookies)
        .send({
          name: `Group Product ${uid()}`,
          productGroupId: group.body.id,
          price: 100,
        })
        .expect(201);
    }

    const refreshed = await request(app.getHttpServer())
      .get(`/product-groups/${group.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(refreshed.body.productCount).toBe(3);
  });
});
