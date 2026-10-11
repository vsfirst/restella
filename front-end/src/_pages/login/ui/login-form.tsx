'use client';

import { authRoutes } from '@/shared/api';
import { buttonClass, ErrorText, inputClass } from '@/shared/ui';
import { useLoginFormController } from '../lib/use-login-form.controller';

/** 로그인 폼 (S-01). BFF가 back-end에서 받은 토큰을 세션 쿠키에 저장한다 */
export function LoginForm(props: { next?: string; expired?: boolean; error?: string }) {
  const { error, pending, onSubmit } = useLoginFormController(props);

  return (
    // JavaScript가 실행되기 전에 제출돼도 비밀번호가 URL에 실리지 않도록 POST로 BFF에 보낸다
    <form method="post" action={authRoutes.login} onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-base font-semibold">운영자 로그인</h1>
      {props.next && <input type="hidden" name="next" value={props.next} />}

      <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="loginId">
        아이디
      </label>
      <input id="loginId" name="loginId" autoComplete="username" required maxLength={64} className={`mt-1.5 ${inputClass}`} />

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
        비밀번호
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={128}
        className={`mt-1.5 ${inputClass}`}
      />
      <ErrorText>{error}</ErrorText>

      <button type="submit" disabled={pending} className={`mt-6 w-full ${buttonClass.primary} py-2.5`}>
        {pending ? '로그인 중…' : '로그인'}
      </button>

      <ul className="mt-5 space-y-1 text-xs text-slate-500">
        <li>· 로그인하면 8시간 동안 유지됩니다.</li>
        <li>· 1분에 5회까지 시도할 수 있습니다.</li>
      </ul>
    </form>
  );
}
