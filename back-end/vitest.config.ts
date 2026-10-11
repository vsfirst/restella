import { defineConfig } from 'vitest/config';

// 단위 테스트: DB 없이 도는 순수 로직 (src/**/*.spec.ts)
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
