import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { TEST_DATABASE_URL } from './contract-app.js';

// 계약 테스트 실행 전에 한 번: 테스트 DB가 없으면 만들고 커밋된 마이그레이션을 적용한다.
// 마이그레이션 파일이 스키마 코드와 어긋나면 여기나 테스트에서 드러난다
export default async function setup(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  // CREATE DATABASE는 이름을 파라미터로 받지 못한다. 식별자로 안전한 이름만 허용한다
  if (!/^\w+$/.test(name)) throw new Error(`테스트 DB 이름이 잘못됐다: ${name}`);

  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await migrate(drizzle({ client }), { migrationsFolder: 'db/migrations' });
  } finally {
    await client.end();
  }
}
