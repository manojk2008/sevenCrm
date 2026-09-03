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

/**
 * A fixed date well before "now", used to prove that period filtering keys off
 * Quotation.createdAt. Deterministic rather than relative, so the month bucket
 * it lands in can be asserted exactly.
 */
const OLD_CREATED_AT = new Date('2024-01-15T00:00:00.000Z');

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

function createFixtureClient(organizationId: string, companyName?: string) {
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
    },
  });
}

interface SeedLine {
  productId: string | null;
  productNameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  discountPercentage: number;
  taxRate: number;
  lineAmount: number;
}

/**
 * Seeds a quotation straight through Prisma rather than the API.
 *
 * The Sales module is a pure aggregation layer, so these tests need rows with
 * exactly known totals, a controlled status, and (for the period tests) a
 * controlled createdAt — none of which POST /quotations will accept. Every
 * seeded total below is hand-computed with the same formula QuotationsService
 * persists, so the fixtures stay internally consistent:
 *
 *   gross = quantity * unitPriceSnapshot
 *   discount = gross * discountPercentage / 100
 *   taxable = gross - discount
 *   tax = taxable * taxRate / 100
 *   lineAmount = taxable + tax
 *   grandTotal = subtotal - discountAmount + taxAmount
 */
function seedQuotation(params: {
  organizationId: string;
  clientId: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  assignedToId?: string | null;
  createdAt?: Date;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  lines: SeedLine[];
}) {
  return prisma.quotation.create({
    data: {
      organizationId: params.organizationId,
      clientId: params.clientId,
      assignedToId: params.assignedToId ?? null,
      quotationNumber: `QT-TEST-${runId}-${uid()}`,
      status: params.status,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: params.subtotal,
      discountAmount: params.discountAmount,
      taxAmount: params.taxAmount,
      grandTotal: params.grandTotal,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
      lineItems: { create: params.lines },
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
      // enum value to default to anymore (see EnquirySource).
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  });
}

describe('SalesController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let orgEmpty: { id: string };

  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string; name: string };
  let salesUser: { id: string; email: string; name: string };
  let otherOrgAdmin: { id: string; email: string };
  let emptyOrgAdmin: { id: string; email: string };

  let clientA1: { id: string; companyName: string };
  let clientA2: { id: string; companyName: string };
  let clientB: { id: string };

  let groupA: { id: string };
  let productP1: { id: string; name: string };
  let productP2: { id: string; name: string };

  let lostEnquiryA: { id: string };

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
      data: { name: `Sales Org A ${runId}`, slug: `sales-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Sales Org B ${runId}`, slug: `sales-test-org-b-${runId}` },
    });
    orgEmpty = await prisma.organization.create({
      data: { name: `Sales Org Empty ${runId}`, slug: `sales-test-org-empty-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `sales-super-${runId}@test.local`,
      name: 'Sales Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `sales-admin-${runId}@test.local`,
      name: 'Sales Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `sales-exec-${runId}@test.local`,
      name: 'Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgAdmin = await createFixtureUser({
      email: `sales-other-admin-${runId}@test.local`,
      name: 'Sales Other Org Admin',
      organizationId: orgB.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    emptyOrgAdmin = await createFixtureUser({
      email: `sales-empty-admin-${runId}@test.local`,
      name: 'Sales Empty Org Admin',
      organizationId: orgEmpty.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    clientA1 = await createFixtureClient(orgA.id, `Alpha Industries ${runId}`);
    clientA2 = await createFixtureClient(orgA.id, `Beta Traders ${runId}`);
    clientB = await createFixtureClient(orgB.id);

    groupA = await prisma.productGroup.create({
      data: { organizationId: orgA.id, name: `Sales Group ${runId}` },
    });
    productP1 = await prisma.product.create({
      data: {
        organizationId: orgA.id,
        productGroupId: groupA.id,
        name: `Product P1 ${runId}`,
        price: 1000,
      },
    });
    productP2 = await prisma.product.create({
      data: {
        organizationId: orgA.id,
        productGroupId: groupA.id,
        name: `Product P2 ${runId}`,
        price: 500,
      },
    });

    // --- Org A quotations. Every figure below is hand-computed. ---

    // Q1 ACCEPTED, clientA1, assigned to the sales executive.
    //   line 1: P1 x2 @1000, 10% disc, 18% tax
    //           gross 2000, disc 200, taxable 1800, tax 324, lineAmount 2124
    //   line 2: ad-hoc x1 @500, 0% disc, 18% tax
    //           gross  500, disc   0, taxable  500, tax  90, lineAmount  590
    //   subtotal 2500, discount 200, tax 414, grandTotal 2714, net 2300
    await seedQuotation({
      organizationId: orgA.id,
      clientId: clientA1.id,
      status: 'ACCEPTED',
      assignedToId: salesUser.id,
      subtotal: 2500,
      discountAmount: 200,
      taxAmount: 414,
      grandTotal: 2714,
      lines: [
        {
          productId: productP1.id,
          productNameSnapshot: productP1.name,
          quantity: 2,
          unitPriceSnapshot: 1000,
          discountPercentage: 10,
          taxRate: 18,
          lineAmount: 2124,
        },
        {
          productId: null,
          productNameSnapshot: 'Custom onboarding',
          quantity: 1,
          unitPriceSnapshot: 500,
          discountPercentage: 0,
          taxRate: 18,
          lineAmount: 590,
        },
      ],
    });

    // Q2 ACCEPTED, clientA2, assigned to the admin.
    //   line: P2 x4 @500, 0% disc, 0% tax -> lineAmount 2000
    //   subtotal 2000, discount 0, tax 0, grandTotal 2000, net 2000
    await seedQuotation({
      organizationId: orgA.id,
      clientId: clientA2.id,
      status: 'ACCEPTED',
      assignedToId: adminUser.id,
      subtotal: 2000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 2000,
      lines: [
        {
          productId: productP2.id,
          productNameSnapshot: productP2.name,
          quantity: 4,
          unitPriceSnapshot: 500,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 2000,
        },
      ],
    });

    // Q3 SENT (open pipeline, never revenue). gross 10000.
    await seedQuotation({
      organizationId: orgA.id,
      clientId: clientA1.id,
      status: 'SENT',
      assignedToId: salesUser.id,
      subtotal: 10000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 10000,
      lines: [
        {
          productId: productP1.id,
          productNameSnapshot: productP1.name,
          quantity: 10,
          unitPriceSnapshot: 1000,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 10000,
        },
      ],
    });

    // Q4 REJECTED (decided, not accepted). gross 5000.
    await seedQuotation({
      organizationId: orgA.id,
      clientId: clientA1.id,
      status: 'REJECTED',
      subtotal: 5000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 5000,
      lines: [
        {
          productId: productP2.id,
          productNameSnapshot: productP2.name,
          quantity: 10,
          unitPriceSnapshot: 500,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 5000,
        },
      ],
    });

    // Q5 DRAFT (open pipeline). gross 1000.
    await seedQuotation({
      organizationId: orgA.id,
      clientId: clientA2.id,
      status: 'DRAFT',
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 1000,
      lines: [
        {
          productId: productP2.id,
          productNameSnapshot: productP2.name,
          quantity: 2,
          unitPriceSnapshot: 500,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 1000,
        },
      ],
    });

    // Q6 EXPIRED (decided, not accepted). gross 3000.
    await seedQuotation({
      organizationId: orgA.id,
      clientId: clientA1.id,
      status: 'EXPIRED',
      subtotal: 3000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 3000,
      lines: [
        {
          productId: productP1.id,
          productNameSnapshot: productP1.name,
          quantity: 3,
          unitPriceSnapshot: 1000,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 3000,
        },
      ],
    });

    // Q7 ACCEPTED but raised long ago, and deliberately UNASSIGNED — exercises
    // both the period filter and the "Unassigned" representative bucket.
    //   line: P2 x2 @500, 0% disc, 0% tax -> lineAmount 1000, net 1000
    await seedQuotation({
      organizationId: orgA.id,
      clientId: clientA1.id,
      status: 'ACCEPTED',
      assignedToId: null,
      createdAt: OLD_CREATED_AT,
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 1000,
      lines: [
        {
          productId: productP2.id,
          productNameSnapshot: productP2.name,
          quantity: 2,
          unitPriceSnapshot: 500,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 1000,
        },
      ],
    });

    // --- Org A enquiries: 1 WON, 1 LOST, 1 open. ---
    await createFixtureEnquiry(orgA.id, clientA1.id, {
      stage: 'WON',
      expectedRevenue: 50000,
    });
    lostEnquiryA = await createFixtureEnquiry(orgA.id, clientA2.id, {
      stage: 'LOST',
      lostReason: 'Budget constraints for this financial year',
      expectedRevenue: 30000,
    });
    await createFixtureEnquiry(orgA.id, clientA1.id, {
      stage: 'NEW',
      expectedRevenue: 20000,
    });

    // --- Org B: deliberately large, distinctive numbers. If any of these ever
    // appear in an Org A response, isolation has failed and it is obvious. ---
    await seedQuotation({
      organizationId: orgB.id,
      clientId: clientB.id,
      status: 'ACCEPTED',
      subtotal: 999999,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 999999,
      lines: [
        {
          productId: null,
          productNameSnapshot: 'Org B only line',
          quantity: 1,
          unitPriceSnapshot: 999999,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 999999,
        },
      ],
    });
    await createFixtureEnquiry(orgB.id, clientB.id, {
      stage: 'LOST',
      lostReason: 'Org B only lost reason',
      expectedRevenue: 888888,
    });
  }, 60000);

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id, orgEmpty.id];
    // Quotation.clientId/productId are Restrict and enquiryId/assignedToId are
    // SetNull — quotations (and their cascaded line items) must go before
    // clients/products/enquiries/users/orgs.
    await prisma.quotation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.quotationNumberCounter.deleteMany({
      where: { organizationId: { in: orgIds } },
    });
    await prisma.enquiry.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.product.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.productGroup.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await app.close();
    await prisma.$disconnect();
  }, 60000);

  // ------------------------------------------------------- authentication

  it('1. rejects every Sales route when unauthenticated', async () => {
    const routes = [
      '/sales/summary',
      '/sales/revenue-by-period',
      '/sales/revenue-by-client',
      '/sales/revenue-by-product',
      '/sales/revenue-by-representative',
      '/sales/lost-enquiries',
    ];
    for (const route of routes) {
      await request(app.getHttpServer()).get(route).expect(401);
    }
  });

  // -------------------------------------------------------- authorization

  it('2. allows a Super Admin to read every Sales route', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer()).get('/sales/summary').set('Cookie', cookies).expect(200);
    await request(app.getHttpServer())
      .get('/sales/revenue-by-period')
      .set('Cookie', cookies)
      .expect(200);
    await request(app.getHttpServer())
      .get('/sales/revenue-by-client')
      .set('Cookie', cookies)
      .expect(200);
    await request(app.getHttpServer())
      .get('/sales/revenue-by-product')
      .set('Cookie', cookies)
      .expect(200);
    await request(app.getHttpServer())
      .get('/sales/revenue-by-representative')
      .set('Cookie', cookies)
      .expect(200);
    await request(app.getHttpServer())
      .get('/sales/lost-enquiries')
      .set('Cookie', cookies)
      .expect(200);
  });

  it('3. allows an Admin to read every Sales route', async () => {
    const cookies = await signIn(adminUser.email);
    for (const route of [
      '/sales/summary',
      '/sales/revenue-by-period',
      '/sales/revenue-by-client',
      '/sales/revenue-by-product',
      '/sales/revenue-by-representative',
      '/sales/lost-enquiries',
    ]) {
      await request(app.getHttpServer()).get(route).set('Cookie', cookies).expect(200);
    }
  });

  it('4. allows a Sales Executive to read every Sales route', async () => {
    const cookies = await signIn(salesUser.email);
    for (const route of [
      '/sales/summary',
      '/sales/revenue-by-period',
      '/sales/revenue-by-client',
      '/sales/revenue-by-product',
      '/sales/revenue-by-representative',
      '/sales/lost-enquiries',
    ]) {
      await request(app.getHttpServer()).get(route).set('Cookie', cookies).expect(200);
    }
  });

  it('5. rejects a session whose user has since been deactivated', async () => {
    const email = `sales-deactivated-${runId}@test.local`;
    const doomed = await createFixtureUser({
      email,
      name: 'Sales Deactivated',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    const cookies = await signIn(email);
    await request(app.getHttpServer()).get('/sales/summary').set('Cookie', cookies).expect(200);

    await prisma.user.update({ where: { id: doomed.id }, data: { status: 'INACTIVE' } });
    await request(app.getHttpServer()).get('/sales/summary').set('Cookie', cookies).expect(401);
  });

  // ------------------------------------------------------- no write routes

  it('6. exposes no write routes on /sales', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .post('/sales/summary')
      .set('Cookie', cookies)
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .patch('/sales/summary')
      .set('Cookie', cookies)
      .send({})
      .expect(404);
    await request(app.getHttpServer()).delete('/sales/summary').set('Cookie', cookies).expect(404);
    await request(app.getHttpServer()).post('/sales').set('Cookie', cookies).send({}).expect(404);
  });

  // ------------------------------------------------------------- summary

  it('7. computes net and gross accepted revenue from ACCEPTED quotations only', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);

    // Q1 net 2300 + Q2 net 2000 + Q7 net 1000 = 5300
    expect(res.body.revenue.netAcceptedRevenue).toBe(5300);
    // Q1 gross 2714 + Q2 gross 2000 + Q7 gross 1000 = 5714
    expect(res.body.revenue.grossAcceptedValue).toBe(5714);
    expect(res.body.revenue.acceptedQuotationCount).toBe(3);
    // 5300 / 3, rounded to 2dp
    expect(res.body.revenue.averageAcceptedValue).toBe(1766.67);
    // Gross minus net is exactly the tax component (Q1's 414).
    expect(res.body.revenue.grossAcceptedValue - res.body.revenue.netAcceptedRevenue).toBe(414);
  });

  it('8. reports DRAFT + SENT as open pipeline and never as revenue', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);

    // Q3 SENT 10000 + Q5 DRAFT 1000
    expect(res.body.revenue.openPipelineValue).toBe(11000);
    expect(res.body.revenue.openQuotationCount).toBe(2);
    // The open pipeline is excluded from revenue entirely.
    expect(res.body.revenue.netAcceptedRevenue).toBe(5300);
  });

  it('9. breaks quotations down by status, zero-filling every enum value', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);

    const byStatus = Object.fromEntries(
      res.body.quotationStatusBreakdown.map((b: { status: string }) => [b.status, b]),
    );
    expect(Object.keys(byStatus).sort()).toEqual([
      'ACCEPTED',
      'DRAFT',
      'EXPIRED',
      'REJECTED',
      'SENT',
    ]);
    expect(byStatus.ACCEPTED.count).toBe(3);
    expect(byStatus.ACCEPTED.netValue).toBe(5300);
    expect(byStatus.ACCEPTED.grossValue).toBe(5714);
    expect(byStatus.SENT.count).toBe(1);
    expect(byStatus.DRAFT.count).toBe(1);
    expect(byStatus.REJECTED.count).toBe(1);
    expect(byStatus.EXPIRED.count).toBe(1);
  });

  it('10. computes the acceptance rate over decided quotations only', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);

    // decided = ACCEPTED(3) + REJECTED(1) + EXPIRED(1) = 5; DRAFT/SENT excluded
    expect(res.body.quotationAcceptanceRate.accepted).toBe(3);
    expect(res.body.quotationAcceptanceRate.decided).toBe(5);
    expect(res.body.quotationAcceptanceRate.rate).toBe(60);
  });

  it('11. reports enquiry conversion and keeps expected revenue separate from real revenue', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body.enquiryConversion.won).toBe(1);
    expect(res.body.enquiryConversion.lost).toBe(1);
    expect(res.body.enquiryConversion.open).toBe(1);
    expect(res.body.enquiryConversion.total).toBe(3);
    expect(res.body.enquiryConversion.winRate).toBe(50);
    // A forecast field, never mixed into netAcceptedRevenue.
    expect(res.body.enquiryConversion.wonExpectedRevenue).toBe(50000);
    expect(res.body.revenue.netAcceptedRevenue).toBe(5300);

    const byStage = Object.fromEntries(
      res.body.enquiryStageBreakdown.map((b: { stage: string }) => [b.stage, b]),
    );
    expect(byStage.WON.count).toBe(1);
    expect(byStage.LOST.count).toBe(1);
    expect(byStage.NEW.count).toBe(1);
    // Zero-filled stages are present rather than omitted.
    expect(byStage.FOLLOW_UP_2.count).toBe(0);
  });

  it('12. declares the metrics the database cannot support instead of faking them', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);

    const keys = res.body.unavailableMetrics.map((m: { key: string }) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'averageSalesCycle',
        'dealCloseDate',
        'dealDuration',
        'quotationTimeToAcceptance',
        'salesTarget',
        'topPerformer',
        'lossReasonCategories',
      ]),
    );
    for (const metric of res.body.unavailableMetrics) {
      expect(typeof metric.reason).toBe('string');
      expect(metric.reason.length).toBeGreaterThan(0);
    }
  });

  it('13. labels the period basis as the quotation-raised date', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body.period.basis).toBe('QUOTATION_CREATED_AT');
    expect(res.body.period.from).toBeNull();
    expect(res.body.period.to).toBeNull();
  });

  // -------------------------------------------------------- revenue by client

  it('14. breaks revenue down by client, ranked by net revenue', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/revenue-by-client')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body).toHaveLength(2);
    // clientA1: Q1 net 2300 + Q7 net 1000 = 3300
    expect(res.body[0].clientId).toBe(clientA1.id);
    expect(res.body[0].companyName).toBe(clientA1.companyName);
    expect(res.body[0].netAcceptedRevenue).toBe(3300);
    expect(res.body[0].grossAcceptedValue).toBe(3714);
    expect(res.body[0].acceptedQuotationCount).toBe(2);
    // clientA2: Q2 net 2000
    expect(res.body[1].clientId).toBe(clientA2.id);
    expect(res.body[1].netAcceptedRevenue).toBe(2000);

    const total = res.body.reduce(
      (sum: number, row: { netAcceptedRevenue: number }) => sum + row.netAcceptedRevenue,
      0,
    );
    expect(total).toBe(5300);
  });

  // ------------------------------------------------ revenue by representative

  it('15. breaks revenue down by representative and reports unassigned separately', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/revenue-by-representative')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body).toHaveLength(3);
    const byName = Object.fromEntries(res.body.map((r: { name: string }) => [r.name, r]));

    expect(byName[salesUser.name].userId).toBe(salesUser.id);
    expect(byName[salesUser.name].netAcceptedRevenue).toBe(2300);
    expect(byName[adminUser.name].netAcceptedRevenue).toBe(2000);
    // Q7 has no assignee — reported as its own bucket, never dropped.
    expect(byName.Unassigned.userId).toBeNull();
    expect(byName.Unassigned.email).toBeNull();
    expect(byName.Unassigned.netAcceptedRevenue).toBe(1000);

    const total = res.body.reduce(
      (sum: number, row: { netAcceptedRevenue: number }) => sum + row.netAcceptedRevenue,
      0,
    );
    expect(total).toBe(5300);
  });

  // ------------------------------------------------------- revenue by product

  it('16. breaks revenue down by product and buckets ad-hoc lines without inventing an id', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/revenue-by-product')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body).toHaveLength(3);
    const byName = Object.fromEntries(res.body.map((r: { productName: string }) => [r.productName, r]));

    // P2: Q2 (4 x 500 = 2000 net) + Q7 (2 x 500 = 1000 net) = 3000
    expect(byName[productP2.name].productId).toBe(productP2.id);
    expect(byName[productP2.name].netAcceptedRevenue).toBe(3000);
    expect(byName[productP2.name].grossAcceptedValue).toBe(3000);
    expect(byName[productP2.name].quantity).toBe(6);
    expect(byName[productP2.name].lineItemCount).toBe(2);

    // P1: Q1 line 1 -> 2 x 1000 less 10% = 1800 net, 2124 gross
    expect(byName[productP1.name].netAcceptedRevenue).toBe(1800);
    expect(byName[productP1.name].grossAcceptedValue).toBe(2124);

    // Ad-hoc line keeps a null productId — no product id is fabricated.
    const adHoc = byName['Ad-hoc / custom lines'];
    expect(adHoc.productId).toBeNull();
    expect(adHoc.netAcceptedRevenue).toBe(500);
    expect(adHoc.grossAcceptedValue).toBe(590);

    // Product revenue reconciles exactly to the headline figures.
    const netTotal = res.body.reduce(
      (sum: number, row: { netAcceptedRevenue: number }) => sum + row.netAcceptedRevenue,
      0,
    );
    const grossTotal = res.body.reduce(
      (sum: number, row: { grossAcceptedValue: number }) => sum + row.grossAcceptedValue,
      0,
    );
    expect(netTotal).toBe(5300);
    expect(grossTotal).toBe(5714);
  });

  it('17. uses historical line-item snapshots, not the current Product.price', async () => {
    const cookies = await signIn(adminUser.email);

    const before = await request(app.getHttpServer())
      .get('/sales/revenue-by-product')
      .set('Cookie', cookies)
      .expect(200);
    const p1Before = before.body.find(
      (r: { productId: string | null }) => r.productId === productP1.id,
    );
    expect(p1Before.netAcceptedRevenue).toBe(1800);

    // Reprice the catalog product dramatically. Historical quotation revenue
    // must not move: the line item's unitPriceSnapshot is the source.
    await prisma.product.update({ where: { id: productP1.id }, data: { price: 99999 } });
    try {
      const after = await request(app.getHttpServer())
        .get('/sales/revenue-by-product')
        .set('Cookie', cookies)
        .expect(200);
      const p1After = after.body.find(
        (r: { productId: string | null }) => r.productId === productP1.id,
      );
      expect(p1After.netAcceptedRevenue).toBe(1800);
      expect(p1After.grossAcceptedValue).toBe(2124);

      const summary = await request(app.getHttpServer())
        .get('/sales/summary')
        .set('Cookie', cookies)
        .expect(200);
      expect(summary.body.revenue.netAcceptedRevenue).toBe(5300);
    } finally {
      await prisma.product.update({ where: { id: productP1.id }, data: { price: 1000 } });
    }
  });

  it('18. caps a breakdown at the requested limit', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/revenue-by-product?limit=1')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body).toHaveLength(1);
    // Highest net first.
    expect(res.body[0].netAcceptedRevenue).toBe(3000);
  });

  // -------------------------------------------------------- period filtering

  it('19. buckets revenue by the month each quotation was raised', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/revenue-by-period')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body.granularity).toBe('MONTH');
    expect(res.body.period.basis).toBe('QUOTATION_CREATED_AT');
    expect(res.body.buckets).toHaveLength(2);

    // Oldest first: the January 2024 bucket holds Q7 alone.
    expect(new Date(res.body.buckets[0].periodStart).toISOString()).toBe(
      '2024-01-01T00:00:00.000Z',
    );
    expect(res.body.buckets[0].netAcceptedRevenue).toBe(1000);
    expect(res.body.buckets[0].acceptedQuotationCount).toBe(1);

    // The current-month bucket holds Q1 + Q2.
    expect(res.body.buckets[1].netAcceptedRevenue).toBe(4300);
    expect(res.body.buckets[1].acceptedQuotationCount).toBe(2);
  });

  it('20. filters every revenue endpoint on Quotation.createdAt', async () => {
    const cookies = await signIn(adminUser.email);
    // A window that starts after Q7 was raised, so only Q1 + Q2 qualify.
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const summary = await request(app.getHttpServer())
      .get(`/sales/summary?from=${encodeURIComponent(from)}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(summary.body.revenue.netAcceptedRevenue).toBe(4300);
    expect(summary.body.revenue.acceptedQuotationCount).toBe(2);
    expect(summary.body.period.from).not.toBeNull();

    const byClient = await request(app.getHttpServer())
      .get(`/sales/revenue-by-client?from=${encodeURIComponent(from)}`)
      .set('Cookie', cookies)
      .expect(200);
    const clientTotal = byClient.body.reduce(
      (sum: number, row: { netAcceptedRevenue: number }) => sum + row.netAcceptedRevenue,
      0,
    );
    expect(clientTotal).toBe(4300);

    const byProduct = await request(app.getHttpServer())
      .get(`/sales/revenue-by-product?from=${encodeURIComponent(from)}`)
      .set('Cookie', cookies)
      .expect(200);
    const productTotal = byProduct.body.reduce(
      (sum: number, row: { netAcceptedRevenue: number }) => sum + row.netAcceptedRevenue,
      0,
    );
    expect(productTotal).toBe(4300);

    const byPeriod = await request(app.getHttpServer())
      .get(`/sales/revenue-by-period?from=${encodeURIComponent(from)}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(byPeriod.body.buckets).toHaveLength(1);
    expect(byPeriod.body.buckets[0].netAcceptedRevenue).toBe(4300);
  });

  it('21. returns nothing for a window that excludes every quotation', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary?from=2020-01-01T00:00:00.000Z&to=2020-12-31T23:59:59.000Z')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.revenue.netAcceptedRevenue).toBe(0);
    expect(res.body.revenue.acceptedQuotationCount).toBe(0);
    expect(res.body.quotationAcceptanceRate.rate).toBe(0);
    expect(res.body.quotationAcceptanceRate.decided).toBe(0);
  });

  // ------------------------------------------------------- input validation

  it('22. rejects an invalid date', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .get('/sales/summary?from=not-a-date')
      .set('Cookie', cookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/sales/lost-enquiries?to=13/45/2026')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('23. rejects out-of-range pagination and limit values', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .get('/sales/lost-enquiries?pageSize=101')
      .set('Cookie', cookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/sales/lost-enquiries?page=0')
      .set('Cookie', cookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/sales/revenue-by-client?limit=0')
      .set('Cookie', cookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/sales/revenue-by-client?limit=101')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('24. rejects an unknown query parameter, including organizationId', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .get('/sales/summary?bogus=1')
      .set('Cookie', cookies)
      .expect(400);
    // organizationId always comes from the session and can never be supplied.
    await request(app.getHttpServer())
      .get(`/sales/summary?organizationId=${orgB.id}`)
      .set('Cookie', cookies)
      .expect(400);
  });

  // --------------------------------------------------------- lost enquiries

  it('25. lists lost enquiries with their real free-text reasons', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/lost-enquiries')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(25);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.data).toHaveLength(1);

    const row = res.body.data[0];
    expect(row.id).toBe(lostEnquiryA.id);
    expect(row.clientName).toBe(clientA2.companyName);
    expect(row.lostReason).toBe('Budget constraints for this financial year');
    expect(row.expectedRevenue).toBe(30000);
    // Never leaks the other organization's lost enquiry.
    expect(JSON.stringify(res.body)).not.toContain('Org B only lost reason');
  });

  it('26. paginates lost enquiries', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/sales/lost-enquiries?page=2&pageSize=1')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(2);
    expect(res.body.data).toHaveLength(0);
  });

  // ----------------------------------------------------- tenant isolation

  it('27. never leaks another organization\'s figures into any endpoint', async () => {
    const cookies = await signIn(adminUser.email);

    const summary = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);
    // Org B's single accepted quotation is 999999 — it must be nowhere.
    expect(JSON.stringify(summary.body)).not.toContain('999999');
    expect(summary.body.revenue.netAcceptedRevenue).toBe(5300);

    for (const route of [
      '/sales/revenue-by-period',
      '/sales/revenue-by-client',
      '/sales/revenue-by-product',
      '/sales/revenue-by-representative',
      '/sales/lost-enquiries',
    ]) {
      const res = await request(app.getHttpServer())
        .get(route)
        .set('Cookie', cookies)
        .expect(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('999999');
      expect(body).not.toContain('888888');
      expect(body).not.toContain('Org B only line');
    }
  });

  it('28. shows the other organization only its own figures', async () => {
    const cookies = await signIn(otherOrgAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);

    expect(res.body.revenue.netAcceptedRevenue).toBe(999999);
    expect(res.body.revenue.acceptedQuotationCount).toBe(1);

    const byProduct = await request(app.getHttpServer())
      .get('/sales/revenue-by-product')
      .set('Cookie', cookies)
      .expect(200);
    // Org A's catalog products must not appear in Org B's breakdown.
    const body = JSON.stringify(byProduct.body);
    expect(body).not.toContain(productP1.name);
    expect(body).not.toContain(productP2.name);
  });

  // -------------------------------------------------------- empty organization

  it('29. returns a genuine zeroed result for an organization with no sales data', async () => {
    const cookies = await signIn(emptyOrgAdmin.email);

    const summary = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', cookies)
      .expect(200);
    expect(summary.body.revenue.netAcceptedRevenue).toBe(0);
    expect(summary.body.revenue.grossAcceptedValue).toBe(0);
    expect(summary.body.revenue.acceptedQuotationCount).toBe(0);
    expect(summary.body.revenue.averageAcceptedValue).toBe(0);
    expect(summary.body.revenue.openPipelineValue).toBe(0);
    expect(summary.body.quotationAcceptanceRate.rate).toBe(0);
    expect(summary.body.enquiryConversion.total).toBe(0);
    expect(summary.body.enquiryConversion.winRate).toBe(0);
    // Every status/stage is still present, zero-filled.
    expect(summary.body.quotationStatusBreakdown).toHaveLength(5);
    expect(
      summary.body.quotationStatusBreakdown.every((b: { count: number }) => b.count === 0),
    ).toBe(true);

    for (const route of [
      '/sales/revenue-by-client',
      '/sales/revenue-by-product',
      '/sales/revenue-by-representative',
    ]) {
      const res = await request(app.getHttpServer())
        .get(route)
        .set('Cookie', cookies)
        .expect(200);
      expect(res.body).toEqual([]);
    }

    const byPeriod = await request(app.getHttpServer())
      .get('/sales/revenue-by-period')
      .set('Cookie', cookies)
      .expect(200);
    expect(byPeriod.body.buckets).toEqual([]);

    const lost = await request(app.getHttpServer())
      .get('/sales/lost-enquiries')
      .set('Cookie', cookies)
      .expect(200);
    expect(lost.body.total).toBe(0);
    expect(lost.body.data).toEqual([]);
    expect(lost.body.totalPages).toBe(1);
  });

  // -------------------------------------------------------------------
  // Phase 19 — Sales Executive revenue scoped by client ownership
  // -------------------------------------------------------------------

  it('30. Sales Executive revenue is scoped to accepted quotations of clients assigned to them — quotation.assignedToId never determines it', async () => {
    const salesCookies = await signIn(salesUser.email);

    const ownClient = await createFixtureClient(orgA.id, `P19 Own Client ${runId}`);
    await prisma.client.update({ where: { id: ownClient.id }, data: { assignedToId: salesUser.id } });
    const otherClient = await createFixtureClient(orgA.id, `P19 Other Client ${runId}`);
    await prisma.client.update({ where: { id: otherClient.id }, data: { assignedToId: adminUser.id } });
    const unassignedClient = await createFixtureClient(orgA.id, `P19 Unassigned Client ${runId}`);

    // Own client, ACCEPTED, but quotation.assignedToId points to a
    // different rep — must still count; client ownership is authoritative.
    await seedQuotation({
      organizationId: orgA.id,
      clientId: ownClient.id,
      status: 'ACCEPTED',
      assignedToId: adminUser.id,
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 1000,
      lines: [
        {
          productId: null,
          productNameSnapshot: 'P19 Own-client line',
          quantity: 1,
          unitPriceSnapshot: 1000,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 1000,
        },
      ],
    });

    // Another rep's client, ACCEPTED, quotation.assignedToId IS the caller
    // — must NOT count; quotation.assignedToId is never the revenue
    // boundary.
    await seedQuotation({
      organizationId: orgA.id,
      clientId: otherClient.id,
      status: 'ACCEPTED',
      assignedToId: salesUser.id,
      subtotal: 5000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 5000,
      lines: [
        {
          productId: null,
          productNameSnapshot: 'P19 Other-client line',
          quantity: 1,
          unitPriceSnapshot: 5000,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 5000,
        },
      ],
    });

    // Unassigned client, ACCEPTED — must NOT count.
    await seedQuotation({
      organizationId: orgA.id,
      clientId: unassignedClient.id,
      status: 'ACCEPTED',
      subtotal: 3000,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 3000,
      lines: [
        {
          productId: null,
          productNameSnapshot: 'P19 Unassigned-client line',
          quantity: 1,
          unitPriceSnapshot: 3000,
          discountPercentage: 0,
          taxRate: 0,
          lineAmount: 3000,
        },
      ],
    });

    const summary = await request(app.getHttpServer())
      .get('/sales/summary')
      .set('Cookie', salesCookies)
      .expect(200);
    expect(summary.body.revenue.netAcceptedRevenue).toBe(1000);
    expect(summary.body.revenue.grossAcceptedValue).toBe(1000);
    expect(summary.body.revenue.acceptedQuotationCount).toBe(1);

    const byClient = await request(app.getHttpServer())
      .get('/sales/revenue-by-client')
      .set('Cookie', salesCookies)
      .expect(200);
    expect(byClient.body).toHaveLength(1);
    expect(byClient.body[0].clientId).toBe(ownClient.id);
    expect(byClient.body[0].netAcceptedRevenue).toBe(1000);

    const byProduct = await request(app.getHttpServer())
      .get('/sales/revenue-by-product')
      .set('Cookie', salesCookies)
      .expect(200);
    const productTotal = byProduct.body.reduce(
      (sum: number, row: { netAcceptedRevenue: number }) => sum + row.netAcceptedRevenue,
      0,
    );
    expect(productTotal).toBe(1000);

    const byPeriod = await request(app.getHttpServer())
      .get('/sales/revenue-by-period')
      .set('Cookie', salesCookies)
      .expect(200);
    const periodTotal = byPeriod.body.buckets.reduce(
      (sum: number, bucket: { netAcceptedRevenue: number }) => sum + bucket.netAcceptedRevenue,
      0,
    );
    expect(periodTotal).toBe(1000);
  });

  it('31. Sales Executive lost enquiries are scoped to assigned clients', async () => {
    const salesCookies = await signIn(salesUser.email);

    const ownClient = await createFixtureClient(orgA.id, `P19 Lost Own Client ${runId}`);
    await prisma.client.update({ where: { id: ownClient.id }, data: { assignedToId: salesUser.id } });
    const otherClient = await createFixtureClient(orgA.id, `P19 Lost Other Client ${runId}`);

    const ownLost = await createFixtureEnquiry(orgA.id, ownClient.id, {
      stage: 'LOST',
      lostReason: 'Budget cuts (own client)',
    });
    const otherLost = await createFixtureEnquiry(orgA.id, otherClient.id, {
      stage: 'LOST',
      lostReason: 'Budget cuts (other client)',
    });

    const res = await request(app.getHttpServer())
      .get('/sales/lost-enquiries?pageSize=100')
      .set('Cookie', salesCookies)
      .expect(200);
    const ids: string[] = res.body.data.map((e: { id: string }) => e.id);
    expect(ids).toContain(ownLost.id);
    expect(ids).not.toContain(otherLost.id);
  });

  it('32. Sales Executive revenue-by-representative returns exactly one self row with no colleague information', async () => {
    const salesCookies = await signIn(salesUser.email);

    const res = await request(app.getHttpServer())
      .get('/sales/revenue-by-representative')
      .set('Cookie', salesCookies)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(salesUser.id);
    expect(res.body[0].name).toBe(salesUser.name);
    expect(res.body[0].email).toBe(salesUser.email);
    // Never a colleague's name, or the generic "Unassigned" bucket, in the
    // response — the multi-representative breakdown is not exposed at all.
    expect(res.body.some((r: { name: string }) => r.name === adminUser.name)).toBe(false);
    expect(res.body.some((r: { name: string }) => r.name === 'Unassigned')).toBe(false);
  });

  it('33. Admin and Super Admin retain organization-wide revenue figures unaffected by Sales Executive scoping', async () => {
    const adminCookies = await signIn(adminUser.email);
    const superCookies = await signIn(superAdmin.email);
    const salesCookies = await signIn(salesUser.email);

    const [adminSummary, superSummary, salesSummary] = await Promise.all([
      request(app.getHttpServer()).get('/sales/summary').set('Cookie', adminCookies).expect(200),
      request(app.getHttpServer()).get('/sales/summary').set('Cookie', superCookies).expect(200),
      request(app.getHttpServer()).get('/sales/summary').set('Cookie', salesCookies).expect(200),
    ]);

    // Admin and Super Admin see the same organization-wide total, which
    // must include revenue the Sales Executive's own scoped view excludes.
    expect(adminSummary.body.revenue.netAcceptedRevenue).toBe(
      superSummary.body.revenue.netAcceptedRevenue,
    );
    expect(adminSummary.body.revenue.netAcceptedRevenue).toBeGreaterThan(
      salesSummary.body.revenue.netAcceptedRevenue,
    );

    const adminByRep = await request(app.getHttpServer())
      .get('/sales/revenue-by-representative')
      .set('Cookie', adminCookies)
      .expect(200);
    // Admin keeps the full multi-representative breakdown — never
    // collapsed to a single row.
    expect(adminByRep.body.length).toBeGreaterThan(1);
  });
});
