import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { HttpError } from 'express-openapi-validator/dist/framework/types.js';
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
    const status = statusOf(exception);

    const problem: Problem = {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Unknown Error',
      status,
      // instance는 요청 경로다. 쿼리 문자열은 담지 않는다
      instance: String(httpAdapter.getRequestUrl(ctx.getRequest())).split('?')[0],
    };
    if (status < 500 && exception instanceof Error) {
      problem.detail = exception.message;
    }
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    // 405는 허용 메서드를 Allow 헤더로 알려야 한다(RFC 9110). 검증기가 값을 담아 준다
    if (isValidatorError(exception) && exception.headers?.Allow) {
      httpAdapter.setHeader(ctx.getResponse(), 'Allow', exception.headers.Allow);
    }
    httpAdapter.setHeader(ctx.getResponse(), 'Content-Type', 'application/problem+json');
    httpAdapter.reply(ctx.getResponse(), problem, status);
  }
}

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (isValidatorError(exception) && exception.status < 500) return exception.status;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

// express-openapi-validator는 HttpError 클래스를 export하지 않아 instanceof를 쓸 수 없다.
// 숫자 status와 errors 배열을 함께 가진 Error로 판별한다. status만 보면 외부 HTTP 클라이언트의
// 오류(예: 상대 서버의 404)까지 우리 응답 상태로 새어 나간다
function isValidatorError(exception: unknown): exception is HttpError {
  return (
    exception instanceof Error &&
    'status' in exception &&
    typeof exception.status === 'number' &&
    'errors' in exception &&
    Array.isArray(exception.errors)
  );
}
