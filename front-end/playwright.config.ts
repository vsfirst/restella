import { defineConfig } from '@playwright/test';

/**
 * 화면 E2E: "마지막 1실" 시연 시나리오 (docs/2-design/ui/README.md).
 * back-end와 front-end가 떠 있어야 한다. 실행 방법: front-end/README.md "테스트"
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1, // 같은 DB를 쓰는 시나리오라 순서대로 돈다
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3200',
    // 로컬에 설치된 Chrome을 쓴다. CI에서 Playwright 내장 Chromium을 쓰려면 E2E_BROWSER_CHANNEL=chromium
    channel: process.env.E2E_BROWSER_CHANNEL ?? 'chrome',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
});
