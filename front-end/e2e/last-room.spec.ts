import { expect, type Page, test } from '@playwright/test';

// 데모 운영자 계정. 값은 환경변수로만 받는다 (공개 저장소: docs/2-design/security.md)
const LOGIN_ID = process.env.E2E_LOGIN_ID ?? 'demo-operator';
const PASSWORD = process.env.E2E_PASSWORD ?? '';
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

/** 서울 기준 오늘 + days. 다른 데이터와 겹치지 않도록 먼 날짜를 쓴다 */
function seoulDate(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test.describe.configure({ mode: 'serial' });

test('S-01 로그인하지 않으면 로그인 화면으로 보낸다 (REQ-18)', async ({ page }) => {
  await page.goto('/conflicts');
  await expect(page).toHaveURL(/\/login\?next=%2Fconflicts/);
  await page.getByLabel('아이디').fill(LOGIN_ID);
  await page.getByLabel('비밀번호').fill('wrong-password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '올바르지 않습니다' })).toBeVisible();
  await shot(page, 'S-01-login');
});

test('"마지막 1실" 시연: 동시 예약 → 충돌 알림 → 처리 → 동기화 확인', async ({ page }) => {
  test.skip(!PASSWORD, 'E2E_PASSWORD가 필요하다');
  const stay = seoulDate(30);
  const next = seoulDate(31);

  // 1. 로그인 (S-01)
  await page.goto('/login');
  await page.getByLabel('아이디').fill(LOGIN_ID);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/inventory/);
  await expect(page.getByRole('heading', { name: '재고 달력' })).toBeVisible();
  await shot(page, 'S-02-inventory');

  // 로그인 토큰은 브라우저 JavaScript가 읽을 수 없다 (AC-18-3)
  expect(await page.evaluate(() => document.cookie)).not.toContain('restella_session');
  expect(await page.content()).not.toContain('accessToken');

  // 2. 시뮬레이터: 남은 1실에 50건 (통보형 40%, 중복 10%) (S-06, REQ-19)
  await page.getByRole('link', { name: '시뮬레이터' }).click();
  await expect(page.getByRole('heading', { name: '동시 예약 시뮬레이터' })).toBeVisible();
  await page.getByLabel('객실타입').selectOption({ label: '패밀리 스위트 (FAM-STE)' });
  await page.getByLabel('체크인').fill(stay);
  await page.getByLabel('체크아웃').fill(next);
  await page.getByLabel(/실행 전 남은 재고/).fill('1');
  await page.getByLabel(/요청 수/).fill('50');
  await page.getByRole('button', { name: '50건 동시 실행' }).click();

  // 3. 결과: 확정 1건, 초과 판매 0건
  const result = page.getByTestId('simulation-result');
  await expect(result).toContainText('초과 판매 0건');
  await expect(result).toContainText('50건 중 1건만 확정');

  // 4. 새로고침 없이 충돌 알림과 배지가 나타난다 (AC-13-2: 5초 이내)
  const toast = page.getByRole('status').filter({ hasText: '새 오버부킹 충돌' });
  await expect(toast).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('conflict-badge')).toBeVisible();
  await shot(page, 'S-06-simulator');

  // 5. 충돌 처리함: 하나는 해결됨(메모), 하나는 취소 (S-04, REQ-14)
  await toast.getByRole('link', { name: /충돌 처리함 열기/ }).click();
  await expect(page).toHaveURL(/\/conflicts$/);
  // 스트리밍된 내용은 화면에 드러나기 전에도 DOM에 있으므로 보이는 것만 센다
  const rows = page.getByTestId('conflict-row').filter({ hasText: '패밀리 스위트', visible: true });
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  expect(before).toBeGreaterThanOrEqual(2);
  await shot(page, 'S-04-conflicts');

  await rows.first().getByRole('button', { name: '해결됨' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '해결됨으로 처리' })).toBeDisabled(); // 메모 필수 (AC-14-2)
  await dialog.getByLabel(/메모/).fill('손님과 통화. 인근 제휴 숙소로 안내 (E2E)');
  await dialog.getByRole('button', { name: '해결됨으로 처리' }).click();
  await expect(dialog).toBeHidden();
  await expect(rows).toHaveCount(before - 1);

  page.once('dialog', (d) => d.accept());
  await rows.first().getByRole('button', { name: '취소' }).click();
  await expect(rows).toHaveCount(before - 2);

  // 6. 재고 달력: 해당 날짜가 매진 (S-02)
  await page.goto(`/inventory?from=${stay}`);
  await expect(page.getByTestId(`cell-FAM-STE-${stay}`)).toHaveText('매진');

  // 7. 채널별 재고: 5개 채널 모두 판매 중지를 받았다 (S-07, REQ-20)
  await page.goto(`/channels?roomTypeId=3&from=${stay}`);
  await expect(page.getByText('0 · 판매 중지').filter({ visible: true })).toHaveCount(5, { timeout: 5_000 });
  await shot(page, 'S-07-channels');

  // 8. 이벤트 로그: 과정이 기록되어 있다 (S-05, REQ-17)
  await page.goto('/events');
  await expect(page.getByRole('cell', { name: '충돌 해결됨' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '오버부킹 충돌' }).first()).toBeVisible();
  await shot(page, 'S-05-events');

  // 9. 예약 목록과 상세 (S-03, S-03a)
  await page.goto(`/reservations?status=CONFIRMED&from=${stay}&to=${stay}`);
  await page.getByRole('row').filter({ hasText: '패밀리 스위트' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('차감된 숙박일');
  await shot(page, 'S-03a-reservation');

  // 10. 로그아웃하면 다시 로그인해야 한다 (AC-18-2)
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/inventory');
  await expect(page).toHaveURL(/\/login\?next=%2Finventory/);
});
