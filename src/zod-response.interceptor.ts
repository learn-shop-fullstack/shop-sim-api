import { CallHandler, ExecutionContext, InternalServerErrorException, Logger, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { prettifyError, type ZodType } from 'zod';

export class ZodResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ZodResponseInterceptor.name);

  constructor(private readonly schema: ZodType) {}

  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((body: unknown) => {
        const result = this.schema.safeParse(body);
        if (!result.success) {
          this.logger.error(`응답이 스펙과 다름\n${prettifyError(result.error)}`);
          throw new InternalServerErrorException();
        }
        return result.data;
      }),
    );
  }
}
