import { type NextRequest, NextResponse } from 'next/server';
import { isSealValid, SESSION_COOKIE } from '@/shared/api/index.server';

/**
 * 페이지 보호 (front-end/README.md "인증 흐름"). 쿠키만 풀어 보는 빠른 확인이다.
 * BFF Route Handler와 서버 렌더링도 세션을 다시 확인하므로, matcher가 바뀌어도 보호가 빠지지 않는다.
 */
export async function proxy(request: NextRequest) {
  if (await isSealValid(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  // nextUrl은 요청의 Host로 주소를 만든다. request.url은 컨테이너 안에서 서버의 바인드 주소(0.0.0.0:3000)가 될 수 있어 쓰지 않는다
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(login);
}

export const config = {
  // 로그인 화면, BFF·인증 API, 정적 파일은 제외한다
  matcher: ['/((?!login|api/|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
