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

describe('EmailTemplatesController (e2e)', () => {
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
        name: `Email Test Org A ${runId}`,
        slug: `email-test-org-a-${runId}`,
      },
    });
    orgB = await prisma.organization.create({
      data: {
        name: `Email Test Org B ${runId}`,
        slug: `email-test-org-b-${runId}`,
      },
    });

    superAdmin = await createFixtureUser({
      email: `email-super-${runId}@test.local`,
      name: 'Email Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `email-admin-${runId}@test.local`,
      name: 'Email Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `email-sales-${runId}@test.local`,
      name: 'Email Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
    otherOrgUser = await createFixtureUser({
      email: `email-otherorg-${runId}@test.local`,
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
    await prisma.emailTemplate.deleteMany({
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

  it('1. rejects unauthenticated GET /email-templates with 401', async () => {
    await request(app.getHttpServer()).get('/email-templates').expect(401);
  });

  it('2. rejects unauthenticated POST /email-templates with 401', async () => {
    await request(app.getHttpServer())
      .post('/email-templates')
      .send({ key: 'WELCOME', subject: 'X', body: 'Y' })
      .expect(401);
  });

  // -------------------------------------------------------------------
  // RBAC — SUPER_ADMIN / ADMIN full access, SALES_EXECUTIVE none
  // -------------------------------------------------------------------

  it('3. SUPER_ADMIN can create, read and update', async () => {
    const cookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'Welcome!', body: 'Hi {{client_name}}' })
      .expect(201);
    expect(created.body.key).toBe('WELCOME');

    await request(app.getHttpServer())
      .get(`/email-templates/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/email-templates/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ subject: 'Welcome aboard!' })
      .expect(200);
  });

  it('4. ADMIN can create, read and update', async () => {
    const cookies = await signIn(adminUser.email);
    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({
        key: 'QUOTATION_SENT',
        subject: 'Your quotation',
        body: 'Dear {{client_name}}',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/email-templates/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/email-templates/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ body: 'Dear {{client_name}}, updated.' })
      .expect(200);
  });

  it('5. SALES_EXECUTIVE is rejected on every route (403), including read', async () => {
    const superCookies = await signIn(superAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', superCookies)
      .send({ key: 'FOLLOW_UP_REMINDER', subject: 'Reminder', body: 'Hi' })
      .expect(201);

    const salesCookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .get('/email-templates')
      .set('Cookie', salesCookies)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/email-templates/${created.body.id}`)
      .set('Cookie', salesCookies)
      .expect(403);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', salesCookies)
      .send({ key: 'WELCOME', subject: 'X', body: 'Y' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/email-templates/${created.body.id}`)
      .set('Cookie', salesCookies)
      .send({ subject: 'Hijacked' })
      .expect(403);
  });

  // -------------------------------------------------------------------
  // TENANT ISOLATION
  // -------------------------------------------------------------------

  it('6. cross-org GET returns 404', async () => {
    // orgA already has all three keys used up by tests 3-5's setup, so this
    // (and every other test below that needs a fresh key) uses its own
    // isolated org — same reasoning as test 14's dupOrg.
    const dupOrg = await prisma.organization.create({
      data: {
        name: `CrossOrgGet Org ${runId}`,
        slug: `crossorgget-org-${runId}`,
      },
    });
    const dupAdmin = await createFixtureUser({
      email: `crossorgget-admin-${runId}@test.local`,
      name: 'CrossOrgGet Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const ownerCookies = await signIn(dupAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', ownerCookies)
      .send({ key: 'WELCOME', subject: 'Org A only', body: 'Body' })
      .expect(201);

    const otherOrgCookies = await signIn(otherOrgUser.email);
    await request(app.getHttpServer())
      .get(`/email-templates/${created.body.id}`)
      .set('Cookie', otherOrgCookies)
      .expect(404);

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  it('7. cross-org PATCH returns 404', async () => {
    const dupOrg = await prisma.organization.create({
      data: {
        name: `CrossOrgPatch Org ${runId}`,
        slug: `crossorgpatch-org-${runId}`,
      },
    });
    const dupAdmin = await createFixtureUser({
      email: `crossorgpatch-admin-${runId}@test.local`,
      name: 'CrossOrgPatch Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const ownerCookies = await signIn(dupAdmin.email);
    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', ownerCookies)
      .send({
        key: 'QUOTATION_SENT',
        subject: 'Org A patch target',
        body: 'Body',
      })
      .expect(201);

    const otherOrgCookies = await signIn(otherOrgUser.email);
    await request(app.getHttpServer())
      .patch(`/email-templates/${created.body.id}`)
      .set('Cookie', otherOrgCookies)
      .send({ subject: 'Hijacked' })
      .expect(404);

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  it('8. organizationId injection is rejected on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({
        key: 'FOLLOW_UP_REMINDER',
        subject: 'X',
        body: 'Y',
        organizationId: orgB.id,
      })
      .expect(400);
  });

  // -------------------------------------------------------------------
  // VALIDATION
  // -------------------------------------------------------------------

  it('9. rejects a missing key', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ subject: 'X', body: 'Y' })
      .expect(400);
  });

  it('10. rejects a key outside the closed set', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'BIRTHDAY_EMAIL', subject: 'X', body: 'Y' })
      .expect(400);
  });

  it('11. rejects a missing subject', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', body: 'Y' })
      .expect(400);
  });

  it('12. rejects a missing body', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'X' })
      .expect(400);
  });

  it('13. rejects unknown fields on create', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'X', body: 'Y', sentCount: 5 })
      .expect(400);
  });

  // Each `it` below in this org-scoped duplicate-key test uses a distinct
  // org so the [organizationId, key] uniqueness check under test is never
  // confused with cross-test pollution.
  it('14. rejects a duplicate key within the same organization', async () => {
    const dupOrg = await prisma.organization.create({
      data: { name: `Dup Key Org ${runId}`, slug: `dup-key-org-${runId}` },
    });
    const dupAdmin = await createFixtureUser({
      email: `dup-admin-${runId}@test.local`,
      name: 'Dup Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const cookies = await signIn(dupAdmin.email);

    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'First', body: 'First body' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'Second', body: 'Second body' })
      .expect(409);

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  it('15. the same key is allowed across different organizations', async () => {
    // orgA already has FOLLOW_UP_REMINDER from test 5's setup, so this uses
    // its own fresh org for the "org A side" of the comparison — otherOrgUser
    // (orgB) is still reused since orgB has no templates yet.
    const dupOrg = await prisma.organization.create({
      data: { name: `SameKey Org ${runId}`, slug: `samekey-org-${runId}` },
    });
    const dupAdmin = await createFixtureUser({
      email: `samekey-admin-${runId}@test.local`,
      name: 'SameKey Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const cookies = await signIn(dupAdmin.email);
    const otherCookies = await signIn(otherOrgUser.email);

    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({
        key: 'FOLLOW_UP_REMINDER',
        subject: 'Org A reminder',
        body: 'Body A',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', otherCookies)
      .send({
        key: 'FOLLOW_UP_REMINDER',
        subject: 'Org B reminder',
        body: 'Body B',
      })
      .expect(201);

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  // -------------------------------------------------------------------
  // CREATE / LIST / GET / UPDATE
  // -------------------------------------------------------------------

  it('16. valid create succeeds and response matches the exact SafeEmailTemplate shape', async () => {
    const dupOrg = await prisma.organization.create({
      data: { name: `Shape Org ${runId}`, slug: `shape-org-${runId}` },
    });
    const dupAdmin = await createFixtureUser({
      email: `shape-admin-${runId}@test.local`,
      name: 'Shape Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const cookies = await signIn(dupAdmin.email);

    const res = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'Shape check', body: 'Body' })
      .expect(201);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'id',
        'organizationId',
        'key',
        'subject',
        'body',
        'createdAt',
        'updatedAt',
      ].sort(),
    );

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  it('17. list returns created templates for the caller org only', async () => {
    const cookies = await signIn(superAdmin.email);
    const list = await request(app.getHttpServer())
      .get('/email-templates')
      .set('Cookie', cookies)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(
      list.body.every(
        (t: { organizationId: string }) => t.organizationId === orgA.id,
      ),
    ).toBe(true);
  });

  it('18. GET by id returns the correct template', async () => {
    const dupOrg = await prisma.organization.create({
      data: { name: `GetById Org ${runId}`, slug: `getbyid-org-${runId}` },
    });
    const dupAdmin = await createFixtureUser({
      email: `getbyid-admin-${runId}@test.local`,
      name: 'GetById Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const cookies = await signIn(dupAdmin.email);

    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'Get by id', body: 'Body' })
      .expect(201);
    const fetched = await request(app.getHttpServer())
      .get(`/email-templates/${created.body.id}`)
      .set('Cookie', cookies)
      .expect(200);
    expect(fetched.body.id).toBe(created.body.id);
    expect(fetched.body.subject).toBe('Get by id');

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  it('19. PATCH persists subject/body changes', async () => {
    const dupOrg = await prisma.organization.create({
      data: { name: `Patch Org ${runId}`, slug: `patch-org-${runId}` },
    });
    const dupAdmin = await createFixtureUser({
      email: `patch-admin-${runId}@test.local`,
      name: 'Patch Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const cookies = await signIn(dupAdmin.email);

    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'Before', body: 'Before body' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/email-templates/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ subject: 'After', body: 'After body' })
      .expect(200);
    expect(updated.body.subject).toBe('After');
    expect(updated.body.body).toBe('After body');

    const stored = await prisma.emailTemplate.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(stored.subject).toBe('After');

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  it('20. omitted fields on PATCH remain unchanged', async () => {
    const dupOrg = await prisma.organization.create({
      data: {
        name: `Patch Omit Org ${runId}`,
        slug: `patch-omit-org-${runId}`,
      },
    });
    const dupAdmin = await createFixtureUser({
      email: `patch-omit-admin-${runId}@test.local`,
      name: 'Patch Omit Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const cookies = await signIn(dupAdmin.email);

    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', cookies)
      .send({ key: 'WELCOME', subject: 'Keep me', body: 'Keep body' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/email-templates/${created.body.id}`)
      .set('Cookie', cookies)
      .send({ subject: 'Changed subject only' })
      .expect(200);
    expect(updated.body.body).toBe('Keep body');

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  // -------------------------------------------------------------------
  // PERSISTENCE / NO DELETE
  // -------------------------------------------------------------------

  it('21. changes survive a fresh authenticated request', async () => {
    const dupOrg = await prisma.organization.create({
      data: { name: `Fresh Org ${runId}`, slug: `fresh-org-${runId}` },
    });
    const dupAdmin = await createFixtureUser({
      email: `fresh-admin-${runId}@test.local`,
      name: 'Fresh Admin',
      organizationId: dupOrg.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    const firstCookies = await signIn(dupAdmin.email);

    const created = await request(app.getHttpServer())
      .post('/email-templates')
      .set('Cookie', firstCookies)
      .send({ key: 'WELCOME', subject: 'Before fresh', body: 'Body' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/email-templates/${created.body.id}`)
      .set('Cookie', firstCookies)
      .send({ subject: 'Survives fresh request' })
      .expect(200);

    const freshCookies = await signIn(dupAdmin.email);
    const res = await request(app.getHttpServer())
      .get(`/email-templates/${created.body.id}`)
      .set('Cookie', freshCookies)
      .expect(200);
    expect(res.body.subject).toBe('Survives fresh request');

    await prisma.emailTemplate.deleteMany({
      where: { organizationId: dupOrg.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: dupOrg.id } });
    await prisma.organization.deleteMany({ where: { id: dupOrg.id } });
  });

  it('22. there is no DELETE /email-templates/:id route', async () => {
    const cookies = await signIn(superAdmin.email);
    const list = await request(app.getHttpServer())
      .get('/email-templates')
      .set('Cookie', cookies)
      .expect(200);
    const anyId = list.body[0]?.id ?? 'nonexistent-id';
    await request(app.getHttpServer())
      .delete(`/email-templates/${anyId}`)
      .set('Cookie', cookies)
      .expect(404);
  });
});
