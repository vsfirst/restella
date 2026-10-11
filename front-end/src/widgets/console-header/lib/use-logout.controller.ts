import { useState } from 'react';
import { logout as requestLogout } from '../api/auth.client';

export function useLogoutController() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await requestLogout();
    // 캐시된 화면과 쿼리를 모두 버리도록 라우터 대신 전체 이동한다
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/login');
  }

  return { pending, logout };
}
