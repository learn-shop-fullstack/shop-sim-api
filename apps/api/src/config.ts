import { z } from 'zod';

// 환경 변수는 시작할 때 한 번 검증한다. 값이 잘못되면 요청을 받기 전에 실패한다.
// 변수는 쓰는 기능이 생길 때 추가하고, 같은 이름을 .env.example에도 적는다
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`환경 변수가 잘못됐다\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
