import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './openapi/openapi.yaml',
  output: './src/generated/openapi',
  plugins: ['@hey-api/typescript', 'nestjs', 'zod'],
});
