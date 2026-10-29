import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
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
}
