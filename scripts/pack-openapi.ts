import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';

// 합친 스펙(pnpm openapi:bundle 결과)과 packages/openapi/package.json으로 배포할 디렉터리를 만든다.
// 버전의 출처는 openapi.yaml의 info.version 하나다. package.json에는 적지 않고 여기서 넣는다 (#32)
const SPEC = 'dist/openapi/openapi.yaml';
const OUT = 'dist/openapi-package';
// 지금은 정식 버전만 배포한다. 프리릴리스(1.0.0-rc.1)가 필요해지면 배포 태그(dist-tag)와 함께 정한다
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const version: unknown = parse(readFileSync(SPEC, 'utf8'))?.info?.version;
if (typeof version !== 'string' || !SEMVER.test(version)) {
  throw new Error(`info.version이 semver(X.Y.Z)가 아니다: ${String(version)}`);
}

const manifest = JSON.parse(readFileSync('packages/openapi/package.json', 'utf8'));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
copyFileSync(SPEC, `${OUT}/openapi.yaml`);
writeFileSync(`${OUT}/package.json`, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
console.log(`${OUT}: ${manifest.name}@${version}`);
