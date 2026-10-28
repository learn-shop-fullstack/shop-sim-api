import { kafka, TOPIC } from './kafka.ts';

const producer = kafka.producer();
await producer.connect();

// 키가 같으면 같은 파티션으로 간다 → 주문별 순서 보장(ADR 0004)
const reports = await producer.send({
  topic: TOPIC,
  messages: [1, 2, 3, 1, 2, 3].map((order, i) => ({
    key: `order-${order}`,
    value: JSON.stringify({ seq: i + 1 }),
  })),
});
console.log(reports.map((r) => ({ partition: r.partition, baseOffset: r.baseOffset })));

await producer.disconnect();
