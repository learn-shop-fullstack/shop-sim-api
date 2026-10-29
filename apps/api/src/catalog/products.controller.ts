import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import type { ProductsControllerMethods } from '../generated/openapi/nestjs.gen.js';
import type { GetProductData, ListProductsData, Product, ProductPage } from '../generated/openapi/types.gen.js';
import { decodePageToken, encodePageToken } from '../pagination/page-token.js';
import { type ProductCursor, ProductsRepository } from './products.repository.js';

const cursorSchema = z.strictObject({ at: z.string(), id: z.uuid() }) satisfies z.ZodType<ProductCursor>;
// 페이지 토큰의 발급 조건. 스펙에 필터·정렬 파라미터가 생기면 여기에 담는다
const LIST_CONDITIONS = {};

// products 태그의 operation 전체를 구현한다. 스펙에 operation이 추가되면 빌드가 실패한다
@Controller('products')
export class ProductsController implements ProductsControllerMethods {
  constructor(private readonly products: ProductsRepository) {}

  @Get()
  async listProducts(@Query() query?: ListProductsData['query']): Promise<ProductPage> {
    // 검증기가 기본값(20)을 채우고 숫자로 바꿔 준다. 타입이 선택이라 같은 값으로 한 번 더 받친다
    const pageSize = query?.pageSize ?? 20;
    const after = query?.pageToken
      ? decodePageToken(query.pageToken, 'listProducts', LIST_CONDITIONS, cursorSchema)
      : undefined;
    // 하나 더 가져와서 다음 페이지가 있는지 안다(COUNT 없이)
    const rows = await this.products.listPublished(pageSize + 1, after);
    const page = rows.slice(0, pageSize);
    const last = page.at(-1);
    return {
      items: page.map((row) => row.product),
      nextPageToken:
        rows.length > pageSize && last ? encodePageToken('listProducts', LIST_CONDITIONS, last.cursor) : null,
    };
  }

  @Get(':productId')
  async getProduct(@Param() path: GetProductData['path']): Promise<Product> {
    const product = await this.products.findPublishedById(path.productId);
    // 공개되지 않은 상품도 없는 상품과 같은 메시지로 404다. 메시지가 다르면 존재 여부가 드러난다
    if (!product) throw new NotFoundException('상품을 찾을 수 없다');
    return product;
  }
}
