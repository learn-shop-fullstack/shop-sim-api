import { resolve } from 'node:path';
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import * as OpenApiValidator from 'express-openapi-validator';
import { HealthController } from './health/health.controller.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

@Module({
  controllers: [HealthController],
  // APP_FILTER로 등록하면 필터가 DI 컨테이너에서 만들어져 의존성을 주입받는다
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule implements NestModule {
  // 스펙과 다른 요청을 컨트롤러 전에 거절한다(ADR 0012). app.use()가 아니라 Nest 미들웨어로 걸어야
  // 검증기 오류가 Nest 예외 처리를 거쳐 ProblemDetailsFilter에 닿는다
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        ...OpenApiValidator.middleware({
          // generate가 합친 스펙. 개발·테스트·배포 이미지 모두 레포 루트에서 실행한다
          apiSpec: resolve('dist/openapi/openapi.yaml'),
          validateRequests: true,
          validateResponses: false,
        }),
      )
      .forRoutes('{*splat}');
  }
}
