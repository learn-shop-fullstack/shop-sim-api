import { HttpException } from '@nestjs/common';

// openapi/CONVENTIONS.md "오류 종류 목록"과 1:1로 맞춘다. type은 계약이라 이름을 바꾸거나 지우면
// BREAKING이다. 새 type은 그 표에 먼저 추가한다
export type ProblemKind = { status: number; type: string; title: string };

export const VALIDATION_ERROR = {
  status: 400,
  type: '/problems/validation-error',
  title: 'Validation Error',
} as const satisfies ProblemKind;

export const INVALID_PAGE_TOKEN = {
  status: 400,
  type: '/problems/invalid-page-token',
  title: 'Invalid Page Token',
} as const satisfies ProblemKind;

// 코드가 클라이언트에 구분시켜야 하는 오류를 던질 때 쓴다. 상태 코드와 detail은 HttpException이
// 담고, ProblemDetailsFilter가 type·title을 응답에 옮긴다
export class ProblemException extends HttpException {
  constructor(
    readonly problem: ProblemKind,
    detail: string,
  ) {
    super(detail, problem.status);
  }
}
