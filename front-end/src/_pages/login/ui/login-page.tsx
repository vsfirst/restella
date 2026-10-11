import { Suspense } from 'react';
import { firstParam, type SearchParams } from '@/shared/lib';
import { LoginForm } from './login-form';

/** S-01 로그인 */
export function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight">Restella</p>
          <p className="mt-1 text-sm text-slate-500">여러 채널의 예약을 하나의 재고 원장으로</p>
        </div>
        <Suspense fallback={<LoginForm />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = firstParam(sp.next);
  return (
    <LoginForm
      next={next?.startsWith('/') && !next.startsWith('//') ? next : undefined}
      expired={firstParam(sp.expired) === '1'}
      error={firstParam(sp.error)}
    />
  );
}
