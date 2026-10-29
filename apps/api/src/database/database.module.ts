import { Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Config } from '../config.js';
import { CONFIG } from '../config.module.js';

// 쓰는 쪽: constructor(@Inject(DB) private readonly db: Db)
export const DB = Symbol('DB');
export type Db = NodePgDatabase;

// 풀은 이 모듈 안에서만 쓴다. 밖에는 Drizzle 인스턴스(DB)만 내보낸다
const PG_POOL = Symbol('PG_POOL');

// 전역으로 두지 않는다. DB를 쓰는 모듈이 직접 import해서 의존이 코드에 드러나게 한다.
// worker가 DB를 쓰게 되면(3단계) 레포 루트 db/로 옮긴다
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [CONFIG],
      useFactory: (config: Config) => {
        // 연결은 첫 쿼리 때 연다. 기본 connectionTimeoutMillis는 0(무한 대기)이라 DB에 닿지
        // 못하면 요청이 응답 없이 매달린다. 5초 뒤 실패시켜 500으로 돌려준다
        const pool = new Pool({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 5_000 });
        // 쉬던 연결이 끊기면(DB 재시작 등) 'error'가 난다. 리스너가 없으면 프로세스가 죽는다.
        // 끊긴 연결은 풀이 버리고 다음 요청 때 새로 연다
        pool.on('error', (error) => new Logger('PgPool').error(error.stack));
        return pool;
      },
    },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: Pool) => drizzle({ client: pool }) },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // HTTP 서버가 닫힌 뒤(새 요청을 받지 않는 상태) 호출된다. 열린 연결을 정리하고 끝낸다
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
