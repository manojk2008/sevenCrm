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

describe('OrganizationsController (e2e)', () => {
  let app: INestApplication<App>;

  let orgA: { id: string; name: string; slug: string };
  let orgB: { id: string; name: string; slug: string };
  let superAdmin: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let salesUser: { id: string; email: string };

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
      data: { name: `Org Settings Test A ${runId}`, slug: `org-settings-test-a-${runId}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org Settings Test B ${runId}`, slug: `org-settings-test-b-${runId}` },
    });

    superAdmin = await createFixtureUser({
      email: `orgsettings-super-${runId}@test.local`,
      name: 'Org Settings Super Admin',
      organizationId: orgA.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });
    adminUser = await createFixtureUser({
      email: `orgsettings-admin-${runId}@test.local`,
      name: 'Org Settings Admin',
      organizationId: orgA.id,
      role: 'ADMIN',
      department: 'Operations',
    });
    salesUser = await createFixtureUser({
      email: `orgsettings-sales-${runId}@test.local`,
      name: 'Org Settings Sales Executive',
      organizationId: orgA.id,
      role: 'SALES_EXECUTIVE',
      department: 'Sales',
    });
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await app.close();
    await prisma.$disconnect();
  }, 30000);

  it('1. rejects GET /organizations/me when unauthenticated', async () => {
    await request(app.getHttpServer()).get('/organizations/me').expect(401);
  });

  it('2. rejects PATCH /organizations/me when unauthenticated', async () => {
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .send({ name: 'Nobody' })
      .expect(401);
  });

  it('3. allows SUPER_ADMIN to GET', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/organizations/me')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.id).toBe(orgA.id);
  });

  it('4. allows ADMIN to GET', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .get('/organizations/me')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.id).toBe(orgA.id);
  });

  it('5. allows SALES_EXECUTIVE to GET', async () => {
    const cookies = await signIn(salesUser.email);
    const res = await request(app.getHttpServer())
      .get('/organizations/me')
      .set('Cookie', cookies)
      .expect(200);
    expect(res.body.id).toBe(orgA.id);
  });

  it('6. allows SUPER_ADMIN to PATCH', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ name: 'Updated By Super Admin' })
      .expect(200);
    expect(res.body.name).toBe('Updated By Super Admin');
  });

  it('7. allows ADMIN to PATCH', async () => {
    const cookies = await signIn(adminUser.email);
    const res = await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ name: 'Updated By Admin' })
      .expect(200);
    expect(res.body.name).toBe('Updated By Admin');
  });

  it('8. rejects PATCH by SALES_EXECUTIVE with 403', async () => {
    const cookies = await signIn(salesUser.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ name: 'Should Not Save' })
      .expect(403);
  });

  it('9. persists a name update', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ name: 'Persisted Org Name' })
      .expect(200);
    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(stored.name).toBe('Persisted Org Name');
  });

  it('10. persists an address update', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ address: '123 Business Park, Sector 4' })
      .expect(200);
    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(stored.address).toBe('123 Business Park, Sector 4');
  });

  it('11. persists a phone update', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ phone: '+919876500000' })
      .expect(200);
    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(stored.phone).toBe('+919876500000');
  });

  it('12. persists an email update', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ email: 'contact@org-settings-test.local' })
      .expect(200);
    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(stored.email).toBe('contact@org-settings-test.local');
  });

  it('13. persists a website update', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ website: 'https://org-settings-test.local' })
      .expect(200);
    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(stored.website).toBe('https://org-settings-test.local');
  });

  it('14. persists a gstNumber update', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ gstNumber: '29ABCDE1234F1Z5' })
      .expect(200);
    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(stored.gstNumber).toBe('29ABCDE1234F1Z5');
  });

  it('15. leaves omitted fields unchanged', async () => {
    const cookies = await signIn(superAdmin.email);
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });

    const res = await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ name: 'Name Only Change' })
      .expect(200);

    expect(res.body.name).toBe('Name Only Change');
    expect(res.body.address).toBe(before.address);
    expect(res.body.phone).toBe(before.phone);
    expect(res.body.email).toBe(before.email);
    expect(res.body.website).toBe(before.website);
    expect(res.body.gstNumber).toBe(before.gstNumber);
  });

  it('16. rejects an invalid email', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('17. rejects invalid field types', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ name: 12345 })
      .expect(400);
  });

  it('18. rejects unknown fields', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ favoriteColor: 'blue' })
      .expect(400);
  });

  it('19. rejects organizationId injection and never moves the caller to another org', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ organizationId: orgB.id, name: 'Should Not Save' })
      .expect(400);
  });

  it('20. rejects id injection', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ id: orgB.id, name: 'Should Not Save' })
      .expect(400);
  });

  it('21. rejects slug injection (slug is not editable in this phase)', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ slug: 'hijacked-slug', name: 'Should Not Save' })
      .expect(400);

    const stored = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(stored.slug).toBe(orgA.slug);
  });

  it('22. rejects createdAt/updatedAt injection', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ createdAt: '2000-01-01T00:00:00.000Z', name: 'Should Not Save' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ updatedAt: '2000-01-01T00:00:00.000Z', name: 'Should Not Save' })
      .expect(400);
  });

  it('23. rejects role/userId injection', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ role: 'SUPER_ADMIN', name: 'Should Not Save' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ userId: superAdmin.id, name: 'Should Not Save' })
      .expect(400);
  });

  it('24. changes survive a fresh authenticated request', async () => {
    const firstCookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', firstCookies)
      .send({ name: 'Survives Reload' })
      .expect(200);

    const freshCookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/organizations/me')
      .set('Cookie', freshCookies)
      .expect(200);

    expect(res.body.name).toBe('Survives Reload');
  });

  it('25. organization isolation: org B users never see or affect org A', async () => {
    const otherOrgUser = await createFixtureUser({
      email: `orgsettings-otherorg-${runId}@test.local`,
      name: 'Other Org Super Admin',
      organizationId: orgB.id,
      role: 'SUPER_ADMIN',
      department: 'Management',
    });

    const cookies = await signIn(otherOrgUser.email);
    const getRes = await request(app.getHttpServer())
      .get('/organizations/me')
      .set('Cookie', cookies)
      .expect(200);
    expect(getRes.body.id).toBe(orgB.id);
    expect(getRes.body.id).not.toBe(orgA.id);

    await request(app.getHttpServer())
      .patch('/organizations/me')
      .set('Cookie', cookies)
      .send({ name: 'Org B Renamed' })
      .expect(200);

    const orgAAfter = await prisma.organization.findUniqueOrThrow({ where: { id: orgA.id } });
    expect(orgAAfter.name).not.toBe('Org B Renamed');
  });

  it('26. exact safe response surface', async () => {
    const cookies = await signIn(superAdmin.email);
    const res = await request(app.getHttpServer())
      .get('/organizations/me')
      .set('Cookie', cookies)
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(
      [
        'address',
        'createdAt',
        'email',
        'gstNumber',
        'id',
        'name',
        'phone',
        'slug',
        'updatedAt',
        'website',
        // Phase 17 Branding — approved additions to the Organization API
        // contract (see OrganizationsService.toSafeOrganization).
        'primaryColor',
        'secondaryColor',
        'quotationHeaderText',
        'quotationFooterText',
      ].sort(),
    );
    expect(res.body).not.toHaveProperty('users');
    expect(res.body).not.toHaveProperty('sessions');
    expect(res.body).not.toHaveProperty('accounts');
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('password');
  });

  it('27. no write route beyond PATCH /organizations/me', async () => {
    const cookies = await signIn(superAdmin.email);
    await request(app.getHttpServer())
      .post('/organizations')
      .set('Cookie', cookies)
      .send({ name: 'New Org' })
      .expect(404);
    await request(app.getHttpServer())
      .delete('/organizations/me')
      .set('Cookie', cookies)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/organizations/${orgA.id}`)
      .set('Cookie', cookies)
      .send({ name: 'Direct Id Patch' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/organizations/${orgA.id}`)
      .set('Cookie', cookies)
      .expect(404);
  });
});
