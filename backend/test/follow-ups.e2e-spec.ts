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

const DAY = 24 * 60 * 60 * 1000;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** A full ISO datetime `days` from now (negative = in the past). */
function isoInDays(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString();
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
      expectedCloseDate: new Date(Date.now() + 30 * DAY),
      ...overrides,
    },
  });
}

describe('FollowUpsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string };
  let orgB: { id: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };
  let salesUserB: { id: string; email: string };
  let otherOrgAdmin: { id: string; email: string };

  let clientA: { id: string; companyName: string };
  let clientA2: { id: string; companyName: string };
  let clientB: { id: string; companyName: string };
  let clientOwnedBySales: { id: string; companyName: string };
  let enquiryA: { id: string; clientId: string; title: string };
  let enquiryA2: { id: string; clientId: string };
  let enquiryB: { id: string };

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      clientId: clientA.id,
      subject: `Fixture Follow-up ${uid()}`,
      type: 'CALL',
      priority: 'MEDIUM',
      scheduledAt: isoInDays(3),
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

  /**
   * Creates a follow-up straight through Prisma. Used by the filtering and
   * pagination blocks, which need rows with a controlled `scheduledAt`
   * (including past dates the create endpoint would happily accept but which
   * are clearer to state directly) and a controlled status.
   */
  function seedFollowUp(overrides: Record<string, unknown> = {}) {
    return prisma.followUp.create({
      data: {
        organizationId: orgA.id,
        clientId: clientA.id,
        subject: `Seeded Follow-up ${uid()}`,
        type: 'CALL',
        priority: 'MEDIUM',
        scheduledAt: new Date(Date.now() + 3 * DAY),
        ...overrides,
      },
    });
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
      data: { name: `FollowUp Org A ${runId}`, slug: `follow-ups-test-org-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `FollowUp Org B ${runId}`, slug: `follow-ups-test-org-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `followup-super-${runId}@test.local`,
      name: 'FollowUp Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `followup-admin-${runId}@test.local`,
      name: 'FollowUp Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `followup-sales-${runId}@test.local`,
      name: 'FollowUp Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    salesUserB = await createFixtureUser({
      email: `followup-sales-b-${runId}@test.local`,
      name: 'FollowUp Sales Executive B',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgAdmin = await createFixtureUser({
      email: `followup-other-admin-${runId}@test.local`,
      name: 'FollowUp Other Org Admin',
      organizationId: orgB.id,
      role: 'ADMIN',
      department: 'Operations',
    });

    clientA = await createFixtureClient(orgA.id);
    clientA2 = await createFixtureClient(orgA.id);
    clientB = await createFixtureClient(orgB.id);
    clientOwnedBySales = await createFixtureClient(orgA.id, { assignedToId: salesUser.id });

    enquiryA = await createFixtureEnquiry(orgA.id, clientA.id);
    enquiryA2 = await createFixtureEnquiry(orgA.id, clientA2.id);
    enquiryB = await createFixtureEnquiry(orgB.id, clientB.id);
  }, 30000);

  afterAll(async () => {
    // FollowUp.clientId is Restrict and enquiryId/assignedToId are SetNull —
    // follow-ups must be removed before clients/enquiries/users/orgs.
    await prisma.followUp.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.enquiry.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  // ------------------------------------------------------- authentication

  it('1. rejects GET /follow-ups when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/follow-ups').expect(401);
  });

  it('2. rejects POST /follow-ups when unauthenticated', async () => {
    await request(app.getHttpServer()).post('/follow-ups').send(basePayload()).expect(401);
  });

  // -------------------------------------------------------- authorization

  it('3. allows a Super Admin full access, scoping the row to their own org and starting SCHEDULED', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    expect(created.body.organizationId).toBe(orgA.id);
    expect(created.body.status).toBe('SCHEDULED');
    expect(created.body.completedAt).toBeNull();
    expect(created.body.isOverdue).toBe(false);

    await request(app.getHttpServer())
      .get(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ subject: 'Super admin edit' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'CANCELLED' })
      .expect(200);
  });

  it('4. allows an Admin full access', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(created.body.organizationId).toBe(orgA.id);

    await request(app.getHttpServer())
      .get('/follow-ups')
      .set('Cookie', cookies)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ priority: 'HIGH' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', outcome: 'Spoke to the client.' })
      .expect(200);
  });

  it('5. allows a Sales Executive full access — unlike Quotations, writes are not admin-only here', async () => {
    const cookies = await signIn(salesUser.email);
    // Phase 19: a Sales Executive can only create against a client assigned
    // to themselves — basePayload()'s default clientId (clientA) is
    // unassigned, so clientOwnedBySales is used here instead.
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ clientId: clientOwnedBySales.id }))
      .expect(201);
    expect(created.body.organizationId).toBe(orgA.id);

    await request(app.getHttpServer()).get('/follow-ups').set('Cookie', cookies).expect(200);
    await request(app.getHttpServer())
      .get(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ notes: 'Sales exec note' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', outcome: 'Call completed.' })
      .expect(200);
  });

  it('6. returns 404 (not 403) for a follow-up belonging to another organization', async () => {
    const ownerCookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', ownerCookies)
      .send(basePayload())
      .expect(201);

    const otherCookies = await signIn(otherOrgAdmin.email);
    await request(app.getHttpServer())
      .get(`/follow-ups/${created.body.id}`)
      .set('Cookie', otherCookies)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', otherCookies)
      .send({ subject: 'cross-org edit' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', otherCookies)
      .send({ status: 'CANCELLED' })
      .expect(404);

    // ...and the other org's list never contains it.
    const list = await request(app.getHttpServer())
      .get('/follow-ups?pageSize=100')
      .set('Cookie', otherCookies)
      .expect(200);
    expect(
      (list.body.data as Array<{ id: string }>).some((row) => row.id === created.body.id),
    ).toBe(false);
  });

  // --------------------------------------------------------------- create

  it('7. creates a follow-up with every optional field, resolving relations rather than denormalizing', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(
        basePayload({
          enquiryId: enquiryA.id,
          assignedToId: salesUser.id,
          description: 'Discuss the revised pricing.',
          notes: 'Client prefers a morning slot.',
          reminder: true,
          type: 'MEETING',
          priority: 'URGENT',
        }),
      )
      .expect(201);

    expect(res.body.clientId).toBe(clientA.id);
    expect(res.body.client).toEqual({ id: clientA.id, companyName: clientA.companyName });
    expect(res.body.enquiryId).toBe(enquiryA.id);
    expect(res.body.enquiry).toEqual({ id: enquiryA.id, title: enquiryA.title });
    expect(res.body.assignedToId).toBe(salesUser.id);
    expect(res.body.assignedTo.id).toBe(salesUser.id);
    expect(res.body.type).toBe('MEETING');
    expect(res.body.priority).toBe('URGENT');
    expect(res.body.reminder).toBe(true);
    expect(res.body.outcome).toBeNull();
  });

  it('8. rejects a create with no clientId', async () => {
    const cookies = await signIn(adminUser.email);
    const payload = basePayload();
    delete (payload as Record<string, unknown>).clientId;
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(payload)
      .expect(400);
  });

  it('9. rejects a create referencing an unknown client', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ clientId: 'does-not-exist' }))
      .expect(400);
  });

  it('10. rejects a create referencing a client in another organization', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ clientId: clientB.id }))
      .expect(400);
    expect(res.body.message).toContain('clientId');
  });

  it('11. rejects an invalid type, priority and scheduledAt', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ type: 'CARRIER_PIGEON' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ priority: 'CRITICAL' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ scheduledAt: 'next tuesday' }))
      .expect(400);
  });

  it('12. rejects unknown fields, and every system-managed field, via forbidNonWhitelisted', async () => {
    const cookies = await signIn(adminUser.email);

    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ somethingMadeUp: 'nope' }))
      .expect(400);

    // The exact injection payload from the spec: none of these are settable.
    const res = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(
        basePayload({
          organizationId: orgB.id,
          id: 'attacker-chosen-id',
          createdAt: isoInDays(-100),
          updatedAt: isoInDays(-100),
        }),
      )
      .expect(400);
    const message = JSON.stringify(res.body.message);
    expect(message).toContain('organizationId');
    expect(message).toContain('id');
    expect(message).toContain('createdAt');
    expect(message).toContain('updatedAt');

    // status/completedAt are likewise not part of the create surface.
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ status: 'COMPLETED' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ completedAt: isoInDays(-1) }))
      .expect(400);
  });

  it('13. ignores an organizationId injection attempt even when the org is the caller own — the session is the only source', async () => {
    const cookies = await signIn(adminUser.email);
    // Sending it at all is a 400 under forbidNonWhitelisted; the row created
    // without it always carries the session's organization.
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ organizationId: orgA.id }))
      .expect(400);

    const clean = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(clean.body.organizationId).toBe(orgA.id);
  });

  // -------------------------------------------------------- relationships

  it('14. accepts an enquiry belonging to the same client', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ enquiryId: enquiryA.id }))
      .expect(201);
    expect(res.body.enquiryId).toBe(enquiryA.id);
  });

  it('15. rejects an unknown enquiry, a cross-org enquiry, and an enquiry belonging to a different client', async () => {
    const cookies = await signIn(adminUser.email);

    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ enquiryId: 'does-not-exist' }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ enquiryId: enquiryB.id }))
      .expect(400);

    // clientId = Client A, enquiryId = an enquiry belonging to Client A2.
    const mismatch = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ clientId: clientA.id, enquiryId: enquiryA2.id }))
      .expect(400);
    expect(mismatch.body.message).toContain('same client');
  });

  it('16. re-validates enquiryId against the existing client on update, and allows explicit unlinking', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ enquiryId: enquiryA.id }))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ enquiryId: enquiryA2.id })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ enquiryId: enquiryB.id })
      .expect(400);

    const unlinked = await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ enquiryId: null })
      .expect(200);
    expect(unlinked.body.enquiryId).toBeNull();
    expect(unlinked.body.enquiry).toBeNull();
  });

  it('17. survives deletion of its enquiry with enquiryId set to null', async () => {
    const cookies = await signIn(adminUser.email);
    const doomedEnquiry = await createFixtureEnquiry(orgA.id, clientA.id);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ enquiryId: doomedEnquiry.id }))
      .expect(201);

    await prisma.enquiry.delete({ where: { id: doomedEnquiry.id } });

    const after = await request(app.getHttpServer())
      .get(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(after.body.id).toBe(created.body.id);
    expect(after.body.enquiryId).toBeNull();
  });

  it('18. accepts an assignee in the caller org and rejects a cross-org assignee', async () => {
    const cookies = await signIn(adminUser.email);

    const ok = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ assignedToId: salesUser.id }))
      .expect(201);
    expect(ok.body.assignedTo).toEqual({
      id: salesUser.id,
      name: 'FollowUp Sales Executive',
      email: salesUser.email,
    });

    const rejected = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ assignedToId: otherOrgAdmin.id }))
      .expect(400);
    expect(rejected.body.message).toContain('assignedToId');

    // Assignment stays optional.
    const unassigned = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(unassigned.body.assignedToId).toBeNull();
    expect(unassigned.body.assignedTo).toBeNull();
  });

  // ----------------------------------------------------------------- CRUD

  it('19. supports the full create/list/get/update/status round trip, persisting each change', async () => {
    const cookies = await signIn(adminUser.email);

    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ subject: `CRUD ${runId}`, notes: 'initial' }))
      .expect(201);
    const id = created.body.id as string;

    const listed = await request(app.getHttpServer())
      .get(`/follow-ups?search=CRUD ${runId}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(listed.body.data.map((row: { id: string }) => row.id)).toContain(id);

    const fetched = await request(app.getHttpServer())
      .get(`/follow-ups/${id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(fetched.body.notes).toBe('initial');

    const updated = await request(app.getHttpServer())
      .patch(`/follow-ups/${id}`)
      .set('Cookie', cookies)
      .send({ notes: 'updated', priority: 'HIGH', reminder: true })
      .expect(200);
    expect(updated.body.notes).toBe('updated');
    expect(updated.body.priority).toBe('HIGH');
    expect(updated.body.reminder).toBe(true);
    // Untouched keys are left exactly as they were.
    expect(updated.body.subject).toBe(`CRUD ${runId}`);
    expect(updated.body.status).toBe('SCHEDULED');

    const completed = await request(app.getHttpServer())
      .patch(`/follow-ups/${id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', outcome: 'Agreed next steps.' })
      .expect(200);
    expect(completed.body.status).toBe('COMPLETED');

    const reread = await request(app.getHttpServer())
      .get(`/follow-ups/${id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(reread.body.status).toBe('COMPLETED');
    expect(reread.body.outcome).toBe('Agreed next steps.');
    // Six sequential round trips plus a sign-in against a remote database —
    // genuinely slower than the suite-wide 20s default, so it gets its own
    // budget rather than flaking.
  }, 40000);

  it('20. rejects status and completedAt on PATCH /follow-ups/:id', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ completedAt: isoInDays(-1) })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ organizationId: orgB.id })
      .expect(400);
  });

  it('21. returns 404 for GET/PATCH of a follow-up id that does not exist at all', async () => {
    const cookies = await signIn(adminUser.email);
    await request(app.getHttpServer())
      .get('/follow-ups/no-such-follow-up')
      .set('Cookie', cookies)
      .expect(404);
    await request(app.getHttpServer())
      .patch('/follow-ups/no-such-follow-up')
      .set('Cookie', cookies)
      .send({ subject: 'nope' })
      .expect(404);
  });

  // --------------------------------------------------------------- status

  it('22. moves SCHEDULED -> COMPLETED, stamping completedAt server-side', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);
    expect(created.body.completedAt).toBeNull();

    const before = Date.now();
    const completed = await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', outcome: 'Demo delivered.' })
      .expect(200);
    const after = Date.now();

    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.outcome).toBe('Demo delivered.');
    const completedAt = new Date(completed.body.completedAt).getTime();
    // Generated at the moment of the request — not supplied, not defaulted
    // to the scheduled time.
    expect(completedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(completedAt).toBeLessThanOrEqual(after + 1000);
  });

  it('23. requires a non-empty, non-blank outcome to complete, and never accepts completedAt', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', outcome: '' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', outcome: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', outcome: 'ok', completedAt: isoInDays(-30) })
      .expect(400);

    // Still SCHEDULED — none of the rejected attempts wrote anything.
    const reread = await request(app.getHttpServer())
      .get(`/follow-ups/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(reread.body.status).toBe('SCHEDULED');
    expect(reread.body.completedAt).toBeNull();
  });

  it('24. moves SCHEDULED -> CANCELLED with no outcome required, and rejects OVERDUE as a status', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'CANCELLED' })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.completedAt).toBeNull();

    // OVERDUE is not a database status and must not be settable.
    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'OVERDUE' })
      .expect(400);
  });

  it('25. clears completedAt when moving away from COMPLETED, while preserving the outcome as history', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'COMPLETED', outcome: 'Recorded outcome.' })
      .expect(200);

    const reopened = await request(app.getHttpServer())
      .patch(`/follow-ups/${created.body.id}/status`)
      .set('Cookie', cookies)
      .send({ status: 'SCHEDULED' })
      .expect(200);
    expect(reopened.body.status).toBe('SCHEDULED');
    expect(reopened.body.completedAt).toBeNull();
    expect(reopened.body.outcome).toBe('Recorded outcome.');
  });

  // -------------------------------------------------------------- overdue

  it('26. derives isOverdue: past+SCHEDULED is overdue; future, completed and cancelled are not', async () => {
    const cookies = await signIn(adminUser.email);

    const pastScheduled = await seedFollowUp({ scheduledAt: new Date(Date.now() - 2 * DAY) });
    const futureScheduled = await seedFollowUp({ scheduledAt: new Date(Date.now() + 2 * DAY) });
    const pastCompleted = await seedFollowUp({
      scheduledAt: new Date(Date.now() - 2 * DAY),
      status: 'COMPLETED',
      completedAt: new Date(Date.now() - 1 * DAY),
      outcome: 'Done.',
    });
    const pastCancelled = await seedFollowUp({
      scheduledAt: new Date(Date.now() - 2 * DAY),
      status: 'CANCELLED',
    });

    const read = async (id: string) =>
      (await request(app.getHttpServer()).get(`/follow-ups/${id}`).set('Cookie', cookies).expect(200))
        .body;

    expect((await read(pastScheduled.id)).isOverdue).toBe(true);
    expect((await read(futureScheduled.id)).isOverdue).toBe(false);
    expect((await read(pastCompleted.id)).isOverdue).toBe(false);
    expect((await read(pastCancelled.id)).isOverdue).toBe(false);
  });

  it('27. never persists OVERDUE — the stored status column only ever holds the three real values', async () => {
    const stored = await prisma.followUp.findMany({
      where: { organizationId: orgA.id },
      select: { status: true },
    });
    expect(stored.length).toBeGreaterThan(0);
    for (const row of stored) {
      expect(['SCHEDULED', 'COMPLETED', 'CANCELLED']).toContain(row.status);
    }
  });

  // ------------------------------------------------------------ filtering

  describe('filtering', () => {
    const tag = `FILTER-${runId}`;
    let filterClient: { id: string; companyName: string };
    let filterEnquiry: { id: string };
    let overdueId: string;
    let futureId: string;
    let completedId: string;

    beforeAll(async () => {
      filterClient = await createFixtureClient(orgA.id, {
        companyName: `Filterable Widgets ${runId}`,
      });
      filterEnquiry = await createFixtureEnquiry(orgA.id, filterClient.id);

      const overdue = await seedFollowUp({
        clientId: filterClient.id,
        enquiryId: filterEnquiry.id,
        assignedToId: salesUser.id,
        subject: `${tag} overdue call`,
        type: 'CALL',
        priority: 'URGENT',
        scheduledAt: new Date(Date.now() - 5 * DAY),
      });
      const future = await seedFollowUp({
        clientId: filterClient.id,
        subject: `${tag} future demo`,
        type: 'DEMO',
        priority: 'LOW',
        scheduledAt: new Date(Date.now() + 10 * DAY),
      });
      const completed = await seedFollowUp({
        clientId: filterClient.id,
        subject: `${tag} completed email`,
        type: 'EMAIL',
        priority: 'HIGH',
        scheduledAt: new Date(Date.now() - 8 * DAY),
        status: 'COMPLETED',
        completedAt: new Date(Date.now() - 7 * DAY),
        outcome: 'Sent.',
      });

      overdueId = overdue.id;
      futureId = future.id;
      completedId = completed.id;
    }, 30000);

    async function ids(query: string): Promise<string[]> {
      const cookies = await signIn(adminUser.email);
      const res = await request(app.getHttpServer())
        .get(`/follow-ups?pageSize=100&${query}`)
        .set('Cookie', cookies)
        .expect(200);
      return (res.body.data as Array<{ id: string }>).map((row) => row.id);
    }

    it('28. filters by search across subject and client company name', async () => {
      const bySubject = await ids(`search=${encodeURIComponent(`${tag} future demo`)}`);
      expect(bySubject).toEqual([futureId]);

      const byCompany = await ids(`search=${encodeURIComponent(`Filterable Widgets ${runId}`)}`);
      expect(byCompany.sort()).toEqual([overdueId, futureId, completedId].sort());
    });

    it('29. filters by status', async () => {
      const completedOnly = await ids(`search=${encodeURIComponent(tag)}&status=COMPLETED`);
      expect(completedOnly).toEqual([completedId]);

      const scheduledOnly = await ids(`search=${encodeURIComponent(tag)}&status=SCHEDULED`);
      expect(scheduledOnly.sort()).toEqual([overdueId, futureId].sort());
    });

    it('30. filters by priority', async () => {
      expect(await ids(`search=${encodeURIComponent(tag)}&priority=URGENT`)).toEqual([overdueId]);
      expect(await ids(`search=${encodeURIComponent(tag)}&priority=LOW`)).toEqual([futureId]);
    });

    it('31. filters by type', async () => {
      expect(await ids(`search=${encodeURIComponent(tag)}&type=DEMO`)).toEqual([futureId]);
      expect(await ids(`search=${encodeURIComponent(tag)}&type=EMAIL`)).toEqual([completedId]);
    });

    it('32. filters by clientId', async () => {
      const byClient = await ids(`clientId=${filterClient.id}`);
      expect(byClient.sort()).toEqual([overdueId, futureId, completedId].sort());
    });

    it('33. filters by enquiryId', async () => {
      expect(await ids(`enquiryId=${filterEnquiry.id}`)).toEqual([overdueId]);
    });

    it('34. filters by assignedToId', async () => {
      const assigned = await ids(`search=${encodeURIComponent(tag)}&assignedToId=${salesUser.id}`);
      expect(assigned).toEqual([overdueId]);
    });

    it('35. filters by scheduledFrom / scheduledTo', async () => {
      const fromTomorrow = await ids(
        `search=${encodeURIComponent(tag)}&scheduledFrom=${encodeURIComponent(isoInDays(1))}`,
      );
      expect(fromTomorrow).toEqual([futureId]);

      const untilYesterday = await ids(
        `search=${encodeURIComponent(tag)}&scheduledTo=${encodeURIComponent(isoInDays(-1))}`,
      );
      expect(untilYesterday.sort()).toEqual([overdueId, completedId].sort());

      const window = await ids(
        `search=${encodeURIComponent(tag)}&scheduledFrom=${encodeURIComponent(isoInDays(-6))}` +
          `&scheduledTo=${encodeURIComponent(isoInDays(-1))}`,
      );
      expect(window).toEqual([overdueId]);
    });

    it('36. filters by the derived overdue flag in both directions', async () => {
      const overdue = await ids(`search=${encodeURIComponent(tag)}&overdue=true`);
      expect(overdue).toEqual([overdueId]);

      const notOverdue = await ids(`search=${encodeURIComponent(tag)}&overdue=false`);
      expect(notOverdue.sort()).toEqual([futureId, completedId].sort());

      // Every row the overdue filter returns agrees with its own isOverdue.
      const cookies = await signIn(adminUser.email);
      const res = await request(app.getHttpServer())
        .get('/follow-ups?pageSize=100&overdue=true')
        .set('Cookie', cookies)
        .expect(200);
      for (const row of res.body.data as Array<{ isOverdue: boolean; status: string }>) {
        expect(row.isOverdue).toBe(true);
        expect(row.status).toBe('SCHEDULED');
      }
    });

    it('37. combines overlapping filters instead of letting one overwrite another', async () => {
      // search, overdue and scheduledFrom/To each contribute their own
      // OR/scheduledAt clause. They must intersect, not clobber each other.
      const searchAndOverdue = await ids(
        `search=${encodeURIComponent(`Filterable Widgets ${runId}`)}&overdue=false`,
      );
      expect(searchAndOverdue.sort()).toEqual([futureId, completedId].sort());

      // overdue=true is "SCHEDULED and in the past"; the range restricts it
      // further rather than replacing it.
      const overdueInWindow = await ids(
        `search=${encodeURIComponent(tag)}&overdue=true` +
          `&scheduledFrom=${encodeURIComponent(isoInDays(-6))}`,
      );
      expect(overdueInWindow).toEqual([overdueId]);

      const overdueOutsideWindow = await ids(
        `search=${encodeURIComponent(tag)}&overdue=true` +
          `&scheduledFrom=${encodeURIComponent(isoInDays(-4))}`,
      );
      expect(overdueOutsideWindow).toEqual([]);
    });

    it('38. rejects an invalid filter value rather than ignoring it', async () => {
      const cookies = await signIn(adminUser.email);
      await request(app.getHttpServer())
        .get('/follow-ups?status=OVERDUE')
        .set('Cookie', cookies)
        .expect(400);
      await request(app.getHttpServer())
        .get('/follow-ups?overdue=maybe')
        .set('Cookie', cookies)
        .expect(400);
      await request(app.getHttpServer())
        .get('/follow-ups?scheduledFrom=yesterday')
        .set('Cookie', cookies)
        .expect(400);
    });
  });

  // ----------------------------------------------------------- pagination

  describe('pagination', () => {
    const tag = `PAGE-${runId}`;
    let pageClient: { id: string };

    beforeAll(async () => {
      pageClient = await createFixtureClient(orgA.id, { companyName: `Paged Co ${runId}` });
      for (let i = 0; i < 7; i += 1) {
        await seedFollowUp({
          clientId: pageClient.id,
          subject: `${tag} item ${i}`,
          // Distinct, ascending scheduledAt so the ordering under test is
          // deterministic rather than dependent on insertion timing.
          scheduledAt: new Date(Date.now() + (i + 1) * DAY),
        });
      }
    }, 30000);

    it('39. paginates with page/pageSize and reports total/totalPages', async () => {
      const cookies = await signIn(adminUser.email);

      const first = await request(app.getHttpServer())
        .get(`/follow-ups?clientId=${pageClient.id}&page=1&pageSize=3`)
        .set('Cookie', cookies)
        .expect(200);
      expect(first.body.data).toHaveLength(3);
      expect(first.body.total).toBe(7);
      expect(first.body.page).toBe(1);
      expect(first.body.pageSize).toBe(3);
      expect(first.body.totalPages).toBe(3);

      const last = await request(app.getHttpServer())
        .get(`/follow-ups?clientId=${pageClient.id}&page=3&pageSize=3`)
        .set('Cookie', cookies)
        .expect(200);
      expect(last.body.data).toHaveLength(1);
      expect(last.body.page).toBe(3);

      // Pages do not overlap.
      const firstIds = (first.body.data as Array<{ id: string }>).map((r) => r.id);
      const lastIds = (last.body.data as Array<{ id: string }>).map((r) => r.id);
      expect(firstIds.some((id) => lastIds.includes(id))).toBe(false);
    });

    it('40. accepts pageSize=100 and rejects pageSize=101', async () => {
      const cookies = await signIn(adminUser.email);
      await request(app.getHttpServer())
        .get('/follow-ups?pageSize=100')
        .set('Cookie', cookies)
        .expect(200);
      await request(app.getHttpServer())
        .get('/follow-ups?pageSize=101')
        .set('Cookie', cookies)
        .expect(400);
      await request(app.getHttpServer())
        .get('/follow-ups?pageSize=0')
        .set('Cookie', cookies)
        .expect(400);
      await request(app.getHttpServer())
        .get('/follow-ups?page=0')
        .set('Cookie', cookies)
        .expect(400);
    });

    it('41. orders by scheduledAt ascending — a follow-up list is read by when work is due', async () => {
      const cookies = await signIn(adminUser.email);
      const res = await request(app.getHttpServer())
        .get(`/follow-ups?clientId=${pageClient.id}&pageSize=100`)
        .set('Cookie', cookies)
        .expect(200);
      const times = (res.body.data as Array<{ scheduledAt: string }>).map((r) =>
        new Date(r.scheduledAt).getTime(),
      );
      expect(times).toEqual([...times].sort((a, b) => a - b));
    });
  });

  // ----------------------------------------------------- response shape

  it('42. returns exactly the SafeFollowUp surface and no raw Prisma internals', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', cookies)
      .send(basePayload({ enquiryId: enquiryA.id, assignedToId: salesUser.id }))
      .expect(201);

    expect(Object.keys(res.body).sort()).toEqual(
      [
        'assignedTo',
        'assignedToId',
        'client',
        'clientId',
        'completedAt',
        'createdAt',
        'description',
        'enquiry',
        'enquiryId',
        'id',
        'isOverdue',
        'notes',
        'organizationId',
        'outcome',
        'priority',
        'reminder',
        'scheduledAt',
        'status',
        'subject',
        'type',
        'updatedAt',
      ].sort(),
    );
    // Relations are trimmed to the display fields — no password hashes, no
    // nested organization objects, no Prisma Decimal wrappers.
    expect(Object.keys(res.body.assignedTo).sort()).toEqual(['email', 'id', 'name']);
    expect(Object.keys(res.body.client).sort()).toEqual(['companyName', 'id']);
    expect(Object.keys(res.body.enquiry).sort()).toEqual(['id', 'title']);
  });

  // -------------------------------------------------------------------
  // Phase 19 — Sales Executive client ownership
  // -------------------------------------------------------------------

  it('43. Sales Executive list shows only follow-ups whose client they own', async () => {
    const adminCookies = await signIn(adminUser.email);
    const salesCookies = await signIn(salesUser.email);
    const otherRepClient = await createFixtureClient(orgA.id, { assignedToId: salesUserB.id });
    const unassignedClient = await createFixtureClient(orgA.id);

    const ownFollowUp = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: clientOwnedBySales.id }))
      .expect(201);
    const otherRepFollowUp = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: otherRepClient.id }))
      .expect(201);
    const unassignedFollowUp = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: unassignedClient.id }))
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/follow-ups?pageSize=100')
      .set('Cookie', salesCookies)
      .expect(200);
    const ids: string[] = listRes.body.data.map((f: { id: string }) => f.id);
    expect(ids).toContain(ownFollowUp.body.id);
    expect(ids).not.toContain(otherRepFollowUp.body.id);
    expect(ids).not.toContain(unassignedFollowUp.body.id);
  });

  it('44. Sales Executive detail 404s on another-client and unassigned-client follow-ups', async () => {
    const adminCookies = await signIn(adminUser.email);
    const salesCookies = await signIn(salesUser.email);
    const otherRepClient = await createFixtureClient(orgA.id, { assignedToId: salesUserB.id });
    const unassignedClient = await createFixtureClient(orgA.id);

    const otherRepFollowUp = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: otherRepClient.id }))
      .expect(201);
    const unassignedFollowUp = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', adminCookies)
      .send(basePayload({ clientId: unassignedClient.id }))
      .expect(201);

    await request(app.getHttpServer())
      .get(`/follow-ups/${otherRepFollowUp.body.id}`)
      .set('Cookie', salesCookies)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/follow-ups/${unassignedFollowUp.body.id}`)
      .set('Cookie', salesCookies)
      .expect(404);
  });

  it('45. Sales Executive create against another user client is rejected (400)', async () => {
    const salesCookies = await signIn(salesUser.email);
    const otherRepClient = await createFixtureClient(orgA.id, { assignedToId: salesUserB.id });
    const unassignedClient = await createFixtureClient(orgA.id);

    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: otherRepClient.id }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: unassignedClient.id }))
      .expect(400);
  });

  it('46. Sales Executive create against own client works, and FollowUp.assignedToId remains freely settable', async () => {
    const salesCookies = await signIn(salesUser.email);
    const created = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: clientOwnedBySales.id, assignedToId: salesUserB.id }))
      .expect(201);
    expect(created.body.assignedTo.id).toBe(salesUserB.id);

    // Still visible to the owning Sales Executive despite assignedToId
    // pointing at a colleague — client ownership is authoritative.
    await request(app.getHttpServer())
      .get(`/follow-ups/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(200);
  });

  it('47. Admin and Super Admin retain organization-wide follow-up visibility', async () => {
    const salesCookies = await signIn(salesUser.email);
    const adminCookies = await signIn(adminUser.email);
    const superCookies = await signIn(superAdmin.email);

    const ownFollowUp = await request(app.getHttpServer())
      .post('/follow-ups')
      .set('Cookie', salesCookies)
      .send(basePayload({ clientId: clientOwnedBySales.id }))
      .expect(201);

    await request(app.getHttpServer())
      .get(`/follow-ups/${ownFollowUp.body.id}`)
      .set('Cookie', adminCookies)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get('/follow-ups?pageSize=100')
      .set('Cookie', superCookies)
      .expect(200);
    const ids: string[] = listRes.body.data.map((f: { id: string }) => f.id);
    expect(ids).toContain(ownFollowUp.body.id);
  });
});
