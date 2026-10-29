import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp } from '../../test/contract-app.js';

describe('getHealth (계약)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => ({ app, baseUrl } = await startApp()));
  afterAll(() => app.close());

  it('204, 본문 없음', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });
});
