import { resolve } from 'node:path';
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import * as OpenApiValidator from 'express-openapi-validator';
import { ConfigModule } from './config.module.js';
import { HealthController } from './health/health.controller.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

@Module({
  imports: [ConfigModule],
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
          // 스펙과 다른 응답(없는 상태 코드, 스키마 위반)을 500으로 막는다. 모든 환경에서 켠다.
          // 5xx와 검증기 자신의 400·404·405는 검증하지 않는다. 요청 검증을 통과한 뒤의 응답만 본다
          validateResponses: true,
        }),
      )
      .forRoutes('{*splat}');
  }
}
