// OrderPaid 발행 (POC #7)
// 사용: node scripts/publish-order-paid.mjs [--bad]   (--bad: 스키마 위반 페이로드로 발행 시도)
//
// asyncapi.yaml의 헤더·페이로드 스키마로 검증한 뒤 CloudEvents 1.0 Kafka binary 모드로 보낸다.
// 속성은 ce_ 헤더, data는 메시지 값, datacontenttype은 content-type 헤더.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import rdkafka from '@confluentinc/kafka-javascript';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const doc = parse(readFileSync(new URL('../asyncapi/asyncapi.yaml', import.meta.url), 'utf8'));
const deref = (node) => {
  if (Array.isArray(node)) return node.map(deref);
  if (node === null || typeof node !== 'object') return node;
  if (typeof node.$ref === 'string') return deref(node.$ref.slice(2).split('/').reduce((o, k) => o[k], doc));
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, deref(v)]));
};
// JSON Merge Patch(RFC 7386). 트레이트를 정의 순서대로 합치고 메시지 자체 속성이 이긴다(AsyncAPI 3 트레이트 병합)
const mergePatch = (target, patch) => {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = target !== null && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) v === null ? delete out[k] : (out[k] = mergePatch(out[k], v));
  return out;
};
const { traits = [], ...own } = deref(doc.components.messages.OrderPaid);
const message = mergePatch(traits.reduce(mergePatch, {}), own);
const topic = doc.channels.orderEvents.address;

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = { headers: ajv.compile(message.headers), payload: ajv.compile(message.payload) };

const orderId = randomUUID();
const payload = { orderId, checkoutId: randomUUID(), sellerId: randomUUID(), totalAmount: 39000, paidAt: new Date().toISOString() };
if (process.argv.includes('--bad')) Object.assign(payload, { totalAmount: '39000', internalNote: '내부 필드' });
const headers = {
  ce_specversion: '1.0',
  ce_id: randomUUID(),
  ce_source: '/shop-sim-api/order',
  ce_type: 'order.paid.v1',
  ce_time: new Date().toISOString(),
  ce_subject: orderId,
  'content-type': 'application/json',
};

// 생산자는 엄격하게: 스키마를 어기면 보내지 않는다
for (const [part, value] of [['headers', headers], ['payload', payload]]) {
  if (!validate[part](value)) {
    console.error(`${part} 검증 실패:`, validate[part].errors.map((e) => `${e.instancePath || '/'} ${e.message}`));
    process.exit(1);
  }
}

const kafka = new rdkafka.KafkaJS.Kafka({ kafkaJS: { brokers: ['localhost:9092'] } });
const producer = kafka.producer();
await producer.connect();
// 키는 집계 ID → 같은 주문의 이벤트는 같은 파티션에서 순서대로
const [report] = await producer.send({ topic, messages: [{ key: orderId, value: JSON.stringify(payload), headers }] });
console.log({ topic, partition: report.partition, offset: report.baseOffset, ce_id: headers.ce_id, orderId });
await producer.disconnect();
