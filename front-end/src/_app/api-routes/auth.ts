import 'server-only';
import { type LoginResponseDto, toApiError } from '@/shared/api';
import { backendFetch, destroySession, REQUEST_ID_HEADER, saveSession } from '@/shared/api/index.server';

/**
 * POST /api/auth/login: back-end에서 토큰을 받아 세션 쿠키에 저장한다. 토큰은 응답 본문으로 내보내지 않는다.
 * - JSON 요청(화면의 fetch): 결과를 JSON으로 돌려준다
 * - 폼 요청(JavaScript가 아직 없을 때의 기본 제출): 결과에 따라 303으로 이동한다
 */
export async function login(request: Request): Promise<Response> {
  const isForm = !request.headers.get('content-type')?.includes('application/json');
  let body: { loginId?: unknown; password?: unknown; next?: unknown };
  try {
    body = isForm ? Object.fromEntries(await request.formData()) : ((await request.json()) as typeof body);
  } catch {
    return problem('validation', '요청 형식이 올바르지 않습니다');
  }
  const next = safeNext(body.next);
  const res = await backendFetch('/auth/login', {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ loginId: body.loginId, password: body.password }),
  });
  if (!res.ok) {
    const failure = await toApiError(res);
    if (isForm) {
      const error = failure.type === 'too-many-requests' ? 'throttled' : failure.type === 'invalid-credentials' ? 'invalid' : 'failed';
      return seeOther(`/login?error=${error}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    }
    return Response.json(
      { type: `urn:restella:problem:${failure.type ?? 'internal'}`, title: failure.message, status: failure.status, requestId: failure.requestId },
      { status: failure.status, headers: { 'content-type': 'application/problem+json', ...(failure.requestId ? { [REQUEST_ID_HEADER]: failure.requestId } : {}) } },
    );
  }
  const data = (await res.json()) as LoginResponseDto;
  await saveSession({ accessToken: data.accessToken, expiresAt: Date.parse(data.expiresAt), operator: data.operator });
  if (isForm) return seeOther(next ?? '/inventory');
  return Response.json({ operator: data.operator, expiresAt: data.expiresAt });
}

/** 로그인 뒤 돌아갈 경로. 같은 사이트의 경로만 허용한다 (열린 리다이렉트 방지) */
export function safeNext(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : undefined;
}

/**
 * 상대 경로로 이동시킨다. request.url로 절대 주소를 만들면 컨테이너 안에서는 서버의 바인드 주소(0.0.0.0:3000)가 되어,
 * 브라우저가 엉뚱한 곳으로 간다 (로드밸런서·프록시 뒤에서도 같다)
 */
function seeOther(path: string): Response {
  return new Response(null, { status: 303, headers: { location: path } });
}

/** POST /api/auth/logout */
export async function logout(): Promise<Response> {
  await destroySession();
  return new Response(null, { status: 204 });
}

/** BFF가 직접 만드는 오류. back-end와 같은 problem+json 형식과 유형 목록(docs/2-design/api.md "오류 유형")을 쓴다 */
export function problem(type: 'validation' | 'unauthorized' | 'not-found', title: string): Response {
  const status = { validation: 400, unauthorized: 401, 'not-found': 404 }[type];
  return Response.json({ type: `urn:restella:problem:${type}`, title, status }, { status, headers: { 'content-type': 'application/problem+json' } });
}
