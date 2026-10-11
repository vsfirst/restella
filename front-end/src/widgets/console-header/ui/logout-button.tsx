'use client';

import { useLogoutController } from '../lib/use-logout.controller';

export function LogoutButton() {
  const { pending, logout } = useLogoutController();
  return (
    <button type="button" onClick={logout} disabled={pending} className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
      로그아웃
    </button>
  );
}
