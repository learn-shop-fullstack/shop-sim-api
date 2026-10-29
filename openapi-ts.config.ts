import { defineConfig } from '@hey-api/openapi-ts';

// 컨트롤러가 구현할 타입을 스펙에서 만든다(ADR 0012). 생성물은 커밋하지 않는다.
// 입력은 원본이 아니라 openapi:bundle이 합친 파일이다
export default defineConfig({
  input: './dist/openapi/openapi.yaml',
  output: {
    path: './apps/api/src/generated/openapi',
    // ESM(nodenext)이라 생성물의 상대 import에도 .js를 붙인다
    module: { extension: '.js' },
  },
  plugins: ['@hey-api/typescript', 'nestjs'],
});
