import { authRoutes } from '@/shared/api';

/** BFF 로그아웃. 세션 쿠키를 지운다 */
export async function logout(): Promise<void> {
  await fetch(authRoutes.logout, { method: 'POST' }).catch(() => undefined);
}
