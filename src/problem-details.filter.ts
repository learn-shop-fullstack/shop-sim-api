import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import type { Problem } from './generated/openapi/types.gen';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const status = statusOf(exception);

    const problem: Problem = {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      instance: req.originalUrl,
    };
    if (status < 500 && exception instanceof Error) problem.detail = exception.message;
    if (status >= 500) this.logger.error(exception);

    res.status(status).type('application/problem+json').json(problem);
  }
}

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  // express-openapi-validator의 HttpError: status 숫자를 가진 Error
  if (exception instanceof Error && 'status' in exception && typeof exception.status === 'number') {
    return exception.status;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}
