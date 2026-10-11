import { defineConfig } from 'vitest/config';

// 단위 테스트: 화면 없이 도는 순수 로직 (src/**/*.test.ts). 화면 흐름은 Playwright(e2e/)로 검증한다
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
