import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';

// 스펙 내용이 main과 달라졌으면 info.version을 올렸는지 검사한다(CI의 PR, 로컬 공용).
// 비교 대상은 main 끝이 아니라 merge-base다. 그 사이 main에 들어온 변경을 이 PR의 변경으로 보지 않는다 (#32)
const baseRef = process.argv[2] ?? 'origin/main';
const base = execFileSync('git', ['merge-base', baseRef, 'HEAD'], { encoding: 'utf8' }).trim();

// base 시점의 원본을 꺼내 같은 방식으로 합친다. 원본을 여러 파일로 나눠도 그대로 동작한다
const dir = mkdtempSync(join(tmpdir(), 'openapi-base-'));
let before: Spec;
try {
  execFileSync('tar', ['-x', '-C', dir], { input: execFileSync('git', ['archive', base, 'openapi']) });
  execFileSync('redocly', ['bundle', join(dir, 'openapi/openapi.yaml'), '--output', join(dir, 'bundled.yaml')], {
    env: { ...process.env, REDOCLY_SUPPRESS_UPDATE_NOTICE: 'true' },
    stdio: 'ignore',
  });
  before = parse(readFileSync(join(dir, 'bundled.yaml'), 'utf8'));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const after: Spec = parse(readFileSync('dist/openapi/openapi.yaml', 'utf8'));

// 파싱한 값끼리 비교하므로 주석·들여쓰기·키 순서만 바뀐 것은 변경이 아니다. description 수정은 변경이다
const withoutVersion = (spec: Spec): Spec => ({ ...spec, info: { ...spec.info, version: '' } });
const [from, to] = [before.info.version, after.info.version];
if (compare(to, from) < 0) {
  // 내리면 main 머지 때 더 낮은 버전이 새로 배포된다
  console.error(`info.version을 내릴 수 없다: ${from} → ${to}`);
  process.exit(1);
} else if (isDeepStrictEqual(withoutVersion(before), withoutVersion(after))) {
  console.log(`스펙 내용 변경 없음 (${from} → ${to})`);
} else if (compare(to, from) === 0) {
  console.error(`스펙 내용이 바뀌었는데 info.version이 올라가지 않았다: ${from} → ${to}. BREAKING이면 메이저, 아니면 마이너·패치를 올린다`);
  process.exit(1);
} else {
  console.log(`스펙 변경, 버전 ${from} → ${to}`);
}

type Spec = { info: { version: string } };

// X.Y.Z끼리 비교한다. 형식은 openapi:pack이 먼저 검사한다
function compare(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
