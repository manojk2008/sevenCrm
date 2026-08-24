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

async function createFixtureProductGroup(organizationId: string, name?: string) {
  return prisma.productGroup.create({
    data: {
      organizationId,
      name: name ?? `Fixture Group ${uid()}`,
    },
  });
}

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let otherOrgAdmin: { id: string; email: string };
  let groupA: { id: string; name: string };
  let groupB: { id: string; name: string };

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      name: `Product ${uid()}`,
      productGroupId: groupA.id,
      price: 1999.99,
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
      data: { name: `Prod Org A ${runId}`, slug: `products-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Prod Org B ${runId}`, slug: `products-test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `prod-super-${runId}@test.local`,
      name: 'Prod Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `prod-admin-${runId}@test.local`,
      name: 'Prod Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `prod-sales-${runId}@test.local`,
      name: 'Prod Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgAdmin = await createFixtureUser({
      email: `prod-other-admin-${runId}@test.local`,
      name: 'Prod Other Org Admin',
      organizationId: orgB.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    groupA = await createFixtureProductGroup(orgA.id);
    groupB = await createFixtureProductGroup(orgB.id);
  }, 30000);

  afterAll(async () => {
    // Product.organizationId/.productGroupId are both onDelete: Restrict, so
    // products must be removed before groups, and groups before orgs/users.
    await prisma.product.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.productGroup.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  // ---------------------------------------------------------- auth/authz

  it('1. rejects GET /products when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/products').expect(401);
  });

  it('2. rejects POST /products when unauthenticated', async () => {
    await request(app.getHttpServer()).post('/products').send(basePayload()).expect(401);
  });

  it('3. rejects PATCH /products/:id when unauthenticated', async () => {
    await request(app.getHttpServer())
      .patch('/products/does-not-matter')
      .send({ name: 'x' })
      .expect(401);
  });

  it('4. allows a Super Admin to create a product, assigned to their org', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    expect(res.body.organizationId).toBe(orgA.id);
    expect(res.body.productGroupId).toBe(groupA.id);
    expect(res.body.productGroup).toEqual({ id: groupA.id, name: groupA.name });
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.price).toBe(1999.99);
    expect(res.body.sku).toBeNull();
    expect(res.body.unit).toBeNull();
  });

  it('5. allows an Admin to create a product', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(res.body.organizationId).toBe(orgA.id);
  });

  it('6. rejects a Sales Executive creating, updating, or changing status of a product, but allows read', async () => {
    const adminCookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', adminCookies)
      .send(basePayload())
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', salesCookies)
      .send(basePayload())
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ name: 'Renamed by sales' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/products/${created.body.id}/status`)
      .set('Cookie', salesCookies)
      .send({ status: 'INACTIVE' })
      .expect(403);
    // read is allowed for all three roles
    await request(app.getHttpServer())
      .get(`/products/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(200);
    await request(app.getHttpServer()).get('/products').set('Cookie', salesCookies).expect(200);
  });

  // ------------------------------------------------------------ validation

  it('7. rejects a missing name and a missing productGroupId', async () => {
    const cookies = await signIn(superAdmin.email);
    const noName = basePayload();
    delete (noName as Record<string, unknown>).name;
    await request(app.getHttpServer()).post('/products').set('Cookie', cookies).send(noName).expect(400);

    const noGroup = basePayload();
    delete (noGroup as Record<string, unknown>).productGroupId;
    await request(app.getHttpServer()).post('/products').set('Cookie', cookies).send(noGroup).expect(400);
  });

  it('8. rejects a negative price and a price with more than 2 decimal places', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ price: -10 }))
      .expect(400);
    // Decimal(14,2) cannot store 3 decimal places — rejected, not rounded.
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ price: 10.123 }))
      .expect(400);
    // boundary is valid
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ price: 0 }))
      .expect(201);
  });

  it('9. sku and unit are optional and duplicate sku values are allowed', async () => {
    const cookies = await signIn(superAdmin.email);
    const noSkuNoUnit = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(noSkuNoUnit.body.sku).toBeNull();
    expect(noSkuNoUnit.body.unit).toBeNull();

    const sharedSku = `SKU-${uid()}`;
    const first = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ sku: sharedSku, unit: 'piece' }))
      .expect(201);
    expect(first.body.sku).toBe(sharedSku);
    expect(first.body.unit).toBe('piece');

    // duplicate SKU is explicitly allowed — no uniqueness constraint
    const second = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ sku: sharedSku, unit: 'kg' }))
      .expect(201);
    expect(second.body.sku).toBe(sharedSku);
  });

  it('10. rejects unknown DTO fields and a body-supplied organizationId', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ notARealField: 'nope' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ organizationId: orgB.id }))
      .expect(400);
  });

  // ---------------------------------------------------- group tenant isolation

  it('11. rejects a productGroupId belonging to another organization', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ productGroupId: groupB.id }))
      .expect(400);

    const leaked = await prisma.product.findFirst({ where: { productGroupId: groupB.id, organizationId: orgA.id } });
    expect(leaked).toBeNull();
  });

  it('12. rejects a nonexistent productGroupId', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ productGroupId: 'nonexistent000000000000000' }))
      .expect(400);
  });

  it('13. rejects changing productGroupId to a group belonging to another organization', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productGroupId: groupB.id })
      .expect(400);

    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(unchanged.productGroupId).toBe(groupA.id);
  });

  // ---------------------------------------------------------- list/query

  it('14. GET /products returns only the caller organization records', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBProduct = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookiesB)
      .send({ name: `Org B Product ${uid()}`, productGroupId: groupB.id, price: 10 })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    const listRes = await request(app.getHttpServer())
      .get('/products?pageSize=100')
      .set('Cookie', cookiesA)
      .expect(200);

    const ids: string[] = listRes.body.data.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(orgBProduct.body.id);
    for (const product of listRes.body.data) {
      expect(product.organizationId).toBe(orgA.id);
    }
  });

  it('15. GET /products/:id cannot access another organization record (404)', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBProduct = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookiesB)
      .send({ name: `Org B Product ${uid()}`, productGroupId: groupB.id, price: 10 })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/products/${orgBProduct.body.id}`)
      .set('Cookie', cookiesA)
      .expect(404);
  });

  it('16. PATCH /products/:id for another organization returns 404 and does not mutate', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBProduct = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookiesB)
      .send({ name: 'Org B Product Original', productGroupId: groupB.id, price: 10 })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch(`/products/${orgBProduct.body.id}`)
      .set('Cookie', cookiesA)
      .send({ name: 'Hijacked' })
      .expect(404);

    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: orgBProduct.body.id } });
    expect(unchanged.name).toBe('Org B Product Original');
  });

  it('17. PATCH /products/:id updates the correct product', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/products/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Renamed Product', price: 2500.5, unit: 'license' })
      .expect(200);

    expect(updated.body.id).toBe(created.body.id);
    expect(updated.body.name).toBe('Renamed Product');
    expect(updated.body.price).toBe(2500.5);
    expect(updated.body.unit).toBe('license');
  });

  it('18. status: ACTIVE -> INACTIVE -> ACTIVE works and the row is never hard-deleted', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    const deactivated = await request(app.getHttpServer())
      .patch(`/products/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);
    expect(deactivated.body.status).toBe('INACTIVE');

    await request(app.getHttpServer())
      .delete(`/products/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(404);

    const reactivated = await request(app.getHttpServer())
      .patch(`/products/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(reactivated.body.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .patch(`/products/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'ARCHIVED' })
      .expect(400);
  });

  it('19. search matches product name, productGroupId filter and status filter work, pagination is bounded', async () => {
    const cookies = await signIn(superAdmin.email);
    const uniqueTerm = `Findable${uid()}`;
    const findable = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ name: `${uniqueTerm} Product` }))
      .expect(201);

    const searchRes = await request(app.getHttpServer())
      .get(`/products?search=${uniqueTerm}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);
    for (const product of searchRes.body.data) {
      expect(product.name).toContain(uniqueTerm);
    }

    const groupFilterRes = await request(app.getHttpServer())
      .get(`/products?productGroupId=${groupA.id}`)
      .set('Cookie', cookies)
      .expect(200);
    for (const product of groupFilterRes.body.data) {
      expect(product.productGroupId).toBe(groupA.id);
    }
    expect(groupFilterRes.body.data.map((p: { id: string }) => p.id)).toContain(findable.body.id);

    const statusRes = await request(app.getHttpServer())
      .get('/products?status=ACTIVE')
      .set('Cookie', cookies)
      .expect(200);
    for (const product of statusRes.body.data) {
      expect(product.status).toBe('ACTIVE');
    }

    await request(app.getHttpServer()).get('/products?pageSize=101').set('Cookie', cookies).expect(400);
    await request(app.getHttpServer()).get('/products?pageSize=100').set('Cookie', cookies).expect(200);
  });

  // ---------------------------------------------------- critical lifecycle

  it('20A-G. full inactive-group lifecycle: create under active group, deactivate group, existing products unaffected, new/updated assignment to inactive group rejected, reactivate group restores creation', async () => {
    const cookies = await signIn(superAdmin.email);
    const lifecycleGroup = await request(app.getHttpServer())
      .post('/product-groups')
      .set('Cookie', cookies)
      .send({ name: `Lifecycle Group ${uid()}` })
      .expect(201);

    // A. create Product under ACTIVE group succeeds
    const existingProduct = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send({ name: 'Existing Product', productGroupId: lifecycleGroup.body.id, price: 500 })
      .expect(201);
    expect(existingProduct.body.status).toBe('ACTIVE');

    // B. deactivate the group
    const deactivatedGroup = await request(app.getHttpServer())
      .patch(`/product-groups/${lifecycleGroup.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);
    expect(deactivatedGroup.body.status).toBe('INACTIVE');

    // C. existing product remains unchanged (still ACTIVE, still queryable)
    const stillThere = await request(app.getHttpServer())
      .get(`/products/${existingProduct.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(stillThere.body.status).toBe('ACTIVE');
    expect(stillThere.body.productGroupId).toBe(lifecycleGroup.body.id);

    // D. creating a NEW product under the inactive group is rejected
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send({ name: 'Rejected New Product', productGroupId: lifecycleGroup.body.id, price: 100 })
      .expect(400);

    // E. updating an existing (different-group) product to the inactive group is rejected
    const otherGroupProduct = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send(basePayload({ name: 'Other Group Product' }))
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/products/${otherGroupProduct.body.id}`)
      .set('Cookie', cookies)
      .send({ productGroupId: lifecycleGroup.body.id })
      .expect(400);

    // F. reactivate the group
    const reactivatedGroup = await request(app.getHttpServer())
      .patch(`/product-groups/${lifecycleGroup.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(reactivatedGroup.body.status).toBe('ACTIVE');

    // G. creating a product under it now succeeds again
    const afterReactivation = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', cookies)
      .send({ name: 'Post-Reactivation Product', productGroupId: lifecycleGroup.body.id, price: 100 })
      .expect(201);
    expect(afterReactivation.body.productGroupId).toBe(lifecycleGroup.body.id);

    // one ProductGroup -> many Products, confirmed via productCount
    const finalGroup = await request(app.getHttpServer())
      .get(`/product-groups/${lifecycleGroup.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(finalGroup.body.productCount).toBe(2);
  });
});
