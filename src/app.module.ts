import { join } from 'node:path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import * as OpenApiValidator from 'express-openapi-validator';
import { ProductsController } from './products.controller';

@Module({
  controllers: [ProductsController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        ...OpenApiValidator.middleware({
          apiSpec: join(__dirname, '../openapi/openapi.yaml'),
          validateRequests: true,
          validateResponses: true,
          validateFormats: true,
        }),
      )
      .forRoutes('*');
  }
}
