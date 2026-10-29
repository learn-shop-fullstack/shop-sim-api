import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { ProductsControllerMethods } from '../generated/openapi/nestjs.gen.js';
import type { GetProductData, Product } from '../generated/openapi/types.gen.js';
import { ProductsRepository } from './products.repository.js';

// listProducts까지 구현하면 Pick을 빼고 ProductsControllerMethods 전체를 implements한다
@Controller('products')
export class ProductsController implements Pick<ProductsControllerMethods, 'getProduct'> {
  constructor(private readonly products: ProductsRepository) {}

  @Get(':productId')
  async getProduct(@Param() path: GetProductData['path']): Promise<Product> {
    const product = await this.products.findPublishedById(path.productId);
    // 공개되지 않은 상품도 없는 상품과 같은 메시지로 404다. 메시지가 다르면 존재 여부가 드러난다
    if (!product) throw new NotFoundException('상품을 찾을 수 없다');
    return product;
  }
}
