import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './health/health.controller.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

@Module({
  controllers: [HealthController],
  // APP_FILTER로 등록하면 필터가 DI 컨테이너에서 만들어져 의존성을 주입받는다
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
