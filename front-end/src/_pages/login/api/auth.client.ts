import { authRoutes } from '@/shared/api';

/** BFF 로그인. 성공하면 BFF가 토큰을 세션 쿠키에 저장하고, 응답 본문에는 토큰이 없다 */
export async function login(body: { loginId: FormDataEntryValue | null; password: FormDataEntryValue | null; next?: string }): Promise<Response> {
  return fetch(authRoutes.login, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
