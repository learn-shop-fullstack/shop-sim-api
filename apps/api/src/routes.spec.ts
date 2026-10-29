import { readFileSync } from 'node:fs';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { AppModule } from './app.module.js';
import type { Config } from './config.js';
import { CONFIG } from './config.module.js';

// 타입이 잡지 못하는 경로 불일치를 머지 전에 잡는다(ADR 0012): 데코레이터 경로 오타, 등록하지 않은
// 컨트롤러(스펙에만 있음), 스펙 없이 추가한 라우트(코드에만 있음). Nest 밖에 직접 건 핸들러
// (인증 경로, ADR 0015)는 스펙의 예외라 여기서 보이지 않는 것이 맞다
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];

function specRoutes(): string[] {
  const spec = parse(readFileSync('dist/openapi/openapi.yaml', 'utf8')) as { paths: Record<string, object> };
  return Object.entries(spec.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((m) => m in item).map((m) => `${m.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`),
  );
}

describe('라우트 대조 (스펙 paths ↔ 등록된 라우트)', () => {
  let close: () => Promise<void>;
  let registered: string[];

  beforeAll(async () => {
    // 풀은 만들어지지만 쿼리를 하지 않아 DB에 연결하지 않는다
    const config: Config = { PORT: 0, DATABASE_URL: 'postgres://unused@localhost:5432/unused' };
    const module = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] })
      .overrideProvider(CONFIG)
      .useValue(config)
      .compile();
    close = () => module.close();
    const scanner = module.get(MetadataScanner);
    registered = module
      .get(DiscoveryService)
      .getControllers()
      .flatMap(({ metatype }) => {
        const base = Reflect.getMetadata(PATH_METADATA, metatype) as string;
        const proto = (metatype as { prototype: Record<string, object> }).prototype;
        return scanner.getAllMethodNames(proto).flatMap((name) => {
          const path = Reflect.getMetadata(PATH_METADATA, proto[name]) as string | undefined;
          if (path === undefined) return [];
          const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, proto[name]) as RequestMethod];
          return [`${method} /${[base, path].map((p) => p.replace(/^\/|\/$/g, '')).filter(Boolean).join('/')}`];
        });
      });
  });

  afterAll(() => close());

  it('스펙의 operation이 모두 등록돼 있다', () => {
    expect(specRoutes().filter((r) => !registered.includes(r))).toEqual([]);
  });

  it('등록된 라우트가 모두 스펙에 있다', () => {
    const spec = specRoutes();
    expect(registered.filter((r) => !spec.includes(r))).toEqual([]);
  });
});
