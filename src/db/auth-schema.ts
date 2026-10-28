import { sql } from 'drizzle-orm';
import { boolean, foreignKey, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

// Better Auth core 테이블을 db/ERD.md 공통 규칙으로 직접 정의한다.
// TS 키는 Better Auth 필드 이름(emailVerified, userId …)과 같아야 어댑터가 찾는다
const id = () => uuid('id').primaryKey().default(sql`uuidv7()`);
const at = (name: string) => timestamp(name, { withTimezone: true });
const timestamps = () => ({
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// 일반 계정('')과 운영자 계정('admin_')이 같은 구조의 별도 테이블을 쓴다
function authTables(prefix: '' | 'admin_') {
  const users = pgTable(`${prefix}users`, {
    id: id(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(`${prefix}users_email_key`),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    ...timestamps(),
  });

  const sessions = pgTable(
    `${prefix}sessions`,
    {
      id: id(),
      userId: uuid('user_id').notNull(),
      token: text('token').notNull().unique(`${prefix}sessions_token_key`),
      expiresAt: at('expires_at').notNull(),
      ipAddress: text('ip_address'),
      userAgent: text('user_agent'),
      ...timestamps(),
    },
    (t) => [
      foreignKey({ name: `${prefix}sessions_user_id_fkey`, columns: [t.userId], foreignColumns: [users.id] }).onDelete('cascade'),
      index(`${prefix}sessions_user_id_idx`).on(t.userId),
    ],
  );

  const accounts = pgTable(
    `${prefix}accounts`,
    {
      id: id(),
      userId: uuid('user_id').notNull(),
      accountId: text('account_id').notNull(),
      providerId: text('provider_id').notNull(),
      accessToken: text('access_token'),
      refreshToken: text('refresh_token'),
      idToken: text('id_token'),
      accessTokenExpiresAt: at('access_token_expires_at'),
      refreshTokenExpiresAt: at('refresh_token_expires_at'),
      scope: text('scope'),
      password: text('password'),
      ...timestamps(),
    },
    (t) => [
      foreignKey({ name: `${prefix}accounts_user_id_fkey`, columns: [t.userId], foreignColumns: [users.id] }).onDelete('cascade'),
      // 같은 소셜 계정이 두 사용자에게 연결되지 않게 한다
      unique(`${prefix}accounts_provider_id_account_id_key`).on(t.providerId, t.accountId),
      index(`${prefix}accounts_user_id_idx`).on(t.userId),
    ],
  );

  const verifications = pgTable(
    `${prefix}verifications`,
    {
      id: id(),
      identifier: text('identifier').notNull(),
      value: text('value').notNull(),
      expiresAt: at('expires_at').notNull(),
      ...timestamps(),
    },
    (t) => [index(`${prefix}verifications_identifier_idx`).on(t.identifier)],
  );

  return { users, sessions, accounts, verifications };
}

export const { users, sessions, accounts, verifications } = authTables('');

const admin = authTables('admin_');
export const adminUsers = admin.users;
export const adminSessions = admin.sessions;
export const adminAccounts = admin.accounts;
export const adminVerifications = admin.verifications;
