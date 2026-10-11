import type { NextRequest } from 'next/server';
import 'server-only';
import { backendFetch, destroySession, readSession, REQUEST_ID_HEADER } from '@/shared/api/index.server';
import { problem } from './auth';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * /api/bff/* → back-end /api/v1/* 중계 (docs/2-design/api.md "front-end BFF 경로").
 * - 세션의 토큰을 붙인다. 세션이 없으면 401 (proxy.ts와 별개로 여기서도 확인한다)
 * - 채널 API(/channel/*)는 채널 서명 전용이라 중계하지 않는다
 * - SSE(/events/stream)도 같은 경로로 그대로 흘려보낸다. 브라우저가 끊으면 back-end 연결도 끊는다
 */
export async function bff(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const session = await readSession();
  if (!session) return problem('unauthorized', '로그인이 필요합니다');

  const { path } = await context.params;
  if (path[0] === 'channel') return problem('not-found', '없는 경로입니다');
  const target = `/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const hasBody = BODY_METHODS.has(request.method) && request.headers.get('content-type')?.includes('application/json');

  const upstream = await backendFetch(target, {
    method: request.method,
    token: session.accessToken,
    body: hasBody ? await request.text() : undefined,
    contentType: hasBody ? 'application/json' : null,
    accept: request.headers.get('accept') ?? 'application/json',
    signal: request.signal,
    requestId: request.headers.get(REQUEST_ID_HEADER),
  });

  if (upstream.status === 401) await destroySession(); // 토큰이 만료·폐기됨

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // back-end가 붙인 요청 ID를 브라우저에 그대로 넘긴다 (오류 문의·로그 검색용)
  const requestId = upstream.headers.get(REQUEST_ID_HEADER);
  if (requestId) headers.set(REQUEST_ID_HEADER, requestId);
  if (contentType?.startsWith('text/event-stream')) {
    // 압축·버퍼링을 막아야 이벤트가 바로 전달된다
    headers.set('cache-control', 'no-cache, no-transform');
    headers.set('x-accel-buffering', 'no');
  } else {
    headers.set('cache-control', 'no-store');
  }
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers });
}
