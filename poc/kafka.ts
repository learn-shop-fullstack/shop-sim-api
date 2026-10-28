import rdkafka from '@confluentinc/kafka-javascript';

export const TOPIC = 'poc.events';
export const kafka = new rdkafka.KafkaJS.Kafka({ kafkaJS: { brokers: ['localhost:9092'] } });
