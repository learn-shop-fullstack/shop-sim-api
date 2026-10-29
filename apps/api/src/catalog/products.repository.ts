import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { products } from '../../../../db/schema/products.js';
import { DB, type Db } from '../database/database.module.js';
import type { Product } from '../generated/openapi/types.gen.js';

// 스펙 Product의 필드만 고른다. 내부 컬럼(detail_content, status 등)은 응답에 나가지 않는다.
// 결과를 생성 타입 Product에 대입하므로 DB enum·nullable이 스펙과 어긋나면 빌드가 실패한다
const productColumns = {
  id: products.id,
  name: products.name,
  subtitle: products.subtitle,
  type: products.type,
  price: products.price,
  discountRate: products.discountRate,
  leadTimeDays: products.leadTimeDays,
};

// catalog 모듈 안에서만 쓴다. 다른 모듈은 products 테이블을 직접 읽지 않는다(CLAUDE.md "모듈 경계")
@Injectable()
export class ProductsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findPublishedById(id: string): Promise<Product | undefined> {
    const [row] = await this.db
      .select(productColumns)
      .from(products)
      .where(and(eq(products.id, id), eq(products.status, 'PUBLISHED')));
    return row;
  }

  // 공개 상품을 최근 공개 순(같은 시각이면 id 역순)으로. after가 있으면 그 행 다음부터(키셋).
  // 행 값 비교라 products_published_at_id_idx를 그 위치부터 읽는다
  async listPublished(limit: number, after?: ProductCursor): Promise<{ product: Product; cursor: ProductCursor }[]> {
    const rows = await this.db
      // JS Date는 밀리초까지라 마이크로초가 잘린다. 커서 시각은 DB 텍스트 그대로 받아 그대로 비교한다
      .select({ ...productColumns, cursorAt: sql<string>`${products.publishedAt}::text` })
      .from(products)
      .where(
        and(
          eq(products.status, 'PUBLISHED'),
          after && sql`(${products.publishedAt}, ${products.id}) < (${after.at}::timestamptz, ${after.id}::uuid)`,
        ),
      )
      .orderBy(desc(products.publishedAt), desc(products.id))
      .limit(limit);
    return rows.map(({ cursorAt, ...product }) => ({ product, cursor: { at: cursorAt, id: product.id } }));
  }
}

// 목록에서 마지막으로 본 행의 정렬 키. 페이지 토큰에 담긴다
export type ProductCursor = { at: string; id: string };
