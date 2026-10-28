import { kafka, TOPIC } from './kafka.ts';

const consumer = kafka.consumer({
  kafkaJS: { groupId: 'poc-group', fromBeginning: true, autoCommit: false },
});
await consumer.connect();
await consumer.subscribe({ topic: TOPIC });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    console.log(`처리 p${partition} o${message.offset} ${message.key} ${message.value}`);
    // 처리가 끝난 뒤에 커밋한다. 커밋 값은 "다음에 읽을 오프셋"이라 +1
    await consumer.commitOffsets([{ topic, partition, offset: String(Number(message.offset) + 1) }]);
  },
});

process.once('SIGTERM', async () => {
  await consumer.disconnect();
  process.exit(0);
});
