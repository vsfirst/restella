import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toApiError } from '@/shared/api';
import { login } from '../api/auth.client';

const LOGIN_ERRORS: Record<string, string> = {
  invalid: '아이디 또는 비밀번호가 올바르지 않습니다.',
  throttled: '로그인 시도가 너무 많습니다. 1분 뒤에 다시 시도하세요.',
  failed: '로그인하지 못했습니다. 잠시 뒤 다시 시도하세요.',
};

interface Params {
  next?: string;
  expired?: boolean;
  /** JavaScript 없이 제출됐을 때 BFF가 돌려준 오류 코드 (?error=) */
  error?: string;
}

/** 로그인 폼: BFF에 JSON으로 제출하고, 성공하면 원래 가려던 화면으로 간다 */
export function useLoginFormController({ next, expired, error: initialError }: Params) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    initialError ? (LOGIN_ERRORS[initialError] ?? LOGIN_ERRORS.failed) : expired ? '로그인이 만료되었습니다. 다시 로그인하세요.' : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await login({ loginId: form.get('loginId'), password: form.get('password'), next });
      if (res.ok) {
        router.replace(next ?? '/inventory');
        router.refresh();
        return;
      }
      const { type } = await toApiError(res);
      setError(LOGIN_ERRORS[type === 'too-many-requests' ? 'throttled' : type === 'invalid-credentials' ? 'invalid' : 'failed']);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  return { error, pending, onSubmit };
}
