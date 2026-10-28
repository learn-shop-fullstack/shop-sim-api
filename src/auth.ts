import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './db/auth-schema';

const db = drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL }) });

export const auth = betterAuth({
  baseURL: 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  // 테이블 이름이 복수(users, sessions …)라 usePlural
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  // id는 DB의 DEFAULT uuidv7()에 맡긴다
  advanced: { database: { generateId: false } },
  emailAndPassword: { enabled: true },
});
