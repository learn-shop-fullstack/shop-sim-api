import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('PORT가 없으면 3000을 쓴다', () => {
    expect(loadConfig({}).PORT).toBe(3000);
  });

  it('PORT 문자열을 숫자로 바꾼다', () => {
    expect(loadConfig({ PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['abc', '0', '65536', '3000.5'])('PORT=%s이면 시작을 막는다', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/PORT/);
  });

  it('스키마에 없는 변수는 결과에 넣지 않는다', () => {
    expect(loadConfig({ PORT: '3000', OTHER: 'x' })).toEqual({ PORT: 3000 });
  });
});
