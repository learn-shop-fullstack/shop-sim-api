import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { ProductsControllerMethods } from './generated/openapi/nestjs.gen';
import type { GetProductData, Product } from './generated/openapi/types.gen';
import { zGetProductPath } from './generated/openapi/zod.gen';
import { ZodValidationPipe } from './zod-validation.pipe';

const PRODUCTS: Product[] = [
  { id: '0b9f3c1e-5d7a-4c2b-9e1f-3a6d8b2c4e70', name: '머그컵', price: 12000 },
];

@Controller('products')
export class ProductsController implements Pick<ProductsControllerMethods, 'getProduct'> {
  @Get(':productId')
  async getProduct(@Param(new ZodValidationPipe(zGetProductPath)) path: GetProductData['path']) {
    const product = PRODUCTS.find((p) => p.id === path.productId);
    if (!product) throw new NotFoundException();
    return product;
  }
}
