import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './db/auth-schema';

const db = drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL }) });

export const auth = betterAuth({
  baseURL: process.env.AUTH_BASE_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  // 테이블 이름이 복수(users, sessions …)라 usePlural
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  // id는 DB의 DEFAULT uuidv7()에 맡긴다
  // 세션 쿠키를 상위 도메인에 걸어 shop.·seller. 하위 도메인이 같은 로그인을 쓴다(셀러센터 SSO)
  trustedOrigins: process.env.AUTH_TRUSTED_ORIGINS?.split(','),
  advanced: {
    database: { generateId: false },
    crossSubDomainCookies: process.env.AUTH_COOKIE_DOMAIN
      ? { enabled: true, domain: process.env.AUTH_COOKIE_DOMAIN }
      : undefined,
  },
  emailAndPassword: { enabled: true },
});
