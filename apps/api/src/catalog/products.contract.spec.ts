import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestDb,
  insertProduct,
  publishedNamesInOrder,
  resetProducts,
  startApp,
} from '../../test/contract-app.js';
import { encodePageToken } from '../pagination/page-token.js';
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

describe('listProducts (계약)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const list = async (query: string) => {
    const res = await fetch(`${baseUrl}/products${query}`);
    return { status: res.status, body: await res.json() };
  };
  const at = (time: string) => sql`${time}::timestamptz`;

  beforeAll(async () => ({ app, baseUrl } = await startApp()));
  beforeEach(() => resetProducts());
  afterAll(async () => {
    await app.close();
    await closeTestDb();
  });

  // 커서 시각이 밀리초로 잘리면 같은 밀리초 안의 행(B·C·D)이 페이지 경계에서 빠진다(10단계에서 재현)
  it('pageSize=2로 끝까지 따라가면 같은 밀리초 행까지 중복·누락 없이 DB 순서대로 나온다', async () => {
    await insertProduct({ name: 'A', publishedAt: at('2026-10-29 06:00:00+00') });
    await insertProduct({ name: 'B', publishedAt: at('2026-10-29 05:52:40.100999+00') });
    await insertProduct({ name: 'C', publishedAt: at('2026-10-29 05:52:40.1005+00') });
    await insertProduct({ name: 'D', publishedAt: at('2026-10-29 05:52:40.100145+00') });
    await insertProduct({ name: 'E', publishedAt: at('2026-10-28 00:00:00+00') });
    await insertProduct({ name: 'X', status: 'DRAFT', publishedAt: null });

    const pages: string[][] = [];
    let token: string | null = null;
    do {
      const { status, body } = await list(`?pageSize=2${token ? `&pageToken=${token}` : ''}`);
      expect(status).toBe(200);
      pages.push(body.items.map((item: { name: string }) => item.name));
      token = body.nextPageToken;
    } while (token && pages.length < 10);

    expect(pages).toEqual([['A', 'B'], ['C', 'D'], ['E']]);
    expect(pages.flat()).toEqual(await publishedNamesInOrder());
  });

  it('pageSize가 없으면 기본 20개까지 한 페이지', async () => {
    for (const name of ['A', 'B', 'C']) await insertProduct({ name });
    const { status, body } = await list('');
    expect(status).toBe(200);
    expect(body.items).toHaveLength(3);
    expect(body.nextPageToken).toBeNull();
  });

  it('공개 상품이 없으면 빈 페이지', async () => {
    expect(await list('')).toEqual({ status: 200, body: { items: [], nextPageToken: null } });
  });

  it('pageSize=0: 400 validation-error', async () => {
    const { status, body } = await list('?pageSize=0');
    expect(status).toBe(400);
    expect(body).toMatchObject({ type: '/problems/validation-error', errors: [{ pointer: '#/query/pageSize' }] });
  });

  it.each([
    ['깨진 토큰', 'garbage'],
    ['다른 operation의 토큰', encodePageToken('listOrders', {}, { at: '2026-10-29 06:00:00+00', id: MISSING_ID })],
  ])('%s: 400 invalid-page-token', async (_, token) => {
    const { status, body } = await list(`?pageToken=${token}`);
    expect(status).toBe(400);
    expect(body.type).toBe('/problems/invalid-page-token');
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
