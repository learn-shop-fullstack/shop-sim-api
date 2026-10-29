import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// catalog 모듈 소유(db/ERD.md "카탈로그 1"). enum 값은 스펙과 같고 추가만 한다
export const productType = pgEnum('product_type', ['FINISHED', 'MADE_TO_ORDER']);
export const productStatus = pgEnum('product_status', ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'SUSPENDED']);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    // sellers·categories 테이블이 생기는 2단계에 FK를 건다(#30)
    sellerId: uuid('seller_id').notNull(),
    categoryId: uuid('category_id').notNull(),
    name: text('name').notNull(),
    subtitle: text('subtitle'),
    type: productType('type').notNull(),
    price: integer('price').notNull(),
    discountRate: integer('discount_rate').notNull().default(0),
    detailContent: jsonb('detail_content').notNull(),
    leadTimeDays: integer('lead_time_days'),
    status: productStatus('status').notNull().default('DRAFT'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 스펙이 허용하지 않는 값이 저장되면 조회 때 응답 검증이 500으로 막는다. DB에서 먼저 거절한다
    check('products_name_check', sql`${t.name} <> ''`),
    check('products_price_check', sql`${t.price} >= 0`),
    check('products_discount_rate_check', sql`${t.discountRate} BETWEEN 0 AND 99`),
    check(
      'products_lead_time_days_check',
      sql`(${t.type} = 'MADE_TO_ORDER') = (${t.leadTimeDays} IS NOT NULL) AND (${t.leadTimeDays} IS NULL OR ${t.leadTimeDays} >= 1)`,
    ),
    check('products_scheduled_at_check', sql`${t.status} <> 'SCHEDULED' OR ${t.scheduledAt} IS NOT NULL`),
    // DESC 정렬은 NULL을 맨 앞에 둔다. 공개 상품에 published_at이 없으면 목록 순서와 커서가 깨진다
    check('products_published_at_check', sql`${t.status} <> 'PUBLISHED' OR ${t.publishedAt} IS NOT NULL`),
    index('products_seller_id_status_idx').on(t.sellerId, t.status),
    index('products_scheduled_at_idx').on(t.scheduledAt).where(sql`${t.status} = 'SCHEDULED'`),
    // 공개 상품 목록(listProducts)의 정렬과 같은 순서. Drizzle의 desc()는 NULLS LAST를 붙이는데
    // Postgres의 DESC 기본값은 NULLS FIRST라서, 기본 ORDER BY ... DESC와 맞도록 명시한다
    index('products_published_at_id_idx')
      .on(t.publishedAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(sql`${t.status} = 'PUBLISHED'`),
  ],
);
