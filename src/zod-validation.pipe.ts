import { BadRequestException, PipeTransform } from '@nestjs/common';
import { prettifyError, type ZodType } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(prettifyError(result.error));
    return result.data;
  }
}
