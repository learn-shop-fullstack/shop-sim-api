// 이벤트 페이로드 호환성 검사 (POC #7)
// 사용: node scripts/check-event-compat.mjs <기준 asyncapi.yaml> <새 asyncapi.yaml>
//
// 전제: 생산자는 닫힌 스키마(additionalProperties: false)로 검증해 보내고,
// 컨슈머는 모르는 필드를 무시한다(열린 스키마로 읽는다).
// 그래서 "보내는 값(닫힘)이 모두 받아들여지는가(열림)"를 두 방향으로 본다.
//   옛 컨슈머가 새 메시지를 받는다:      새(닫힘) → 옛(열림)
//   새 컨슈머가 옛 메시지를 재처리한다:  옛(닫힘) → 새(열림)
// 채널(토픽) 수준 변경은 `asyncapi diff`가 본다.
import { readFileSync } from 'node:fs';
import jsonSchemaDiff from 'json-schema-diff';
import { parse } from 'yaml';

const [basePath, headPath] = process.argv.slice(2);
if (!basePath || !headPath) {
  console.error('사용: check-event-compat.mjs <기준 asyncapi.yaml> <새 asyncapi.yaml>');
  process.exit(2);
}

// components.messages 이름 → 로컬 $ref를 펼친 페이로드 스키마
function payloads(path) {
  const doc = parse(readFileSync(path, 'utf8'));
  const resolve = (node) => {
    if (Array.isArray(node)) return node.map(resolve);
    if (node === null || typeof node !== 'object') return node;
    if (typeof node.$ref === 'string') {
      const target = node.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], doc);
      if (target === undefined) throw new Error(`${path}: $ref를 찾을 수 없음 ${node.$ref}`);
      return resolve(target);
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolve(v)]));
  };
  const messages = doc.components?.messages ?? {};
  return Object.fromEntries(Object.entries(messages).map(([name, m]) => [name, resolve(m).payload]));
}

// 컨슈머가 받아들이는 범위: 모든 단계의 additionalProperties: false를 뗀다
const open = (node) => {
  if (Array.isArray(node)) return node.map(open);
  if (node === null || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node).filter(([k, v]) => !(k === 'additionalProperties' && v === false)).map(([k, v]) => [k, open(v)]),
  );
};

// json-schema-diff가 판정하지 않는 키워드(KEYWORDS.md "no")와 draft-07 밖 키워드.
// 값이 바뀌면 자동 판정 없이 실패시킨다. enum은 값 추가만 호환(컨슈머는 모르는 값을 기본 처리)
const UNSUPPORTED = ['enum', 'const', 'format', 'pattern', 'multipleOf', 'uniqueItems', 'contains',
  'additionalItems', 'patternProperties', 'dependencies', 'propertyNames', 'if', 'then', 'else',
  'unevaluatedProperties', 'unevaluatedItems', 'prefixItems', 'dependentRequired', 'dependentSchemas'];
const NAME_MAPS = ['properties', 'patternProperties', 'dependencies', 'dependentSchemas', '$defs', 'definitions'];
const VALUES = ['enum', 'const', 'default', 'examples'];

// 스키마 노드 경로(JSON Pointer)와 키워드 경로 → 값. 이름 맵 아래 키는 필드 이름이라 키워드로 보지 않는다
function keywords(schema, path = '', out = { nodes: new Set(), values: new Map() }) {
  if (schema === null || typeof schema !== 'object') return out;
  out.nodes.add(path);
  for (const [k, v] of Object.entries(schema)) {
    if (UNSUPPORTED.includes(k)) out.values.set(`${path}/${k}`, v);
    if (VALUES.includes(k) || v === null || typeof v !== 'object') continue;
    if (NAME_MAPS.includes(k)) for (const [n, s] of Object.entries(v)) keywords(s, `${path}/${k}/${n}`, out);
    else if (Array.isArray(v)) v.forEach((s, i) => keywords(s, `${path}/${k}/${i}`, out));
    else keywords(v, `${path}/${k}`, out);
  }
  return out;
}

function unverified(oldSchema, newSchema) {
  const [before, after] = [keywords(oldSchema), keywords(newSchema)];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const enumAdded = (a, b) => Array.isArray(a) && Array.isArray(b) && a.every((x) => b.some((y) => same(x, y)));
  // 노드가 통째로 생기거나 없어진 것은 json-schema-diff가 판정한다 → 양쪽에 있는 노드의 키워드만 본다
  const inBoth = (p) => before.nodes.has(p.slice(0, p.lastIndexOf('/'))) && after.nodes.has(p.slice(0, p.lastIndexOf('/')));
  return [...new Set([...before.values.keys(), ...after.values.keys()])].filter((p) => {
    const [a, b] = [before.values.get(p), after.values.get(p)];
    return inBoth(p) && !same(a, b) && !(p.endsWith('/enum') && enumAdded(a, b));
  });
}

const base = payloads(basePath);
const head = payloads(headPath);
let breaking = false;

for (const [name, oldSchema] of Object.entries(base)) {
  const newSchema = head[name];
  if (!newSchema) {
    console.log(`BREAKING ${name}: 메시지가 삭제됐다`);
    breaking = true;
    continue;
  }
  const checks = [
    ['옛 컨슈머가 새 메시지를 거부한다', newSchema, open(oldSchema)],
    ['새 컨슈머가 옛 메시지를 거부한다(재처리)', oldSchema, open(newSchema)],
  ];
  for (const [label, sent, accepted] of checks) {
    const result = await jsonSchemaDiff.diffSchemas({ sourceSchema: sent, destinationSchema: accepted });
    if (result.removalsFound) {
      console.log(`BREAKING ${name}: ${label}. 거부되는 값: ${JSON.stringify(result.removedJsonSchema)}`);
      breaking = true;
    }
  }
  for (const path of unverified(oldSchema, newSchema)) {
    console.log(`BREAKING ${name}: 자동 판정하지 못하는 변경, 수동 검토 필요 ${path}`);
    breaking = true;
  }
}
for (const name of Object.keys(head)) if (!(name in base)) console.log(`추가 ${name}`);

console.log(breaking ? '결과: BREAKING' : '결과: 호환');
process.exit(breaking ? 1 : 0);
