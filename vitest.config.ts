import { defineConfig } from 'vitest/config';

// 인라인 project는 루트 설정을 상속한다(Vitest 5). include는 루트에 두지 않고 project마다 정한다
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['apps/**/*.spec.ts'],
          exclude: ['apps/**/*.contract.spec.ts'],
        },
      },
      {
        // 실제 Postgres(테스트 DB)에 앱을 띄워 검증기를 켠 채 요청한다. DB가 없으면 건너뛰지 않고 실패한다
        test: {
          name: 'contract',
          include: ['apps/**/*.contract.spec.ts'],
          globalSetup: ['apps/api/test/contract-setup.ts'],
          // 파일들이 같은 테스트 DB를 쓴다
          fileParallelism: false,
        },
      },
    ],
  },
});
