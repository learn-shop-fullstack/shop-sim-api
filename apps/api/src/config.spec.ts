import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/shop_sim';

describe('loadConfig', () => {
  it('PORT가 없으면 3000을 쓴다', () => {
    expect(loadConfig({ DATABASE_URL }).PORT).toBe(3000);
  });

  it('PORT 문자열을 숫자로 바꾼다', () => {
    expect(loadConfig({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['abc', '0', '65536', '3000.5'])('PORT=%s이면 시작을 막는다', (port) => {
    expect(() => loadConfig({ DATABASE_URL, PORT: port })).toThrow(/PORT/);
  });

  it('스키마에 없는 변수는 결과에 넣지 않는다', () => {
    expect(loadConfig({ DATABASE_URL, PORT: '3000', OTHER: 'x' })).toEqual({ PORT: 3000, DATABASE_URL });
  });

  it('postgresql:// 접두어도 받는다', () => {
    const url = 'postgresql://u:p@db:5432/shop_sim';
    expect(loadConfig({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it.each([undefined, 'mysql://u:s3cret@h/db', 'not a url s3cret'])(
    'DATABASE_URL=%s이면 시작을 막고 값을 메시지에 넣지 않는다',
    (url) => {
      expect(() => loadConfig({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
      expect(() => loadConfig({ DATABASE_URL: url })).not.toThrow(/s3cret/);
    },
  );
});
