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
const currentYear = new Date().getFullYear();

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

function createFixtureClient(organizationId: string, overrides: Record<string, unknown> = {}) {
  return prisma.client.create({
    data: {
      organizationId,
      companyName: `Fixture Client ${uid()}`,
      industry: 'IT Services',
      email: `client-${uid()}@test.local`,
      phone: '+919876500000',
      addressLine1: '123 Business Park',
      addressCity: 'Mumbai',
      addressState: 'Maharashtra',
      addressPincode: '400001',
      ...overrides,
    },
  });
}

function createFixtureProductGroup(organizationId: string) {
  return prisma.productGroup.create({
    data: { organizationId, name: `Fixture Group ${uid()}` },
  });
}

function createFixtureProduct(
  organizationId: string,
  productGroupId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.product.create({
    data: {
      organizationId,
      productGroupId,
      name: `Fixture Product ${uid()}`,
      price: 100,
      ...overrides,
    },
  });
}

function createFixtureEnquiry(organizationId: string, clientId: string, overrides: Record<string, unknown> = {}) {
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

describe('QuotationsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let otherOrgAdmin: { id: string; email: string };

  let clientA: { id: string; companyName: string };
  let clientA2: { id: string; companyName: string };
  let clientB: { id: string; companyName: string };
  let groupA: { id: string };
  let groupB: { id: string };
  let productA: { id: string; name: string; price: unknown };
  let productB: { id: string };
  let enquiryA: { id: string; clientId: string; title: string };
  let enquiryA2: { id: string; clientId: string };
  let enquiryB: { id: string };

  function baseQuotationPayload(overrides: Record<string, unknown> = {}) {
    return {
      clientId: clientA.id,
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      lineItems: [{ productId: productA.id, quantity: 2, discountPercentage: 10, taxRate: 18 }],
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
      data: { name: `Quote Org A ${runId}`, slug: `quotations-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Quote Org B ${runId}`, slug: `quotations-test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `quote-super-${runId}@test.local`,
      name: 'Quote Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `quote-admin-${runId}@test.local`,
      name: 'Quote Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `quote-sales-${runId}@test.local`,
      name: 'Quote Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgAdmin = await createFixtureUser({
      email: `quote-other-admin-${runId}@test.local`,
      name: 'Quote Other Org Admin',
      organizationId: orgB.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    clientA = await createFixtureClient(orgA.id);
    clientA2 = await createFixtureClient(orgA.id);
    clientB = await createFixtureClient(orgB.id);

    groupA = await createFixtureProductGroup(orgA.id);
    groupB = await createFixtureProductGroup(orgB.id);
    productA = await createFixtureProduct(orgA.id, groupA.id, { name: 'Fixture Widget', price: 100 });
    productB = await createFixtureProduct(orgB.id, groupB.id);

    enquiryA = await createFixtureEnquiry(orgA.id, clientA.id);
    enquiryA2 = await createFixtureEnquiry(orgA.id, clientA2.id);
    enquiryB = await createFixtureEnquiry(orgB.id, clientB.id);
  }, 30000);

  afterAll(async () => {
    // Quotation.clientId/productId are Restrict, enquiryId/assignedToId are
    // SetNull — quotations (and their cascaded line items) must be removed
    // before clients/products/enquiries/users/orgs.
    await prisma.quotation.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.quotationNumberCounter.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.enquiry.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.product.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.productGroup.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  // ---------------------------------------------------------- auth/authz

  it('1. rejects GET /quotations when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/quotations').expect(401);
  });

  it('2. rejects POST /quotations when unauthenticated', async () => {
    await request(app.getHttpServer()).post('/quotations').send(baseQuotationPayload()).expect(401);
  });

  it('3. allows a Super Admin to create a quotation, assigned to their org, starting DRAFT', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload())
      .expect(201);

    expect(res.body.organizationId).toBe(orgA.id);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.clientId).toBe(clientA.id);
    expect(res.body.clientName).toBe(clientA.companyName);
    expect(res.body.quotationNumber).toMatch(/^QT-\d{4}-\d{4}$/);
    expect(res.body.enquiryId).toBeNull();
  });

  it('4. allows an Admin to create a quotation', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload())
      .expect(201);
    expect(res.body.organizationId).toBe(orgA.id);
  });

  it('5. rejects a Sales Executive creating, updating, or changing status of a quotation, but allows read', async () => {
    const adminCookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', adminCookies)
      .send(baseQuotationPayload())
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', salesCookies)
      .send(baseQuotationPayload())
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ notes: 'blocked' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}/status`)
      .set('Cookie', salesCookies)
      .send({ status: 'SENT' })
      .expect(403);
    // read is allowed for all three roles
    await request(app.getHttpServer())
      .get(`/quotations/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(200);
    await request(app.getHttpServer()).get('/quotations').set('Cookie', salesCookies).expect(200);
  });

  // ---------------------------------------------------------- line items

  it('6. supports an ad-hoc line with no productId, snapshotting the supplied name/price directly', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(
        baseQuotationPayload({
          lineItems: [{ productName: 'Custom Installation', unitPrice: 4500, quantity: 1 }],
        }),
      )
      .expect(201);

    expect(res.body.lineItems).toHaveLength(1);
    expect(res.body.lineItems[0].productId).toBeNull();
    expect(res.body.lineItems[0].productNameSnapshot).toBe('Custom Installation');
    expect(res.body.lineItems[0].unitPriceSnapshot).toBe(4500);
  });

  it('7. supports a catalog line, snapshotting the live Product name/price rather than trusting client input', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(
        baseQuotationPayload({
          // productName/unitPrice supplied here must be ignored — the
          // service must snapshot the *real* Product's name/price instead.
          lineItems: [
            { productId: productA.id, productName: 'Forged Name', unitPrice: 1, quantity: 1 },
          ],
        }),
      )
      .expect(201);

    expect(res.body.lineItems[0].productId).toBe(productA.id);
    expect(res.body.lineItems[0].productNameSnapshot).toBe(productA.name);
    expect(res.body.lineItems[0].unitPriceSnapshot).toBe(Number(productA.price));
  });

  it('8. supports multiple line items mixing catalog and ad-hoc lines', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(
        baseQuotationPayload({
          lineItems: [
            { productId: productA.id, quantity: 1 },
            { productName: 'Ad-hoc Line', unitPrice: 200, quantity: 1 },
          ],
        }),
      )
      .expect(201);
    expect(res.body.lineItems).toHaveLength(2);
  });

  it('9. rejects an inactive Product for a NEW quotation line, but an existing quotation referencing it remains readable', async () => {
    const cookies = await signIn(superAdmin.email);
    const product = await createFixtureProduct(orgA.id, groupA.id, { name: 'Soon Inactive', price: 250 });

    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: product.id, quantity: 1 }] }))
      .expect(201);
    expect(created.body.lineItems[0].unitPriceSnapshot).toBe(250);

    await prisma.product.update({ where: { id: product.id }, data: { status: 'INACTIVE' } });

    // existing quotation stays fully readable, snapshot untouched
    const stillReadable = await request(app.getHttpServer())
      .get(`/quotations/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(stillReadable.body.lineItems[0].unitPriceSnapshot).toBe(250);
    expect(stillReadable.body.lineItems[0].productNameSnapshot).toBe('Soon Inactive');

    // a NEW quotation line cannot use the now-inactive product
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: product.id, quantity: 1 }] }))
      .expect(400);
  });

  it('10. product price/name changes after quotation creation never mutate the historical snapshot', async () => {
    const cookies = await signIn(superAdmin.email);
    const product = await createFixtureProduct(orgA.id, groupA.id, { name: 'Machine A', price: 100 });

    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: product.id, quantity: 1 }] }))
      .expect(201);
    expect(created.body.lineItems[0].productNameSnapshot).toBe('Machine A');
    expect(created.body.lineItems[0].unitPriceSnapshot).toBe(100);

    await prisma.product.update({ where: { id: product.id }, data: { name: 'Machine B', price: 200 } });

    const reFetched = await request(app.getHttpServer())
      .get(`/quotations/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(reFetched.body.lineItems[0].productNameSnapshot).toBe('Machine A');
    expect(reFetched.body.lineItems[0].unitPriceSnapshot).toBe(100);

    const liveProduct = await request(app.getHttpServer())
      .get(`/products/${product.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(liveProduct.body.name).toBe('Machine B');
    expect(liveProduct.body.price).toBe(200);
  });

  // ---------------------------------------------------------- calculations

  it('11. calculates gross/discount/tax/lineAmount per line and totals using Decimal-safe rounding', async () => {
    const cookies = await signIn(superAdmin.email);
    const product = await createFixtureProduct(orgA.id, groupA.id, { name: 'Calc Product', price: 19.99 });

    const res = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(
        baseQuotationPayload({
          lineItems: [{ productId: product.id, quantity: 3, discountPercentage: 12.5, taxRate: 18 }],
        }),
      )
      .expect(201);

    const line = res.body.lineItems[0];
    // gross = 19.99 * 3 = 59.97
    // discount = 59.97 * 12.5% = 7.49625 -> rounds to 7.50
    // taxable = 59.97 - 7.50 = 52.47
    // tax = 52.47 * 18% = 9.4446 -> rounds to 9.44
    // lineAmount = 52.47 + 9.44 = 61.91
    expect(line.lineAmount).toBeCloseTo(61.91, 2);
    expect(res.body.subtotal).toBeCloseTo(59.97, 2);
    expect(res.body.discountAmount).toBeCloseTo(7.5, 2);
    expect(res.body.taxAmount).toBeCloseTo(9.44, 2);
    expect(res.body.grandTotal).toBeCloseTo(61.91, 2);
  });

  it('12. totals across multiple lines sum each line correctly (subtotal - discountAmount + taxAmount = grandTotal)', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(
        baseQuotationPayload({
          lineItems: [
            { productName: 'Line 1', unitPrice: 100, quantity: 2, discountPercentage: 0, taxRate: 0 },
            { productName: 'Line 2', unitPrice: 50, quantity: 4, discountPercentage: 20, taxRate: 5 },
          ],
        }),
      )
      .expect(201);

    // Line 1: gross 200, discount 0, taxable 200, tax 0, amount 200
    // Line 2: gross 200, discount 40, taxable 160, tax 8, amount 168
    expect(res.body.subtotal).toBeCloseTo(400, 2);
    expect(res.body.discountAmount).toBeCloseTo(40, 2);
    expect(res.body.taxAmount).toBeCloseTo(8, 2);
    expect(res.body.grandTotal).toBeCloseTo(368, 2);
    expect(
      res.body.subtotal - res.body.discountAmount + res.body.taxAmount,
    ).toBeCloseTo(res.body.grandTotal, 2);
  });

  // ---------------------------------------------------------- validation

  it('13. rejects negative, zero, and over-precision quantity', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: -1 }] }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: 0 }] }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: 1.234 }] }))
      .expect(400);
    // Number("Infinity") after @Type(() => Number) coercion must still be rejected.
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: 'Infinity' }] }))
      .expect(400);
  });

  it('14. rejects a negative ad-hoc unitPrice and a missing productName/unitPrice when productId is absent', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productName: 'X', unitPrice: -5, quantity: 1 }] }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ quantity: 1 }] }))
      .expect(400);
  });

  it('15. rejects out-of-range discountPercentage and taxRate', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: 1, discountPercentage: -1 }] }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: 1, discountPercentage: 101 }] }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: 1, taxRate: -1 }] }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: 1, taxRate: 101 }] }))
      .expect(400);
  });

  it('16. rejects an empty lineItems array, a missing clientId, and a missing validUntil', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [] }))
      .expect(400);

    const noClient = baseQuotationPayload();
    delete (noClient as Record<string, unknown>).clientId;
    await request(app.getHttpServer()).post('/quotations').set('Cookie', cookies).send(noClient).expect(400);

    const noValidUntil = baseQuotationPayload();
    delete (noValidUntil as Record<string, unknown>).validUntil;
    await request(app.getHttpServer()).post('/quotations').set('Cookie', cookies).send(noValidUntil).expect(400);
  });

  it('17. rejects unknown DTO fields and a body-supplied organizationId/quotationNumber', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ notARealField: 'nope' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ organizationId: orgB.id }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ quotationNumber: 'QT-2000-9999' }))
      .expect(400);
  });

  // ---------------------------------------------------------- tenant isolation

  it('18. rejects a clientId belonging to another organization', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ clientId: clientB.id }))
      .expect(400);
  });

  it('19. rejects a productId belonging to another organization', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productB.id, quantity: 1 }] }))
      .expect(400);
  });

  it('20. rejects an enquiryId belonging to another organization', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ enquiryId: enquiryB.id }))
      .expect(400);
  });

  it('21. rejects an enquiryId that belongs to a different client than the quotation', async () => {
    const cookies = await signIn(superAdmin.email);
    // enquiryA belongs to clientA, not clientA2
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ clientId: clientA2.id, enquiryId: enquiryA.id }))
      .expect(400);
  });

  it('22. rejects an assignedToId belonging to another organization, accepts one from the caller org', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ assignedToId: otherOrgAdmin.id }))
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ assignedToId: salesUser.id }))
      .expect(201);
    expect(created.body.assignedTo.id).toBe(salesUser.id);
  });

  it('23. GET /quotations/:id for another organization returns 404', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBQuotation = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookiesB)
      .send({
        clientId: clientB.id,
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        lineItems: [{ productId: productB.id, quantity: 1 }],
      })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/quotations/${orgBQuotation.body.id}`)
      .set('Cookie', cookiesA)
      .expect(404);
  });

  it('24. PATCH /quotations/:id for another organization returns 404 and does not mutate', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBQuotation = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookiesB)
      .send({
        clientId: clientB.id,
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Original',
        lineItems: [{ productId: productB.id, quantity: 1 }],
      })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch(`/quotations/${orgBQuotation.body.id}`)
      .set('Cookie', cookiesA)
      .send({ notes: 'Hijacked' })
      .expect(404);

    const unchanged = await prisma.quotation.findUniqueOrThrow({ where: { id: orgBQuotation.body.id } });
    expect(unchanged.notes).toBe('Original');
  });

  it('25. GET /quotations returns only the caller organization records', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBQuotation = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookiesB)
      .send({
        clientId: clientB.id,
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        lineItems: [{ productId: productB.id, quantity: 1 }],
      })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    const listRes = await request(app.getHttpServer())
      .get('/quotations?pageSize=100')
      .set('Cookie', cookiesA)
      .expect(200);

    const ids: string[] = listRes.body.data.map((q: { id: string }) => q.id);
    expect(ids).not.toContain(orgBQuotation.body.id);
    for (const quotation of listRes.body.data) {
      expect(quotation.organizationId).toBe(orgA.id);
    }
  });

  // ---------------------------------------------------------- enquiry linkage

  it('26. a quotation can exist without an enquiry, and can reference one', async () => {
    const cookies = await signIn(superAdmin.email);
    const withoutEnquiry = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload())
      .expect(201);
    expect(withoutEnquiry.body.enquiryId).toBeNull();

    const withEnquiry = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ enquiryId: enquiryA.id }))
      .expect(201);
    expect(withEnquiry.body.enquiryId).toBe(enquiryA.id);
    expect(withEnquiry.body.enquiryTitle).toBe(enquiryA.title);
  });

  it('27. one enquiry can have multiple quotations', async () => {
    const cookies = await signIn(superAdmin.email);
    const first = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ enquiryId: enquiryA.id }))
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ enquiryId: enquiryA.id }))
      .expect(201);

    expect(first.body.id).not.toBe(second.body.id);

    const listRes = await request(app.getHttpServer())
      .get(`/quotations?enquiryId=${enquiryA.id}&pageSize=100`)
      .set('Cookie', cookies)
      .expect(200);
    const ids: string[] = listRes.body.data.map((q: { id: string }) => q.id);
    expect(ids).toEqual(expect.arrayContaining([first.body.id, second.body.id]));
  });

  // ---------------------------------------------------------- numbering

  it('28. quotation numbers are sequential per organization/year and isolated across organizations', async () => {
    const numOrgA = await prisma.organization.create({
      data: { name: `Numbering Org A ${runId}`, slug: `quotations-num-org-a-${runId}` },
    });
    const numOrgB = await prisma.organization.create({
      data: { name: `Numbering Org B ${runId}`, slug: `quotations-num-org-b-${runId}` },
    });
    try {
      const numAdminA = await createFixtureUser({
        email: `quote-num-admin-a-${runId}@test.local`,
        name: 'Num Admin A',
        organizationId: numOrgA.id,
        role: 'ADMIN',
        department: 'Operations',
      });
      const numAdminB = await createFixtureUser({
        email: `quote-num-admin-b-${runId}@test.local`,
        name: 'Num Admin B',
        organizationId: numOrgB.id,
        role: 'ADMIN',
        department: 'Operations',
      });
      const numClientA = await createFixtureClient(numOrgA.id);
      const numClientB = await createFixtureClient(numOrgB.id);
      const numGroupA = await createFixtureProductGroup(numOrgA.id);
      const numGroupB = await createFixtureProductGroup(numOrgB.id);
      const numProductA = await createFixtureProduct(numOrgA.id, numGroupA.id);
      const numProductB = await createFixtureProduct(numOrgB.id, numGroupB.id);

      const cookiesA = await signIn(numAdminA.email);
      const cookiesB = await signIn(numAdminB.email);

      const payload = (clientId: string, productId: string) => ({
        clientId,
        validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        lineItems: [{ productId, quantity: 1 }],
      });

      const a1 = await request(app.getHttpServer())
        .post('/quotations')
        .set('Cookie', cookiesA)
        .send(payload(numClientA.id, numProductA.id))
        .expect(201);
      const a2 = await request(app.getHttpServer())
        .post('/quotations')
        .set('Cookie', cookiesA)
        .send(payload(numClientA.id, numProductA.id))
        .expect(201);
      const b1 = await request(app.getHttpServer())
        .post('/quotations')
        .set('Cookie', cookiesB)
        .send(payload(numClientB.id, numProductB.id))
        .expect(201);

      expect(a1.body.quotationNumber).toBe(`QT-${currentYear}-0001`);
      expect(a2.body.quotationNumber).toBe(`QT-${currentYear}-0002`);
      // isolated per organization — org B restarts at 0001 independently
      expect(b1.body.quotationNumber).toBe(`QT-${currentYear}-0001`);
    } finally {
      await prisma.quotation.deleteMany({ where: { organizationId: { in: [numOrgA.id, numOrgB.id] } } });
      await prisma.quotationNumberCounter.deleteMany({
        where: { organizationId: { in: [numOrgA.id, numOrgB.id] } },
      });
      await prisma.enquiry.deleteMany({ where: { organizationId: { in: [numOrgA.id, numOrgB.id] } } });
      await prisma.product.deleteMany({ where: { organizationId: { in: [numOrgA.id, numOrgB.id] } } });
      await prisma.productGroup.deleteMany({ where: { organizationId: { in: [numOrgA.id, numOrgB.id] } } });
      await prisma.client.deleteMany({ where: { organizationId: { in: [numOrgA.id, numOrgB.id] } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: [numOrgA.id, numOrgB.id] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [numOrgA.id, numOrgB.id] } } });
    }
  }, 30000);

  // ---------------------------------------------------------- update

  it('29. PATCH /quotations/:id updates simple fields without touching line items when lineItems is omitted', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ notes: 'Original notes' }))
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ notes: 'Updated notes', terms: 'Net 30' })
      .expect(200);

    expect(updated.body.notes).toBe('Updated notes');
    expect(updated.body.terms).toBe('Net 30');
    expect(updated.body.lineItems).toEqual(created.body.lineItems);
    expect(updated.body.grandTotal).toBe(created.body.grandTotal);
  });

  it('30. PATCH /quotations/:id with lineItems replaces the entire line-item set and recalculates totals', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productA.id, quantity: 1 }] }))
      .expect(201);
    const originalLineId = created.body.lineItems[0].id;

    const updated = await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ lineItems: [{ productName: 'Replacement Line', unitPrice: 300, quantity: 2 }] })
      .expect(200);

    expect(updated.body.lineItems).toHaveLength(1);
    expect(updated.body.lineItems[0].id).not.toBe(originalLineId);
    expect(updated.body.lineItems[0].productNameSnapshot).toBe('Replacement Line');
    expect(updated.body.grandTotal).toBe(600);
  });

  it('30b. re-saving an unchanged catalog line (same id, same productId) preserves its historical snapshot even after the Product price/name changes, while quantity edits on that same line still take effect', async () => {
    const cookies = await signIn(superAdmin.email);
    const product = await createFixtureProduct(orgA.id, groupA.id, { name: 'Snapshot Guard', price: 50 });

    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: product.id, quantity: 1 }] }))
      .expect(201);
    const lineId = created.body.lineItems[0].id;
    expect(created.body.lineItems[0].unitPriceSnapshot).toBe(50);

    await prisma.product.update({ where: { id: product.id }, data: { name: 'Renamed After Save', price: 999 } });

    // Resend the SAME line (matched by id, same productId) but with an
    // edited quantity, plus an unrelated notes change — the classic "edit
    // and resave the whole builder" flow the frontend must perform.
    const updated = await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}`)
      .set('Cookie', cookies)
      .send({
        notes: 'Touched unrelated field',
        lineItems: [{ id: lineId, productId: product.id, quantity: 3 }],
      })
      .expect(200);

    // Row identity is NOT guaranteed to survive a save (update() replaces
    // the entire line-item set, so even a "preserved" line gets a fresh
    // database id) — only its historical VALUES are guaranteed to survive,
    // which is the actual business rule under test here.
    expect(updated.body.lineItems).toHaveLength(1);
    // snapshot untouched despite the live Product now being renamed/repriced
    expect(updated.body.lineItems[0].productNameSnapshot).toBe('Snapshot Guard');
    expect(updated.body.lineItems[0].unitPriceSnapshot).toBe(50);
    // but the explicitly-edited quantity did take effect, recomputed against the OLD snapshot price
    expect(updated.body.lineItems[0].quantity).toBe(3);
    expect(updated.body.lineItems[0].lineAmount).toBe(150);
    expect(updated.body.grandTotal).toBe(150);
  });

  it('30c. swapping the productId on a matched line (id reused, product changed) takes a fresh snapshot', async () => {
    const cookies = await signIn(superAdmin.email);
    const productOld = await createFixtureProduct(orgA.id, groupA.id, { name: 'Old Product', price: 10 });
    const productNew = await createFixtureProduct(orgA.id, groupA.id, { name: 'New Product', price: 20 });

    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: productOld.id, quantity: 1 }] }))
      .expect(201);
    const lineId = created.body.lineItems[0].id;

    const updated = await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ lineItems: [{ id: lineId, productId: productNew.id, quantity: 1 }] })
      .expect(200);

    expect(updated.body.lineItems[0].productNameSnapshot).toBe('New Product');
    expect(updated.body.lineItems[0].unitPriceSnapshot).toBe(20);
  });

  it('30d. an already-attached line referencing a Product that has since gone INACTIVE can still be preserved/edited on update', async () => {
    const cookies = await signIn(superAdmin.email);
    const product = await createFixtureProduct(orgA.id, groupA.id, { name: 'Will Deactivate', price: 40 });

    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ lineItems: [{ productId: product.id, quantity: 1 }] }))
      .expect(201);
    const lineId = created.body.lineItems[0].id;

    await prisma.product.update({ where: { id: product.id }, data: { status: 'INACTIVE' } });

    const updated = await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ lineItems: [{ id: lineId, productId: product.id, quantity: 5 }] })
      .expect(200);

    expect(updated.body.lineItems[0].quantity).toBe(5);
    expect(updated.body.lineItems[0].unitPriceSnapshot).toBe(40);
  });

  it('31. editing is allowed regardless of quotation status (no status-gated edit restriction)', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'SENT' })
      .expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ notes: 'Edited after being sent' })
      .expect(200);
    expect(updated.body.notes).toBe('Edited after being sent');
    expect(updated.body.status).toBe('SENT');
  });

  // ---------------------------------------------------------- status

  it(
    '32. status can be set to DRAFT, SENT, ACCEPTED, REJECTED and EXPIRED, and is persisted',
    async () => {
      const cookies = await signIn(superAdmin.email);
      const created = await request(app.getHttpServer())
        .post('/quotations')
        .set('Cookie', cookies)
        .send(baseQuotationPayload())
        .expect(201);
      expect(created.body.status).toBe('DRAFT');

      for (const status of ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'DRAFT']) {
        const res = await request(app.getHttpServer())
          .patch(`/quotations/${created.body.id}/status`)
          .set('Cookie', cookies)
          .send({ status })
          .expect(200);
        expect(res.body.status).toBe(status);

        const persisted = await prisma.quotation.findUniqueOrThrow({ where: { id: created.body.id } });
        expect(persisted.status).toBe(status);
      }
    },
    40000,
  );

  it('33. status transitions are unrestricted — any status can move directly to any other status', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload())
      .expect(201);

    // DRAFT -> EXPIRED directly, skipping SENT/ACCEPTED/REJECTED entirely
    await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'EXPIRED' })
      .expect(200);
  });

  it('34. rejects an invalid status value', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/quotations/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'CANCELLED' })
      .expect(400);
  });

  // ---------------------------------------------------------- list/query

  it('35. search matches quotationNumber and client company name, status/clientId/enquiryId filters work, pagination is bounded', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/quotations')
      .set('Cookie', cookies)
      .send(baseQuotationPayload({ enquiryId: enquiryA.id }))
      .expect(201);

    const numberSearch = await request(app.getHttpServer())
      .get(`/quotations?search=${created.body.quotationNumber}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(numberSearch.body.data.map((q: { id: string }) => q.id)).toContain(created.body.id);

    const companySearch = await request(app.getHttpServer())
      .get(`/quotations?search=${encodeURIComponent(clientA.companyName)}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(companySearch.body.data.length).toBeGreaterThan(0);

    const clientFilter = await request(app.getHttpServer())
      .get(`/quotations?clientId=${clientA.id}&pageSize=100`)
      .set('Cookie', cookies)
      .expect(200);
    for (const quotation of clientFilter.body.data) {
      expect(quotation.clientId).toBe(clientA.id);
    }

    const statusFilter = await request(app.getHttpServer())
      .get('/quotations?status=DRAFT&pageSize=100')
      .set('Cookie', cookies)
      .expect(200);
    for (const quotation of statusFilter.body.data) {
      expect(quotation.status).toBe('DRAFT');
    }

    await request(app.getHttpServer()).get('/quotations?pageSize=101').set('Cookie', cookies).expect(400);
    await request(app.getHttpServer()).get('/quotations?pageSize=100').set('Cookie', cookies).expect(200);
  });
});
