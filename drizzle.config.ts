import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// 앱 코드가 아닌 도구 설정이라 config.ts(Zod)를 거치지 않는다. drizzle-kit은 .env를 스스로 읽지 않는다.
// generate는 DB 접속이 필요 없어 .env가 없는 곳(CI)에서도 돌아야 하므로 파일이 있을 때만 읽는다
if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema',
  out: './db/migrations',
  // migrate에만 필요하다. 없으면 drizzle-kit이 접속할 때 실패한다
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
