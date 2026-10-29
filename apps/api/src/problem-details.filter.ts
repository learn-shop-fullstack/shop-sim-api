import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Problem } from './generated/openapi/types.gen.js';

// 모든 예외를 RFC 9457 Problem Details로 바꾼다(openapi/CONVENTIONS.md "에러 응답").
// 4xx는 detail에 원인을 담고, 5xx는 내부 정보를 숨기고 로그로만 남긴다
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const problem: Problem = {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Unknown Error',
      status,
      // instance는 요청 경로다. 쿼리 문자열은 담지 않는다
      instance: String(httpAdapter.getRequestUrl(ctx.getRequest())).split('?')[0],
    };
    if (status < 500 && exception instanceof HttpException) {
      problem.detail = exception.message;
    }
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    httpAdapter.setHeader(ctx.getResponse(), 'Content-Type', 'application/problem+json');
    httpAdapter.reply(ctx.getResponse(), problem, status);
  }
}
