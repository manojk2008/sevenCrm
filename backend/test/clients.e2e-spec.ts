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

function baseClientPayload(overrides: Record<string, unknown> = {}) {
  return {
    companyName: `Acme Corp ${uid()}`,
    industry: 'IT Services',
    email: `client-${uid()}@test.local`,
    phone: '+919876500000',
    addressLine1: '123 Business Park',
    addressCity: 'Mumbai',
    addressState: 'Maharashtra',
    addressPincode: '400001',
    ...overrides,
  };
}

describe('ClientsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let salesUserB: { id: string; email: string };
  let otherOrgAdmin: { id: string; email: string };

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
      data: { name: `Test Org A ${runId}`, slug: `clients-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Test Org B ${runId}`, slug: `clients-test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `super-${runId}@test.local`,
      name: 'Test Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `admin-${runId}@test.local`,
      name: 'Test Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `sales-${runId}@test.local`,
      name: 'Test Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    salesUserB = await createFixtureUser({
      email: `sales-b-${runId}@test.local`,
      name: 'Test Sales Executive B',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgAdmin = await createFixtureUser({
      email: `other-admin-${runId}@test.local`,
      name: 'Other Org Admin',
      organizationId: orgB.id,
      role: 'ADMIN',
      department: 'Operations',
    });
  }, 30000);

  afterAll(async () => {
    // Client.organizationId is onDelete: Restrict, so clients (and their
    // contacts, which cascade) must be removed before the orgs/users can be.
    await prisma.client.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  it('1. rejects GET /clients when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/clients').expect(401);
  });

  it('2. allows a Super Admin to create a client, assigned to their org', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);

    expect(res.body.organizationId).toBe(orgA.id);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.totalDeals).toBe(0);
    expect(res.body.totalRevenue).toBe(0);
    expect(res.body.contacts).toEqual([]);
  });

  it('3. allows an Admin to create a client', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);
    expect(res.body.organizationId).toBe(orgA.id);
  });

  it('4. allows a Sales Executive to create a client', async () => {
    const cookies = await signIn(salesUser.email);
    const res = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);
    expect(res.body.organizationId).toBe(orgA.id);
  });

  it('4b. Sales Executive rule: can read/create/update but cannot change client status', async () => {
    const adminCookies = await signIn(adminUser.email);
    // Phase 19: created assigned to salesUser — an unassigned client would
    // now be correctly invisible to them, which would defeat this test's
    // intent (verifying the read/update-allowed, status-change-forbidden
    // distinction on a client they can actually reach).
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', adminCookies)
      .send(baseClientPayload({ assignedToId: salesUser.id }))
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    // read: allowed
    await request(app.getHttpServer())
      .get(`/clients/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(200);
    // update: allowed
    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ notes: 'touched by sales exec' })
      .expect(200);
    // status change: forbidden
    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}/status`)
      .set('Cookie', salesCookies)
      .send({ status: 'INACTIVE', churnReason: 'no longer active' })
      .expect(403);
  });

  it('4c. Sales Executive rule: cannot manage client contacts', async () => {
    const adminCookies = await signIn(adminUser.email);
    // Phase 19: created assigned to salesUser — see 4b's comment.
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', adminCookies)
      .send(baseClientPayload({ assignedToId: salesUser.id }))
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .post(`/clients/${created.body.id}/contacts`)
      .set('Cookie', salesCookies)
      .send({ name: 'Blocked Contact' })
      .expect(403);
    // reading contacts is still allowed (part of "read clients")
    await request(app.getHttpServer())
      .get(`/clients/${created.body.id}/contacts`)
      .set('Cookie', salesCookies)
      .expect(200);
  });

  it('6. rejects organizationId supplied in the request body (unknown field)', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ organizationId: orgB.id }))
      .expect(400);
  });

  it('7. GET /clients returns only clients from the caller organization', async () => {
    const cookiesA = await signIn(superAdmin.email);
    const cookiesB = await signIn(otherOrgAdmin.email);

    const orgBClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesB)
      .send(baseClientPayload())
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/clients?pageSize=100')
      .set('Cookie', cookiesA)
      .expect(200);

    const ids: string[] = listRes.body.data.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(orgBClient.body.id);
    for (const client of listRes.body.data) {
      expect(client.organizationId).toBe(orgA.id);
    }
  });

  it('8. GET /clients/:id cannot access another organization client (404)', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesB)
      .send(baseClientPayload())
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/clients/${orgBClient.body.id}`)
      .set('Cookie', cookiesA)
      .expect(404);
  });

  it('9. PATCH /clients/:id updates the correct client', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ companyName: 'Renamed Company', addressCity: 'Pune' })
      .expect(200);

    expect(updated.body.id).toBe(created.body.id);
    expect(updated.body.companyName).toBe('Renamed Company');
    expect(updated.body.address.city).toBe('Pune');
  });

  it('10. PATCH /clients/:id cannot change organizationId (unknown field)', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ organizationId: orgB.id })
      .expect(400);

    const stillOrgA = await prisma.client.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stillOrgA.organizationId).toBe(orgA.id);
  });

  it('11. rejects assignedToId belonging to another organization (create and update)', async () => {
    const cookiesA = await signIn(superAdmin.email);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesA)
      .send(baseClientPayload({ assignedToId: otherOrgAdmin.id }))
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesA)
      .send(baseClientPayload({ assignedToId: salesUser.id }))
      .expect(201);
    expect(created.body.assignedTo.id).toBe(salesUser.id);

    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Cookie', cookiesA)
      .send({ assignedToId: otherOrgAdmin.id })
      .expect(400);
  });

  it('12. rejects a duplicate email within the same organization (409)', async () => {
    const cookies = await signIn(superAdmin.email);
    const email = `dup-${uid()}@test.local`;
    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ email }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ email }))
      .expect(409);
  });

  it('13. allows the same email in a different organization', async () => {
    const cookiesA = await signIn(superAdmin.email);
    const cookiesB = await signIn(otherOrgAdmin.email);
    const email = `shared-${uid()}@test.local`;

    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesA)
      .send(baseClientPayload({ email }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesB)
      .send(baseClientPayload({ email }))
      .expect(201);
  });

  it('14. rejects a duplicate GST number within the same organization (409)', async () => {
    const cookies = await signIn(superAdmin.email);
    const gstNumber = `GST${uid()}TEST`.slice(0, 15);
    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ gstNumber }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ gstNumber }))
      .expect(409);
  });

  it('15. allows the same GST number in a different organization', async () => {
    const cookiesA = await signIn(superAdmin.email);
    const cookiesB = await signIn(otherOrgAdmin.email);
    const gstNumber = `GST${uid()}TEST`.slice(0, 15);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesA)
      .send(baseClientPayload({ gstNumber }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesB)
      .send(baseClientPayload({ gstNumber }))
      .expect(201);
  });

  it('16-17-18. status: ACTIVE -> INACTIVE requires churnReason, INACTIVE -> ACTIVE works, row is never hard-deleted', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);

    // 16. missing churnReason is rejected
    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE' })
      .expect(400);

    // 16. with churnReason, deactivation succeeds and is persisted
    const deactivated = await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'INACTIVE', churnReason: 'Budget cuts' })
      .expect(200);
    expect(deactivated.body.status).toBe('INACTIVE');
    expect(deactivated.body.churnReason).toBe('Budget cuts');

    // 18. row still exists in the database — never hard-deleted
    const stillThere = await prisma.client.findUnique({ where: { id: created.body.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.status).toBe('INACTIVE');

    // there is no hard-delete route at all
    await request(app.getHttpServer())
      .delete(`/clients/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(404);

    // 17. reactivation works and preserves the prior churnReason
    const reactivated = await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(reactivated.body.status).toBe('ACTIVE');
    expect(reactivated.body.churnReason).toBe('Budget cuts');
  });

  it('19-20-21. contacts can be created, updated, and deleted', async () => {
    const cookies = await signIn(superAdmin.email);
    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);

    // 19. create
    const contact = await request(app.getHttpServer())
      .post(`/clients/${client.body.id}/contacts`)
      .set('Cookie', cookies)
      .send({ name: 'Priya Sharma', email: 'priya@example.com', designation: 'Director' })
      .expect(201);
    expect(contact.body.name).toBe('Priya Sharma');

    // 20. update
    const updatedContact = await request(app.getHttpServer())
      .patch(`/clients/${client.body.id}/contacts/${contact.body.id}`)
      .set('Cookie', cookies)
      .send({ designation: 'CEO' })
      .expect(200);
    expect(updatedContact.body.designation).toBe('CEO');

    // 21. delete
    await request(app.getHttpServer())
      .delete(`/clients/${client.body.id}/contacts/${contact.body.id}`)
      .set('Cookie', cookies)
      .expect(200);

    const listAfterDelete = await request(app.getHttpServer())
      .get(`/clients/${client.body.id}/contacts`)
      .set('Cookie', cookies)
      .expect(200);
    expect(listAfterDelete.body.map((c: { id: string }) => c.id)).not.toContain(contact.body.id);
  });

  it('22. contacts belonging to another organization cannot be accessed', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesB)
      .send(baseClientPayload())
      .expect(201);
    await request(app.getHttpServer())
      .post(`/clients/${orgBClient.body.id}/contacts`)
      .set('Cookie', cookiesB)
      .send({ name: 'Org B Contact' })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .get(`/clients/${orgBClient.body.id}/contacts`)
      .set('Cookie', cookiesA)
      .expect(404);
  });

  it('23. setting a contact as primary removes primary status from the previous primary contact', async () => {
    const cookies = await signIn(superAdmin.email);
    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);

    const first = await request(app.getHttpServer())
      .post(`/clients/${client.body.id}/contacts`)
      .set('Cookie', cookies)
      .send({ name: 'First Contact', isPrimary: true })
      .expect(201);
    expect(first.body.isPrimary).toBe(true);

    const second = await request(app.getHttpServer())
      .post(`/clients/${client.body.id}/contacts`)
      .set('Cookie', cookies)
      .send({ name: 'Second Contact', isPrimary: true })
      .expect(201);
    expect(second.body.isPrimary).toBe(true);

    const refreshedFirst = await prisma.clientContact.findUniqueOrThrow({ where: { id: first.body.id } });
    expect(refreshedFirst.isPrimary).toBe(false);
  });

  it('24. cross-organization contact manipulation is rejected', async () => {
    const cookiesB = await signIn(otherOrgAdmin.email);
    const orgBClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookiesB)
      .send(baseClientPayload())
      .expect(201);
    const orgBContact = await request(app.getHttpServer())
      .post(`/clients/${orgBClient.body.id}/contacts`)
      .set('Cookie', cookiesB)
      .send({ name: 'Org B Contact' })
      .expect(201);

    const cookiesA = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch(`/clients/${orgBClient.body.id}/contacts/${orgBContact.body.id}`)
      .set('Cookie', cookiesA)
      .send({ name: 'Hijacked' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/clients/${orgBClient.body.id}/contacts/${orgBContact.body.id}`)
      .set('Cookie', cookiesA)
      .expect(404);

    const stillIntact = await prisma.clientContact.findUniqueOrThrow({ where: { id: orgBContact.body.id } });
    expect(stillIntact.name).toBe('Org B Contact');
  });

  it('25. rejects unknown DTO fields', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ notARealField: 'nope' }))
      .expect(400);
  });

  // -------------------------------------------------------------------
  // Phase 19 — Sales Executive client ownership
  // -------------------------------------------------------------------

  it('26. Sales Executive create with omitted assignedToId is forced to self', async () => {
    const cookies = await signIn(salesUser.email);
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload())
      .expect(201);
    expect(created.body.assignedTo.id).toBe(salesUser.id);
  });

  it('27. Sales Executive create with own assignedToId is allowed', async () => {
    const cookies = await signIn(salesUser.email);
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ assignedToId: salesUser.id }))
      .expect(201);
    expect(created.body.assignedTo.id).toBe(salesUser.id);
  });

  it('28. Sales Executive create with another user assignedToId is rejected (400)', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ assignedToId: salesUserB.id }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', cookies)
      .send(baseClientPayload({ assignedToId: adminUser.id }))
      .expect(400);
  });

  it('29. Sales Executive list sees only own clients — another rep and unassigned clients hidden', async () => {
    const adminCookies = await signIn(adminUser.email);
    const salesCookies = await signIn(salesUser.email);

    const ownClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', salesCookies)
      .send(baseClientPayload())
      .expect(201);

    const otherRepClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', adminCookies)
      .send(baseClientPayload({ assignedToId: salesUserB.id }))
      .expect(201);

    const unassignedClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', adminCookies)
      .send(baseClientPayload())
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/clients?pageSize=100')
      .set('Cookie', salesCookies)
      .expect(200);

    const ids: string[] = listRes.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(ownClient.body.id);
    expect(ids).not.toContain(otherRepClient.body.id);
    expect(ids).not.toContain(unassignedClient.body.id);
    for (const client of listRes.body.data) {
      expect(client.assignedTo?.id).toBe(salesUser.id);
    }
  });

  it('30. Sales Executive detail 404s on another rep client and on unassigned client', async () => {
    const adminCookies = await signIn(adminUser.email);
    const salesCookies = await signIn(salesUser.email);

    const otherRepClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', adminCookies)
      .send(baseClientPayload({ assignedToId: salesUserB.id }))
      .expect(201);
    const unassignedClient = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', adminCookies)
      .send(baseClientPayload())
      .expect(201);

    await request(app.getHttpServer())
      .get(`/clients/${otherRepClient.body.id}`)
      .set('Cookie', salesCookies)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/clients/${unassignedClient.body.id}`)
      .set('Cookie', salesCookies)
      .expect(404);
    // Cannot reach update on a client that isn't theirs either — 404 before
    // any business-rule check runs.
    await request(app.getHttpServer())
      .patch(`/clients/${otherRepClient.body.id}`)
      .set('Cookie', salesCookies)
      .send({ notes: 'attempted takeover' })
      .expect(404);
  });

  it('31. Sales Executive cannot remove their own client assignment (400)', async () => {
    const salesCookies = await signIn(salesUser.email);
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', salesCookies)
      .send(baseClientPayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ assignedToId: null })
      .expect(400);

    const stillAssigned = await prisma.client.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stillAssigned.assignedToId).toBe(salesUser.id);
  });

  it('32. Sales Executive cannot reassign their client to another user (400)', async () => {
    const salesCookies = await signIn(salesUser.email);
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', salesCookies)
      .send(baseClientPayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/clients/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ assignedToId: salesUserB.id })
      .expect(400);

    const stillAssigned = await prisma.client.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stillAssigned.assignedToId).toBe(salesUser.id);
  });

  it('33. Admin and Super Admin retain organization-wide visibility regardless of assignment', async () => {
    const salesCookies = await signIn(salesUser.email);
    const adminCookies = await signIn(adminUser.email);
    const superCookies = await signIn(superAdmin.email);

    const ownedBySalesUser = await request(app.getHttpServer())
      .post('/clients')
      .set('Cookie', salesCookies)
      .send(baseClientPayload())
      .expect(201);

    // Admin can read and update a client it does not own.
    await request(app.getHttpServer())
      .get(`/clients/${ownedBySalesUser.body.id}`)
      .set('Cookie', adminCookies)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/clients/${ownedBySalesUser.body.id}`)
      .set('Cookie', adminCookies)
      .send({ assignedToId: salesUserB.id })
      .expect(200);

    // Super Admin sees it in the full org-wide list.
    const listRes = await request(app.getHttpServer())
      .get('/clients?pageSize=100')
      .set('Cookie', superCookies)
      .expect(200);
    const ids: string[] = listRes.body.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(ownedBySalesUser.body.id);
  });
});
