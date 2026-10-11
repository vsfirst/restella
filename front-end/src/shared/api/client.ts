import { BFF_PREFIX, type Endpoint, type OptionsArg, type OutputOf, toUrl } from './endpoints';
import { ApiError, toApiError } from './errors';

/**
 * 브라우저 → BFF(/api/bff) 요청. 메서드·경로·타입은 endpoints의 정의를 따른다.
 * 토큰은 서버의 세션 쿠키에만 있고 BFF가 붙인다. 세션이 끝났으면(401) 로그인 화면으로 보낸다.
 */
export async function clientFetch<E extends Endpoint>(endpoint: E, ...[options]: OptionsArg<E>): Promise<OutputOf<E>> {
  const opts = (options ?? {}) as { path?: unknown[]; params?: object; input?: unknown; signal?: AbortSignal };
  const res = await fetch(`${BFF_PREFIX}${toUrl(endpoint, opts)}`, {
    method: endpoint.method,
    headers: {
      accept: 'application/json',
      ...(opts.input === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: opts.input === undefined ? undefined : JSON.stringify(opts.input),
    signal: opts.signal,
    cache: 'no-store',
  });
  if (res.status === 401) {
    // React 밖이라 라우터가 없다. 화면 상태도 버려야 하므로 전체 이동한다
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?expired=1&next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    throw new ApiError(401, '로그인이 만료되었습니다');
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as OutputOf<E>;
  return (await res.json()) as OutputOf<E>;
}
