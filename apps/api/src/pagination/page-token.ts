import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { INVALID_PAGE_TOKEN, ProblemException } from '../problems.js';

// 커서 페이지네이션의 pageToken(openapi/CONVENTIONS.md "페이지네이션", AIP-158).
// base64url(JSON)이라 누구나 읽을 수 있다. 서명하지 않는다: 공개 목록의 위치만 담아 위조로 얻을 것이 없다.
// 권한과 관련된 조건을 담게 되면 서명을 붙인다
const VERSION = 1;
// 스펙에 maxLength가 없다. 긴 값의 디코딩·JSON.parse 비용을 막으려고 코드에서 거절한다
const MAX_LENGTH = 1024;

// 발급 조건: 목록의 필터·정렬 파라미터. pageSize는 페이지마다 바꿀 수 있어 넣지 않는다
export type PageConditions = Record<string, string>;

const envelope = z.strictObject({
  v: z.number(), // 형식 버전. 형식을 바꾸면 올리고, 다른 버전의 토큰은 거절한다(클라이언트는 첫 페이지부터)
  op: z.string(), // 발급한 operation. 다른 목록의 토큰을 섞어 쓰지 못하게 한다
  c: z.record(z.string(), z.string()),
  k: z.unknown(), // 커서. 모양은 목록마다 달라 호출하는 쪽의 스키마로 검사한다
});

export function encodePageToken<T>(op: string, conditions: PageConditions, cursor: T): string {
  return Buffer.from(JSON.stringify({ v: VERSION, op, c: conditions, k: cursor })).toString('base64url');
}

export function decodePageToken<T>(
  token: string,
  op: string,
  conditions: PageConditions,
  cursorSchema: z.ZodType<T>,
): T {
  if (token.length > MAX_LENGTH) throw invalid('토큰이 너무 길다');
  let raw: unknown;
  try {
    // base64url 디코딩은 모르는 문자를 건너뛰고 throw하지 않는다. 잘못된 값은 JSON.parse에서 걸린다
    raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw invalid('토큰을 해석할 수 없다');
  }
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) throw invalid('토큰을 해석할 수 없다');
  if (parsed.data.v !== VERSION) throw invalid('토큰 형식 버전이 다르다');
  if (parsed.data.op !== op || !isDeepStrictEqual(parsed.data.c, conditions)) {
    throw invalid('토큰을 발급한 조건과 다르다');
  }
  const cursor = cursorSchema.safeParse(parsed.data.k);
  if (!cursor.success) throw invalid('토큰을 해석할 수 없다');
  return cursor.data;
}

function invalid(detail: string): ProblemException {
  return new ProblemException(INVALID_PAGE_TOKEN, detail);
}
