import { Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { ProblemDetailsFilter } from './problem-details.filter.js';

function run(exception: unknown, url = '/products/x?pageSize=1') {
  const httpAdapter = { getRequestUrl: () => url, setHeader: vi.fn(), reply: vi.fn() };
  const host = { switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }) };
  const filter = new ProblemDetailsFilter({ httpAdapter } as unknown as HttpAdapterHost);
  filter.catch(exception, host as unknown as ArgumentsHost);
  return httpAdapter;
}

describe('ProblemDetailsFilter', () => {
  it('HttpException은 상태 코드와 원인을 담는다', () => {
    const adapter = run(new NotFoundException('상품이 없다'));
    expect(adapter.setHeader).toHaveBeenCalledWith({}, 'Content-Type', 'application/problem+json');
    expect(adapter.reply).toHaveBeenCalledWith(
      {},
      { type: 'about:blank', title: 'Not Found', status: 404, detail: '상품이 없다', instance: '/products/x' },
      404,
    );
  });

  it.each([new Error('DB 비밀번호 틀림'), 'throw된 문자열', new ServiceUnavailableException('내부 사정')])(
    '5xx는 detail을 숨기고 로그로만 남긴다 (%s)',
    (exception) => {
      const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      const [, body, status] = run(exception).reply.mock.calls[0];
      expect(body).not.toHaveProperty('detail');
      expect(body.status).toBe(status);
      expect(logError).toHaveBeenCalledOnce();
      logError.mockRestore();
    },
  );
});
