import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { OpenAPIValidatorModule } from '@nest-openapi/validator';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { ProblemDetailsFilter } from './problem-details.filter';
import { ProductsController } from './products.controller';

const spec = parse(readFileSync(join(__dirname, '../openapi/openapi.yaml'), 'utf8'));

@Module({
  imports: [
    OpenAPIValidatorModule.forRoot({
      specSource: { type: 'object', spec },
      ajv: { configure: (ajv) => addFormats(ajv) },
      responseValidation: { enable: true },
    }),
  ],
  controllers: [ProductsController],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
