import { Global, Module } from '@nestjs/common';
import { loadConfig } from './config.js';

// Config는 Zod에서 뽑은 타입이라 실행 시점에 없다. 그래서 클래스 대신 이 토큰으로 주입한다.
// 쓰는 쪽: constructor(@Inject(CONFIG) private readonly config: Config)
export const CONFIG = Symbol('CONFIG');

// 거의 모든 모듈이 설정을 쓰므로 전역으로 둔다. 값이 잘못되면 provider를 만들 때 throw하고,
// Nest가 로그를 남긴 뒤 종료 코드 1로 끝낸다. 요청을 받기 전에 실패한다
@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => loadConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
