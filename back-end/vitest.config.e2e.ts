import { defineConfig } from 'vitest/config';

// 통합·E2E 테스트: Testcontainers로 실제 MariaDB를 띄워 HTTP로 검증한다 (test/**/*.e2e-spec.ts)
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    // 모든 파일이 컨테이너 하나를 공유하고 테이블을 비우며 쓰므로 순서대로 실행한다
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/database/run-migrations.ts', 'src/database/seeds/run-seed.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
