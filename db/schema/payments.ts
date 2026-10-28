import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const paymentStatus = pgEnum('payment_status', ['PENDING', 'APPROVED', 'EXPIRED']);

// 결제 타임아웃 스윕(ADR 0004)이 PENDING이면서 expires_at이 지난 행을 SKIP LOCKED로 가져간다
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    amount: integer('amount').notNull(),
    status: paymentStatus('status').notNull().default('PENDING'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('payments_amount_non_negative', sql`${t.amount} >= 0`),
    index('payments_status_expires_at_idx').on(t.status, t.expiresAt),
  ],
);
