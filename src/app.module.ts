import { join } from 'node:path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import * as OpenApiValidator from 'express-openapi-validator';
import { ProblemDetailsFilter } from './problem-details.filter';
import { ProductsController } from './products.controller';

@Module({
  controllers: [ProductsController],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
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
