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

async function createFixtureClient(organizationId: string) {
  return prisma.client.create({
    data: {
      organizationId,
      companyName: `EnqProd Client ${uid()}`,
      industry: 'IT Services',
      email: `enqprod-client-${uid()}@test.local`,
      phone: '+919876500000',
      addressLine1: '1 Pipeline Road',
      addressCity: 'Mumbai',
      addressState: 'Maharashtra',
      addressPincode: '400001',
    },
  });
}

async function createFixtureProduct(params: {
  organizationId: string;
  productGroupId: string;
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  price?: number;
  sku?: string;
  unit?: string;
}) {
  return prisma.product.create({
    data: {
      organizationId: params.organizationId,
      productGroupId: params.productGroupId,
      name: params.name ?? `EnqProd Product ${uid()}`,
      price: params.price ?? 4999.5,
      sku: params.sku ?? null,
      unit: params.unit ?? null,
      status: params.status ?? 'ACTIVE',
    },
  });
}

/**
 * Covers the Enquiry <-> Product relationship specifically (the EnquiryProduct
 * join): attaching, detaching, replacing, organization isolation and the
 * ACTIVE/INACTIVE rules. Kept in its own spec so enquiries.e2e-spec.ts stays
 * focused on the enquiry record itself.
 */
describe('Enquiry products (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let otherOrgAdmin: { id: string; email: string };
  let clientA: { id: string };
  let clientB: { id: string };
  let groupA: { id: string; name: string };
  let groupB: { id: string; name: string };
  let productA1: { id: string; name: string };
  let productA2: { id: string; name: string };
  let productA3: { id: string; name: string };
  let productAInactive: { id: string; name: string };
  let productB: { id: string; name: string };

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      title: `Enquiry ${uid()}`,
      clientId: clientA.id,
      expectedRevenue: 150000.5,
      probability: 40,
      priority: 'HIGH',
      source: 'WEBSITE',
      expectedCloseDate: '2026-12-31T00:00:00.000Z',
      ...overrides,
    };
  }

  // Sessions are reused across tests in this suite. Every case below is
  // about the Enquiry-Product relationship rather than session handling, and
  // a fresh sign-in per request would add ~50 password-hash round trips to
  // the database for no extra coverage.
  const sessionCookies = new Map<string, string[]>();

  async function signIn(email: string): Promise<string[]> {
    const cached = sessionCookies.get(email);
    if (cached) return cached;

    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: FIXTURE_PASSWORD })
      .expect(200);
    const cookies = res.get('set-cookie');
    if (!cookies) {
      throw new Error(`Sign-in for ${email} did not return a session cookie`);
    }
    const normalized = Array.isArray(cookies) ? cookies : [cookies];
    sessionCookies.set(email, normalized);
    return normalized;
  }

  /** The attached Product ids of a serialized enquiry, order-independent. */
  function attachedIds(body: { products: { productId: string }[] }): string[] {
    return body.products.map((product) => product.productId).sort();
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
      data: { name: `EnqProd Org A ${runId}`, slug: `enq-products-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `EnqProd Org B ${runId}`, slug: `enq-products-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `enqprod-super-${runId}@test.local`,
      name: 'EnqProd Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    salesUser = await createFixtureUser({
      email: `enqprod-sales-${runId}@test.local`,
      name: 'EnqProd Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgAdmin = await createFixtureUser({
      email: `enqprod-other-admin-${runId}@test.local`,
      name: 'EnqProd Other Org Admin',
      organizationId: orgB.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    clientA = await createFixtureClient(orgA.id);
    clientB = await createFixtureClient(orgB.id);

    groupA = await prisma.productGroup.create({
      data: { organizationId: orgA.id, name: `EnqProd Group A ${runId}` },
    });
    groupB = await prisma.productGroup.create({
      data: { organizationId: orgB.id, name: `EnqProd Group B ${runId}` },
    });

    productA1 = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `AAA Product ${uid()}`,
      price: 1000.25,
      sku: 'SKU-A1',
      unit: 'licence',
    });
    productA2 = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `BBB Product ${uid()}`,
    });
    productA3 = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `CCC Product ${uid()}`,
    });
    productAInactive = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `DDD Inactive Product ${uid()}`,
      status: 'INACTIVE',
    });
    productB = await createFixtureProduct({
      organizationId: orgB.id,
      productGroupId: groupB.id,
    });
  }, 30000);

  afterAll(async () => {
    // enquiry_product rows are onDelete: Cascade from enquiry, so removing
    // the enquiries clears the join rows and frees the products (whose FK
    // from the join side is Restrict).
    await prisma.enquiry.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.product.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.productGroup.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
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

  it('2. rejects creating an enquiry with products when unauthenticated', async () => {
    await request(app.getHttpServer())
      .post('/enquiries')
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(401);
  });

  it('3. rejects updating an enquiry products set when unauthenticated', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .send({ productIds: [productA1.id] })
      .expect(401);

    const untouched = await prisma.enquiryProduct.count({
      where: { enquiryId: created.body.id },
    });
    expect(untouched).toBe(0);
  });

  // -------------------------------------------------------------- create

  it('4. creates an enquiry with a single product', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);

    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].productId).toBe(productA1.id);

    const rows = await prisma.enquiryProduct.findMany({ where: { enquiryId: res.body.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].productId).toBe(productA1.id);
  });

  it('5. creates an enquiry with multiple products', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id, productA2.id, productA3.id] }))
      .expect(201);

    expect(attachedIds(res.body)).toEqual([productA1.id, productA2.id, productA3.id].sort());
  });

  it('6. creates an enquiry with no products at all', async () => {
    const cookies = await signIn(superAdmin.email);
    const withoutKey = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(withoutKey.body.products).toEqual([]);

    const withEmptyArray = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [] }))
      .expect(201);
    expect(withEmptyArray.body.products).toEqual([]);
  });

  it('7. resolves real product information from the Product relation, not stored names', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);

    const attached = created.body.products[0];
    expect(attached).toEqual({
      id: expect.any(String),
      productId: productA1.id,
      name: productA1.name,
      productGroup: { id: groupA.id, name: groupA.name },
      price: 1000.25,
      sku: 'SKU-A1',
      unit: 'licence',
      status: 'ACTIVE',
    });
    // The join row itself stores only ids — no denormalized product columns.
    const row = await prisma.enquiryProduct.findFirstOrThrow({
      where: { enquiryId: created.body.id },
    });
    expect(Object.keys(row).sort()).toEqual(
      ['createdAt', 'enquiryId', 'id', 'productId'].sort(),
    );
  });

  it('8. a renamed product is reflected on the enquiry without touching the join row', async () => {
    const cookies = await signIn(superAdmin.email);
    const renameable = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `Before Rename ${uid()}`,
    });
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [renameable.id] }))
      .expect(201);

    const newName = `After Rename ${uid()}`;
    await prisma.product.update({ where: { id: renameable.id }, data: { name: newName } });

    const res = await request(app.getHttpServer())
      .get(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.products[0].name).toBe(newName);
  });

  // ----------------------------------------------------------------- read

  it('9. GET /enquiries/:id returns the attached products', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id, productA2.id] }))
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(attachedIds(res.body)).toEqual([productA1.id, productA2.id].sort());
    // Prisma internals must not leak through the serializer.
    expect(res.body.enquiryProducts).toBeUndefined();
  });

  it('10. GET /enquiries includes the products on every listed enquiry', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA2.id] }))
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/enquiries?pageSize=100')
      .set('Cookie', cookies)
      .expect(200);

    const found = list.body.data.find((e: { id: string }) => e.id === created.body.id);
    expect(found).toBeDefined();
    expect(attachedIds(found)).toEqual([productA2.id]);
    for (const enquiry of list.body.data) {
      expect(Array.isArray(enquiry.products)).toBe(true);
    }
  });

  // -------------------------------------------------------------- update

  it('11. PATCH adds a product to an existing enquiry', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id, productA2.id] })
      .expect(200);

    expect(attachedIds(updated.body)).toEqual([productA1.id, productA2.id].sort());
  });

  it('12. PATCH removes a product from an existing enquiry', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id, productA2.id] }))
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA2.id] })
      .expect(200);

    expect(attachedIds(updated.body)).toEqual([productA2.id]);
    const rows = await prisma.enquiryProduct.findMany({ where: { enquiryId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it('13. PATCH replaces the entire product set', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id, productA2.id] }))
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA3.id] })
      .expect(200);
    expect(attachedIds(updated.body)).toEqual([productA3.id]);

    // and an empty array detaches everything
    const cleared = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [] })
      .expect(200);
    expect(cleared.body.products).toEqual([]);
    expect(await prisma.enquiryProduct.count({ where: { enquiryId: created.body.id } })).toBe(0);
  }, 30000);

  it('14. omitting productIds leaves the attached products untouched', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id, productA2.id] }))
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ title: 'Renamed but products untouched' })
      .expect(200);

    expect(updated.body.title).toBe('Renamed but products untouched');
    expect(attachedIds(updated.body)).toEqual([productA1.id, productA2.id].sort());
  });

  it('15. changing products leaves every other enquiry field unchanged', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(
        basePayload({
          productIds: [productA1.id],
          tags: ['renewal'],
          description: 'Original description',
          assignedToId: salesUser.id,
        }),
      )
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA2.id, productA3.id] })
      .expect(200);

    expect(updated.body.title).toBe(created.body.title);
    expect(updated.body.clientId).toBe(clientA.id);
    expect(updated.body.stage).toBe(created.body.stage);
    expect(updated.body.expectedRevenue).toBe(created.body.expectedRevenue);
    expect(updated.body.probability).toBe(created.body.probability);
    expect(updated.body.priority).toBe(created.body.priority);
    expect(updated.body.source).toBe(created.body.source);
    expect(updated.body.description).toBe('Original description');
    expect(updated.body.tags).toEqual(['renewal']);
    expect(updated.body.assignedTo.id).toBe(salesUser.id);
    expect(updated.body.createdAt).toBe(created.body.createdAt);
  });

  it('16. a Sales Executive can attach products to an enquiry', async () => {
    // Enquiry authorization is unchanged by this phase: all three roles
    // create/update enquiries. Products stay read-only for a Sales Executive
    // through the Products API — referencing one from an enquiry is a read.
    //
    // Phase 19: a Sales Executive may only create against a client assigned
    // to themselves — basePayload()'s default clientId (clientA) is
    // unassigned, so a client owned by salesUser is used here instead.
    const ownClient = await createFixtureClient(orgA.id);
    await prisma.client.update({ where: { id: ownClient.id }, data: { assignedToId: salesUser.id } });

    const cookies = await signIn(salesUser.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ clientId: ownClient.id, productIds: [productA1.id] }))
      .expect(201);
    expect(attachedIds(created.body)).toEqual([productA1.id]);

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA2.id] })
      .expect(200);
    expect(attachedIds(updated.body)).toEqual([productA2.id]);

    // ...but still cannot write the product catalogue itself.
    await request(app.getHttpServer())
      .patch(`/products/${productA1.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Renamed by sales exec' })
      .expect(403);
  }, 30000);

  // --------------------------------------------------- duplicate handling

  it('17. rejects duplicate product ids on create and writes nothing', async () => {
    const cookies = await signIn(superAdmin.email);
    const title = `Duplicate create ${uid()}`;
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ title, productIds: [productA1.id, productA1.id] }))
      .expect(400);

    expect(await prisma.enquiry.findFirst({ where: { title } })).toBeNull();
  });

  it('18. rejects duplicate product ids on update and leaves the set unchanged', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA2.id, productA2.id] })
      .expect(400);

    const rows = await prisma.enquiryProduct.findMany({ where: { enquiryId: created.body.id } });
    expect(rows.map((row) => row.productId)).toEqual([productA1.id]);
  });

  it('19. re-sending an already attached product does not create a second row', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);
    const originalRow = await prisma.enquiryProduct.findFirstOrThrow({
      where: { enquiryId: created.body.id },
    });

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id, productA2.id] })
      .expect(200);
    expect(updated.body.products).toHaveLength(2);

    const rows = await prisma.enquiryProduct.findMany({ where: { enquiryId: created.body.id } });
    expect(rows).toHaveLength(2);
    // The pre-existing link was left in place, not deleted and recreated.
    const kept = rows.find((row) => row.productId === productA1.id);
    expect(kept?.id).toBe(originalRow.id);
  });

  it('20. the database rejects a duplicate link even if inserted directly', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);

    await expect(
      prisma.enquiryProduct.create({
        data: { enquiryId: created.body.id, productId: productA1.id },
      }),
    ).rejects.toThrow();
  });

  // ------------------------------------------------ organization isolation

  it('21. rejects a product from another organization on create', async () => {
    const cookies = await signIn(superAdmin.email);
    const title = `Cross org create ${uid()}`;
    const res = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ title, productIds: [productB.id] }))
      .expect(400);

    // Reported as unknown — never "belongs to another organization", which
    // would confirm the id exists somewhere else.
    expect(String(res.body.message)).toContain('Unknown');
    expect(await prisma.enquiry.findFirst({ where: { title } })).toBeNull();
    expect(await prisma.enquiryProduct.count({ where: { productId: productB.id } })).toBe(0);
  });

  it('22. rejects a product from another organization on update', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id, productB.id] })
      .expect(400);

    const rows = await prisma.enquiryProduct.findMany({ where: { enquiryId: created.body.id } });
    expect(rows.map((row) => row.productId)).toEqual([productA1.id]);
  });

  it('23. rejects a mixed valid/cross-org product list atomically', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id, productA2.id, productB.id] })
      .expect(400);

    // Not even the valid ids were attached.
    expect(await prisma.enquiryProduct.count({ where: { enquiryId: created.body.id } })).toBe(0);
  });

  it('24. an enquiry from another organization returns 404 when its products are edited', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBEnquiry = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookiesB)
      .send({ ...basePayload(), clientId: clientB.id, productIds: [productB.id] })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/enquiries/${orgBEnquiry.body.id}`)
      .set('Cookie', cookiesA)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/enquiries/${orgBEnquiry.body.id}`)
      .set('Cookie', cookiesA)
      .send({ productIds: [productA1.id] })
      .expect(404);

    // Org B's enquiry kept its own product and gained nothing.
    const rows = await prisma.enquiryProduct.findMany({
      where: { enquiryId: orgBEnquiry.body.id },
    });
    expect(rows.map((row) => row.productId)).toEqual([productB.id]);
  }, 30000);

  it('25. a body-supplied organizationId is rejected, products or not', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ organizationId: orgB.id, productIds: [productA1.id] }))
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ organizationId: orgB.id, productIds: [productA2.id] })
      .expect(400);

    const unchanged = await prisma.enquiry.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(unchanged.organizationId).toBe(orgA.id);
  }, 30000);

  // ------------------------------------------------------- product status

  it('26. an ACTIVE product can be attached', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);
    expect(res.body.products[0].status).toBe('ACTIVE');
  });

  it('27. an INACTIVE product cannot be newly attached on create or update', async () => {
    const cookies = await signIn(superAdmin.email);
    const title = `Inactive create ${uid()}`;
    const rejected = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ title, productIds: [productAInactive.id] }))
      .expect(400);
    expect(String(rejected.body.message)).toContain('Inactive');
    expect(await prisma.enquiry.findFirst({ where: { title } })).toBeNull();

    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id] }))
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id, productAInactive.id] })
      .expect(400);
    expect(await prisma.enquiryProduct.count({ where: { enquiryId: created.body.id } })).toBe(1);
  }, 30000);

  it('28. a product deactivated after attachment stays attached and keeps being returned', async () => {
    const cookies = await signIn(superAdmin.email);
    const laterDeactivated = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `Deactivated later ${uid()}`,
    });

    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id, laterDeactivated.id] }))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${laterDeactivated.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(attachedIds(detail.body)).toEqual([productA1.id, laterDeactivated.id].sort());
    const inactiveEntry = detail.body.products.find(
      (product: { productId: string }) => product.productId === laterDeactivated.id,
    );
    expect(inactiveEntry.status).toBe('INACTIVE');
  }, 30000);

  it('29. re-saving an enquiry that still lists a now-inactive product keeps it', async () => {
    const cookies = await signIn(superAdmin.email);
    const laterDeactivated = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `Kept inactive ${uid()}`,
    });
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id, laterDeactivated.id] }))
      .expect(201);
    await prisma.product.update({
      where: { id: laterDeactivated.id },
      data: { status: 'INACTIVE' },
    });

    // The exact set the edit form would send back untouched.
    const resaved = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ title: 'Edited with inactive product', productIds: [productA1.id, laterDeactivated.id] })
      .expect(200);
    expect(attachedIds(resaved.body)).toEqual([productA1.id, laterDeactivated.id].sort());

    // ...and so does adding another active product alongside it.
    const extended = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id, laterDeactivated.id, productA2.id] })
      .expect(200);
    expect(attachedIds(extended.body)).toEqual(
      [productA1.id, laterDeactivated.id, productA2.id].sort(),
    );
  }, 30000);

  it('30. editing other fields never silently drops an inactive attached product', async () => {
    const cookies = await signIn(superAdmin.email);
    const laterDeactivated = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `Untouched inactive ${uid()}`,
    });
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [laterDeactivated.id] }))
      .expect(201);
    await prisma.product.update({
      where: { id: laterDeactivated.id },
      data: { status: 'INACTIVE' },
    });

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ probability: 90 })
      .expect(200);
    expect(attachedIds(updated.body)).toEqual([laterDeactivated.id]);

    const staged = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}/stage`)
      .set('Cookie', cookies)
      .send({ stage: 'NEGOTIATION' })
      .expect(200);
    expect(attachedIds(staged.body)).toEqual([laterDeactivated.id]);
  }, 30000);

  it('31. an inactive attached product can be removed on purpose', async () => {
    const cookies = await signIn(superAdmin.email);
    const laterDeactivated = await createFixtureProduct({
      organizationId: orgA.id,
      productGroupId: groupA.id,
      name: `Removable inactive ${uid()}`,
    });
    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id, laterDeactivated.id] }))
      .expect(201);
    await prisma.product.update({
      where: { id: laterDeactivated.id },
      data: { status: 'INACTIVE' },
    });

    const updated = await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id] })
      .expect(200);
    expect(attachedIds(updated.body)).toEqual([productA1.id]);

    // ...and once removed it cannot be added back while inactive.
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id, laterDeactivated.id] })
      .expect(400);
  }, 30000);

  // ---------------------------------------------------------- validation

  it('32. rejects an unknown product id', async () => {
    const cookies = await signIn(superAdmin.email);
    const title = `Unknown product ${uid()}`;
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ title, productIds: ['prdnonexistent0000000000'] }))
      .expect(400);
    expect(await prisma.enquiry.findFirst({ where: { title } })).toBeNull();

    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: ['prdnonexistent0000000000'] })
      .expect(400);
  }, 30000);

  it('33. rejects malformed productIds', async () => {
    const cookies = await signIn(superAdmin.email);
    for (const productIds of [
      'not-an-array',
      [123],
      [''],
      [null],
      [{ id: productA1.id }],
      Array.from({ length: 101 }, () => productA1.id),
    ]) {
      await request(app.getHttpServer())
        .post('/enquiries')
        .set('Cookie', cookies)
        .send(basePayload({ productIds }))
        .expect(400);
    }
  }, 40000);

  it('34. rejects unknown fields alongside productIds', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload({ productIds: [productA1.id], productNames: ['ERP Suite'] }))
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/enquiries/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ productIds: [productA1.id], enquiryProducts: [] })
      .expect(400);
  }, 30000);

  it('35. rejects a malformed request body outright', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/enquiries')
      .set('Cookie', cookies)
      .set('Content-Type', 'application/json')
      .send('{"title": "broken"')
      .expect(400);
  });
});
