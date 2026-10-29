import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

// HTTP 서버 없이 모듈만 초기화한다. 프로세스를 살려 두는 것은 등록된 작업
// (아웃박스 릴레이 폴링, 컨슈머 등)이며, 작업이 없으면 바로 정상 종료한다
const app = await NestFactory.createApplicationContext(WorkerModule);
// SIGTERM·SIGINT를 받으면 onModuleDestroy → onApplicationShutdown 훅을 실행한다
app.enableShutdownHooks();
