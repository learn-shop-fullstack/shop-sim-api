import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { auth } from './auth';

async function bootstrap() {
  // Better Auth는 요청 본문 스트림을 직접 읽는다. Nest 기본 파서가 먼저 읽으면 본문이 비므로 끈다
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // 순서가 중요하다: 인증 핸들러 → JSON 파서 → Nest 라우트
  app.getHttpAdapter().getInstance().all('/api/auth/*splat', toNodeHandler(auth));
  app.use(express.json());
  // /api/auth/*는 Better Auth가 계약을 소유한다. 우리 스펙에 없으므로 검증에서 뺀다
  app.use(
    OpenApiValidator.middleware({
      apiSpec: join(__dirname, '../openapi/openapi.yaml'),
      validateRequests: true,
      validateResponses: true,
      ignorePaths: /^\/api\/auth\//,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
