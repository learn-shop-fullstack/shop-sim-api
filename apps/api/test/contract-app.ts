import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { products } from '../../../db/schema/products.js';
import { AppModule } from '../src/app.module.js';
import type { Config } from '../src/config.js';
import { CONFIG } from '../src/config.module.js';

// 개발 DB(shop_sim)를 건드리지 않도록 같은 서버의 별도 DB를 쓴다. .env는 읽지 않는다
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/shop_sim_test';

// AppModule 그대로(검증기·필터 포함) 빈 포트에 띄운다. 요청은 Node 내장 fetch로 보낸다.
// configure로 provider를 바꿔 끼울 수 있다(응답 검증 가드처럼 일부러 틀린 응답을 만들 때)
export async function startApp(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<{ baseUrl: string; app: INestApplication }> {
  const config: Config = { PORT: 0, DATABASE_URL: TEST_DATABASE_URL };
  const module = await configure(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(config),
  ).compile();
  const app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, app };
}

// 테스트가 데이터를 넣고 지우는 연결. 앱의 풀과 별개다
let pool: Pool | undefined;
const testDb = () => drizzle({ client: (pool ??= new Pool({ connectionString: TEST_DATABASE_URL })) });

export async function closeTestDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export async function resetProducts(): Promise<void> {
  await testDb().execute(sql`TRUNCATE products`);
}

// 기본값은 공개 완제품이다. 테스트는 바꿀 값만 넘긴다
export async function insertProduct(overrides: Partial<typeof products.$inferInsert> = {}): Promise<string> {
  const [row] = await testDb()
    .insert(products)
    .values({
      sellerId: '0190f5d2-0000-7000-8000-000000000001',
      categoryId: '0190f5d2-0000-7000-8000-000000000002',
      name: '테스트 상품',
      type: 'FINISHED',
      price: 1000,
      detailContent: {},
      status: 'PUBLISHED',
      publishedAt: new Date(),
      ...overrides,
    })
    .returning({ id: products.id });
  return row.id;
}
