import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import type { Config } from '../src/config.js';
import { CONFIG } from '../src/config.module.js';

// 개발 DB(shop_sim)를 건드리지 않도록 같은 서버의 별도 DB를 쓴다. .env는 읽지 않는다
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/shop_sim_test';

// AppModule 그대로(검증기·필터 포함) 빈 포트에 띄운다. 요청은 Node 내장 fetch로 보낸다
export async function startApp(): Promise<{ baseUrl: string; app: INestApplication }> {
  const config: Config = { PORT: 0, DATABASE_URL: TEST_DATABASE_URL };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CONFIG)
    .useValue(config)
    .compile();
  const app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, app };
}
