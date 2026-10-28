import { kafka, TOPIC } from './kafka.ts';

// 이 seq를 처리한 직후, 커밋하기 전에 프로세스를 죽인다
const crashOnSeq = Number(process.env.CRASH_ON_SEQ ?? 0);

const consumer = kafka.consumer({
  kafkaJS: { groupId: 'poc-group', fromBeginning: true, autoCommit: false },
});
await consumer.connect();
await consumer.subscribe({ topic: TOPIC });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    console.log(`처리 p${partition} o${message.offset} ${message.key} ${message.value}`);
    if (JSON.parse(String(message.value)).seq === crashOnSeq) {
      console.log('커밋 전 강제 종료');
      process.exit(1);
    }
    // 처리가 끝난 뒤에 커밋한다. 커밋 값은 "다음에 읽을 오프셋"이라 +1
    await consumer.commitOffsets([{ topic, partition, offset: String(Number(message.offset) + 1) }]);
  },
});

process.once('SIGTERM', async () => {
  await consumer.disconnect();
  process.exit(0);
});
