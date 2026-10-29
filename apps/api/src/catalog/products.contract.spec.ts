import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestDb, insertProduct, resetProducts, startApp } from '../../test/contract-app.js';
import { ProductsRepository } from './products.repository.js';

// 검증기(요청·응답)가 켜져 있어 본문이 스펙과 다르면 500이 된다. 테스트는 상태 코드와 의미만 본다
const MISSING_ID = '0190f5d2-7a1b-7c3d-8e4f-123456789abc';

describe('getProduct (계약)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const get = (id: string) => fetch(`${baseUrl}/products/${id}`);

  beforeAll(async () => ({ app, baseUrl } = await startApp()));
  beforeEach(() => resetProducts());
  afterAll(async () => {
    await app.close();
    await closeTestDb();
  });

  it('공개 완제품: 200', async () => {
    const id = await insertProduct({ name: '머그컵', subtitle: '도자기', price: 12000, discountRate: 10 });
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id,
      name: '머그컵',
      subtitle: '도자기',
      type: 'FINISHED',
      price: 12000,
      discountRate: 10,
      leadTimeDays: null,
    });
  });

  it('공개 제작 상품: 200, leadTimeDays를 담는다', async () => {
    const id = await insertProduct({ type: 'MADE_TO_ORDER', leadTimeDays: 7 });
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ type: 'MADE_TO_ORDER', leadTimeDays: 7 });
  });

  it('DRAFT와 없는 상품: 같은 detail의 404', async () => {
    const draft = await get(await insertProduct({ status: 'DRAFT', publishedAt: null }));
    const missing = await get(MISSING_ID);
    expect([draft.status, missing.status]).toEqual([404, 404]);
    expect(draft.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    expect((await draft.json()).detail).toBe((await missing.json()).detail);
  });

  it('uuid가 아님: 400 validation-error', async () => {
    const res = await get('abc');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      type: '/problems/validation-error',
      errors: [{ pointer: '#/path/productId' }],
    });
  });
});

// 위 테스트들은 응답 검증이 켜져 있다는 전제에 기댄다. 꺼지면 조용히 의미를 잃으므로 전제를 지킨다
describe('응답 검증 가드', () => {
  it('스펙에 없는 필드가 섞인 응답은 500으로 막힌다', async () => {
    const leaky = {
      findPublishedById: async (id: string) => ({
        id,
        name: '상품',
        subtitle: null,
        type: 'FINISHED',
        price: 1000,
        discountRate: 0,
        leadTimeDays: null,
        internalCost: 700,
      }),
    };
    const { app, baseUrl } = await startApp((builder) =>
      builder.overrideProvider(ProductsRepository).useValue(leaky),
    );
    try {
      expect((await fetch(`${baseUrl}/products/${MISSING_ID}`)).status).toBe(500);
    } finally {
      await app.close();
    }
  });
});
