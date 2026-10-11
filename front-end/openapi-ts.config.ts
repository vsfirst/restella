import { defineConfig } from '@hey-api/openapi-ts';

// back-end Swagger 명세에서 API 타입만 만든다. 실행 중인 back-end가 필요하다: pnpm gen:api
export default defineConfig({
  input: `${process.env.BACKEND_URL ?? 'http://localhost:3100'}/api/docs-json`,
  output: { path: 'src/shared/api/generated' },
  plugins: ['@hey-api/typescript'],
});
