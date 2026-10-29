import { STATUS_CODES } from 'node:http';
import { inspect } from 'node:util';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { HttpError } from 'express-openapi-validator/dist/framework/types.js';
import type { Problem, ProblemError } from './generated/openapi/types.gen.js';
import { ProblemException, VALIDATION_ERROR } from './problems.js';

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
    if (exception instanceof ProblemException) {
      problem.type = exception.problem.type;
      problem.title = exception.problem.title;
    }
    if (status === 400 && isValidatorError(exception)) {
      problem.type = VALIDATION_ERROR.type;
      problem.title = VALIDATION_ERROR.title;
      problem.errors = exception.errors.flatMap(({ path, message }): ProblemError[] => {
        const pointer = toPointer(path);
        return pointer ? [{ pointer, detail: message }] : [];
      });
    }
    if (status >= 500) {
      // 응답 검증 실패는 어긋난 위치(/response/internalCost 등)가 errors에만 있다. 응답에는 숨기고 로그에만 남긴다.
      // Logger에 두 번째 인자를 주면 문자열에 따라 context로 해석될 수 있어 한 문자열로 합친다
      const errors = isValidatorError(exception) ? `\nerrors: ${JSON.stringify(exception.errors)}` : '';
      this.logger.error(exception instanceof Error ? `${withCauses(exception)}${errors}` : exception);
    }

    // 405는 허용 메서드를 Allow 헤더로 알려야 한다(RFC 9110). 검증기가 값을 담아 준다
    if (isValidatorError(exception) && exception.headers?.Allow) {
      httpAdapter.setHeader(ctx.getResponse(), 'Allow', exception.headers.Allow);
    }
    httpAdapter.setHeader(ctx.getResponse(), 'Content-Type', 'application/problem+json');
    httpAdapter.reply(ctx.getResponse(), problem, status);
  }
}

// 검증기 위치의 첫 칸(요청 객체의 속성 이름)을 OpenAPI 파라미터의 in 값으로 바꾼다
const LOCATIONS: Record<string, string> = {
  params: 'path',
  query: 'query',
  headers: 'header',
  cookies: 'cookie',
  body: 'body',
};

// 검증기의 /params/productId를 규약의 #/path/productId로 바꾼다. 나머지는 Ajv가 이미
// JSON Pointer로 이스케이프해 준다. 위치를 모르는 값(일부 오류는 요청 URL 경로를 담는다)은
// 포인터로 내보내지 않는다
export function toPointer(path: string): string | undefined {
  const [, first = '', ...rest] = path.split('/');
  const location = Object.hasOwn(LOCATIONS, first) ? LOCATIONS[first] : undefined;
  return location && ['#', location, ...rest].join('/');
}

// Error.cause를 따라가며 stack을 잇는다. 드라이버 오류(연결 거부·타임아웃)는 ORM 오류
// (DrizzleQueryError)의 cause에만 있다. cause가 서로를 가리키는 경우를 막으려고 깊이를 제한한다
function withCauses(error: Error): string {
  let text = error.stack ?? String(error);
  let cause: unknown = error.cause;
  for (let depth = 0; cause !== undefined && depth < 5; depth++) {
    text += `\ncaused by: ${cause instanceof Error ? (cause.stack ?? cause.message) : inspect(cause)}`;
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return text;
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
