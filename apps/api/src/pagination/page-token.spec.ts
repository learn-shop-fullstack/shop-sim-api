import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ProblemException } from '../problems.js';
import { decodePageToken, encodePageToken } from './page-token.js';

const cursorSchema = z.strictObject({ at: z.string(), id: z.uuid() });
const cursor = { at: '2026-10-29 05:52:40.100145+00', id: '01a18637-b460-71e7-86a6-d9c0d29be973' };
const forge = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url');

function rejection(token: string, op = 'listProducts', conditions = {}): string {
  try {
    decodePageToken(token, op, conditions, cursorSchema);
  } catch (e) {
    expect(e).toBeInstanceOf(ProblemException);
    expect((e as ProblemException).problem.type).toBe('/problems/invalid-page-token');
    return (e as ProblemException).message;
  }
  throw new Error('거절되지 않았다');
}

describe('page token', () => {
  it('발급한 조건으로 돌려보내면 커서를 그대로 돌려준다', () => {
    const token = encodePageToken('listProducts', { sort: 'new' }, cursor);
    expect(token).toMatch(/^[\w-]+$/);
    expect(decodePageToken(token, 'listProducts', { sort: 'new' }, cursorSchema)).toEqual(cursor);
  });

  it.each([
    ['다른 operation', encodePageToken('listOrders', {}, cursor), '발급한 조건과 다르다'],
    ['다른 조건', encodePageToken('listProducts', { sort: 'old' }, cursor), '발급한 조건과 다르다'],
    ['다른 버전', forge({ v: 2, op: 'listProducts', c: {}, k: cursor }), '형식 버전이 다르다'],
    ['모르는 필드', forge({ v: 1, op: 'listProducts', c: {}, k: cursor, x: 1 }), '해석할 수 없다'],
    ['커서가 스키마와 다름', forge({ v: 1, op: 'listProducts', c: {}, k: { at: 1, id: 'x' } }), '해석할 수 없다'],
    ['base64url·JSON이 아님', '!!not-a-token!!', '해석할 수 없다'],
    ['1024자 초과', 'a'.repeat(1025), '너무 길다'],
  ])('%s이면 invalid-page-token으로 거절한다', (_, token, detail) => {
    expect(rejection(token)).toContain(detail);
  });
});
