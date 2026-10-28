import { and, asc, eq, lt, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { payments } from '../db/schema/payments.ts';

process.loadEnvFile();
// 트랜잭션은 끝날 때까지 커넥션 하나를 붙잡는다. A가 락을 쥔 채로 B·C를 돌리려면 2개 필요
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const db = drizzle({ client: pool, logger: true });

await db.delete(payments);
await db.insert(payments).values(
  [4, 3, 2, 1].map((min, i) => ({ amount: 1000 * (i + 1), expiresAt: new Date(Date.now() - min * 60_000) })),
);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// 결제 타임아웃 스윕: 만료된 PENDING 결제를 오래된 순으로 2건 가져가 잠근다
const claimExpired = (tx: Tx, skipLocked: boolean) =>
  tx
    .select({ id: payments.id, amount: payments.amount })
    .from(payments)
    .where(and(eq(payments.status, 'PENDING'), lt(payments.expiresAt, sql`now()`)))
    .orderBy(asc(payments.expiresAt))
    .limit(2)
    .for('update', { skipLocked });

let markClaimed!: () => void;
let releaseA!: () => void;
const claimed = new Promise<void>((r) => (markClaimed = r));
const released = new Promise<void>((r) => (releaseA = r));

const a = db.transaction(async (tx) => {
  console.log('A', await claimExpired(tx, true));
  markClaimed();
  await released; // 커밋하지 않고 락을 쥔 채 기다린다
});
await claimed;

await db.transaction(async (tx) => {
  console.log('B (skip locked)', await claimExpired(tx, true));
});

await db
  .transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '1s'`);
    await claimExpired(tx, false);
  })
  .catch((e) => console.log('C (skip locked 없음)', e.cause?.message ?? e.message));

releaseA();
await a;
await pool.end();
