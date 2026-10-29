import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Config } from './config.js';
import { CONFIG } from './config.module.js';

const app = await NestFactory.create(AppModule);
// SIGTERM·SIGINT를 받으면 HTTP 서버를 닫고 onApplicationShutdown 훅(DB 풀 종료 등)을 실행한다
app.enableShutdownHooks();
await app.listen(app.get<Config>(CONFIG).PORT);
