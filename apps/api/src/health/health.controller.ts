import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import type { HealthControllerMethods } from '../generated/openapi/nestjs.gen.js';

// 스펙의 operation을 생성 타입으로 구현한다. 스펙과 어긋나면 빌드가 실패한다(ADR 0012)
@Controller('health')
export class HealthController implements Pick<HealthControllerMethods, 'getHealth'> {
  @Get()
  @HttpCode(HttpStatus.NO_CONTENT)
  async getHealth(): Promise<void> {}
}
