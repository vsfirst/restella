import { redirect } from 'next/navigation';
import 'server-only';
import { serverEnv } from '../config/env.server';
import { type Endpoint, type OptionsArg, type OutputOf, toUrl } from './endpoints';
import { toApiError } from './errors';

export const REQUEST_ID_HEADER = 'x-request-id';
import { readSession } from './session.server';

/** 서버 → back-end 운영자 API(/api/v1). 응답을 그대로 다룰 때 쓴다 (BFF 중계) */
export function backendFetch(
  path: string,
  init: {
    method?: string;
    token?: string;
    body?: BodyInit | null;
    contentType?: string | null;
    signal?: AbortSignal;
    accept?: string;
    /** 앞단에서 받은 요청 ID. 넘기면 back-end가 이어 쓴다 */
    requestId?: string | null;
  } = {},
): Promise<Response> {
  const headers = new Headers({ accept: init.accept ?? 'application/json' });
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  if (init.contentType) headers.set('content-type', init.contentType);
  if (init.requestId) headers.set(REQUEST_ID_HEADER, init.requestId);
  return fetch(`${serverEnv().backendUrl}/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body,
    signal: init.signal,
    cache: 'no-store',
  });
}

/**
 * 서버 렌더링에서 화면 데이터를 받는다. 메서드·경로·타입은 endpoints의 정의를 따르고, 세션의 토큰을 붙인다.
 * 세션이 없거나 back-end가 토큰을 거절하면 로그인 화면으로 보낸다.
 * proxy.ts가 먼저 막지만, matcher가 바뀌어도 보호가 빠지지 않도록 여기서도 확인한다 (front-end/README.md)
 */
export async function serverFetch<E extends Endpoint>(endpoint: E, ...[options]: OptionsArg<E>): Promise<OutputOf<E>> {
  const opts = (options ?? {}) as { path?: unknown[]; params?: object; input?: unknown; signal?: AbortSignal };
  const session = await readSession();
  if (!session) redirect('/login');
  const res = await backendFetch(toUrl(endpoint, opts), {
    method: endpoint.method,
    token: session.accessToken,
    body: opts.input === undefined ? undefined : JSON.stringify(opts.input),
    contentType: opts.input === undefined ? null : 'application/json',
    signal: opts.signal,
  });
  if (res.status === 401) redirect('/login?expired=1');
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as OutputOf<E>;
}
