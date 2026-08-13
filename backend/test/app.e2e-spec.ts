import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
// Imported from the compiled dist output, not TS source: the
// Prisma-generated client (pulled in transitively via AppModule -> auth.ts)
// requires sibling .js files that only exist after `npm run build`; ts-jest
// re-transpiling the raw .ts source on the fly cannot resolve them. Run
// `npm run build` before `npm run test:e2e`.
import { AppModule } from '../dist/src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
