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
const TOKEN = `SearchTok${runId}`;
const BOUND_TOKEN = `BoundTok${runId}`;
const APPROVED_FIELDS = ['id', 'type', 'title', 'description', 'href'].sort();

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
      quotationNumber: `QT-SEARCH-${runId}-${uid()}`,
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

describe('SearchController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let orgEmpty: { id: string };

  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let emptyOrgAdmin: { id: string; email: string };

  let clientA: { id: string; companyName: string };
  let enquiryA: { id: string; title: string };
  let productA: { id: string; name: string };
  let quotationA: { id: string; quotationNumber: string };

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
      data: { name: `Search Org A ${runId}`, slug: `search-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Search Org B ${runId}`, slug: `search-test-org-b-${runId}` },
    });
    orgEmpty = await prisma.organization.create({
      data: { name: `Search Org Empty ${runId}`, slug: `search-test-org-empty-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `search-super-${runId}@test.local`,
      name: 'Search Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `search-admin-${runId}@test.local`,
      name: 'Search Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `search-exec-${runId}@test.local`,
      name: 'Search Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    emptyOrgAdmin = await createFixtureUser({
      email: `search-empty-admin-${runId}@test.local`,
      name: 'Search Empty Org Admin',
      organizationId: orgEmpty.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    // --- Org A: one of each entity, all sharing TOKEN so a single search
    // exercises the mixed-type-results path. ---
    clientA = await createFixtureClient(orgA.id, `${TOKEN} Client Ltd`);
    enquiryA = await createFixtureEnquiry(orgA.id, clientA.id, {
      title: `${TOKEN} Enterprise Upgrade`,
    });
    const groupA = await prisma.productGroup.create({
      data: { organizationId: orgA.id, name: `Search Group ${runId}` },
    });
    productA = await prisma.product.create({
      data: {
        organizationId: orgA.id,
        productGroupId: groupA.id,
        name: `${TOKEN} Widget`,
        sku: `SKU-${runId}`,
        price: 100,
      },
    });
    quotationA = await createFixtureQuotation(orgA.id, clientA.id, {
      quotationNumber: `${TOKEN}-QT`,
    });

    // 6 more clients sharing BOUND_TOKEN to prove the per-type cap.
    for (let i = 0; i < 6; i++) {
      await createFixtureClient(orgA.id, `${BOUND_TOKEN} Client ${i}`);
    }

    // --- Org B: distinctive, must never leak into Org A's results. ---
    const clientB = await createFixtureClient(orgB.id, `Org B Only Client ${runId}`);
    await createFixtureEnquiry(orgB.id, clientB.id, { title: `Org B Only Enquiry ${runId}` });
  }, 60000);

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id, orgEmpty.id];
    await prisma.quotation.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.quotationNumberCounter.deleteMany({ where: { organizationId: { in: orgIds } } });
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

  it('1. rejects GET /search when unauthenticated', async () => {
    await request(app.getHttpServer()).get(`/search?q=${TOKEN}`).expect(401);
  });

  // -------------------------------------------------------- authorization

  it('2. allows a Super Admin to search', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
  });

  it('3. allows an Admin to search', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
  });

  it('4. allows a Sales Executive to search', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
  });

  // ----------------------------------------------------------- validation

  it('5. rejects an empty query', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer()).get('/search?q=').set('Cookie', cookies).expect(400);
    await request(app.getHttpServer()).get('/search').set('Cookie', cookies).expect(400);
  });

  it('6. rejects a whitespace-only query', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get('/search?q=%20%20%20')
      .set('Cookie', cookies)
      .expect(400);
  });

  it('7. rejects an unknown query parameter', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}&foo=bar`)
      .set('Cookie', cookies)
      .expect(400);
  });

  it('8. rejects an attempt to inject organizationId as a query parameter', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}&organizationId=${orgB.id}`)
      .set('Cookie', cookies)
      .expect(400);
  });

  // ------------------------------------------------- tenant isolation

  it('9. returns results scoped to the caller\'s own organization', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    expect((res.body.results as { id: string }[]).length).toBeGreaterThan(0);
  });

  it('10. never returns Org B records when searching from Org A', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=Org B Only`)
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.results).toEqual([]);
  });

  // -------------------------------------------------------- per-entity

  it('11. client search works', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const clientResult = (res.body.results as { type: string; id: string }[]).find(
      (r) => r.type === 'client',
    );
    expect(clientResult?.id).toBe(clientA.id);
  });

  it('12. enquiry search works', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const enquiryResult = (res.body.results as { type: string; id: string }[]).find(
      (r) => r.type === 'enquiry',
    );
    expect(enquiryResult?.id).toBe(enquiryA.id);
  });

  it('13. product search works', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const productResult = (res.body.results as { type: string; id: string }[]).find(
      (r) => r.type === 'product',
    );
    expect(productResult?.id).toBe(productA.id);
  });

  it('14. quotation search works', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const quotationResult = (res.body.results as { type: string; id: string }[]).find(
      (r) => r.type === 'quotation',
    );
    expect(quotationResult?.id).toBe(quotationA.id);
  });

  it('15. a single query returns correctly-typed mixed results', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const types = new Set((res.body.results as { type: string }[]).map((r) => r.type));
    expect(types).toEqual(new Set(['client', 'enquiry', 'product', 'quotation']));
  });

  // --------------------------------------------------------- content

  it('16. result ids are real, matching the underlying record', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const ids = (res.body.results as { id: string }[]).map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([clientA.id, enquiryA.id, productA.id, quotationA.id]),
    );
  });

  it('17. hrefs are real, approved routes only', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const results: { type: string; id: string; href: string }[] = res.body.results;
    for (const r of results) {
      switch (r.type) {
        case 'client':
          expect(r.href).toBe(`/clients/${r.id}`);
          break;
        case 'quotation':
          expect(r.href).toBe(`/quotations/${r.id}`);
          break;
        case 'enquiry':
          expect(r.href).toBe('/enquiries');
          break;
        case 'product':
          expect(r.href).toBe('/products');
          break;
      }
    }
  });

  it('18. exposes only the approved SafeSearchResult fields, no raw Prisma internals', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const results: Record<string, unknown>[] = res.body.results;
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(Object.keys(r).sort()).toEqual(APPROVED_FIELDS);
      expect(r).not.toHaveProperty('organizationId');
      expect(r).not.toHaveProperty('companyName');
      expect(r).not.toHaveProperty('price');
    }
  });

  // ----------------------------------------------------------- empty state

  it('19. returns a genuine empty result set for an organization with no matches', async () => {
    const cookies = await signIn(emptyOrgAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body).toEqual({ query: TOKEN, results: [] });
  });

  // -------------------------------------------------------------- bounding

  it('20. caps results per entity type rather than returning an unbounded set', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/search?q=${BOUND_TOKEN}`)
      .set('Cookie', cookies)
      .expect(200);
    const clientResults = (res.body.results as { type: string }[]).filter(
      (r) => r.type === 'client',
    );
    // 6 matching clients were seeded; the endpoint must cap at 5.
    expect(clientResults.length).toBe(5);
  });

  // --------------------------------------------------------------- writes

  it('21. exposes no write routes on /search', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/search?q=${TOKEN}`)
      .set('Cookie', cookies)
      .expect(404);
  });

  // -------------------------------------------------------------------
  // Phase 19 — Sales Executive client ownership
  // -------------------------------------------------------------------

  it('22. Sales Executive search results are scoped to own clients/enquiries/quotations — Products stay organization-wide', async () => {
    const salesCookies = await signIn(salesUser.email);
    const ownToken = `P19Own${runId}`;

    const ownClient = await createFixtureClient(orgA.id, `${ownToken} Client`);
    await prisma.client.update({ where: { id: ownClient.id }, data: { assignedToId: salesUser.id } });
    const ownEnquiry = await createFixtureEnquiry(orgA.id, ownClient.id, {
      title: `${ownToken} Enquiry`,
    });
    const ownQuotation = await createFixtureQuotation(orgA.id, ownClient.id, {
      quotationNumber: `QT-${ownToken}`,
    });

    // clientA/enquiryA/quotationA (the shared TOKEN fixtures) are
    // unassigned — must not be found by the Sales Executive.
    const unassignedRes = await request(app.getHttpServer())
      .get(`/search?q=${TOKEN}`)
      .set('Cookie', salesCookies)
      .expect(200);
    const unassignedIds: string[] = unassignedRes.body.results.map((r: { id: string }) => r.id);
    expect(unassignedIds).not.toContain(clientA.id);
    expect(unassignedIds).not.toContain(enquiryA.id);
    expect(unassignedIds).not.toContain(quotationA.id);
    // Product search stays organization-wide even for a Sales Executive.
    expect(unassignedIds).toContain(productA.id);

    // The caller's own client/enquiry/quotation ARE found.
    const ownRes = await request(app.getHttpServer())
      .get(`/search?q=${encodeURIComponent(ownToken)}`)
      .set('Cookie', salesCookies)
      .expect(200);
    const ownIds: string[] = ownRes.body.results.map((r: { id: string }) => r.id);
    expect(ownIds).toContain(ownClient.id);
    expect(ownIds).toContain(ownEnquiry.id);
    expect(ownIds).toContain(ownQuotation.id);
  });

  it('23. Admin and Super Admin retain organization-wide search results', async () => {
    const adminCookies = await signIn(adminUser.email);
    const superCookies = await signIn(superAdmin.email);

    const [adminRes, superRes] = await Promise.all([
      request(app.getHttpServer()).get(`/search?q=${TOKEN}`).set('Cookie', adminCookies).expect(200),
      request(app.getHttpServer()).get(`/search?q=${TOKEN}`).set('Cookie', superCookies).expect(200),
    ]);
    const adminIds: string[] = adminRes.body.results.map((r: { id: string }) => r.id);
    const superIds: string[] = superRes.body.results.map((r: { id: string }) => r.id);
    expect(adminIds).toContain(clientA.id);
    expect(superIds).toContain(clientA.id);
  });
});
