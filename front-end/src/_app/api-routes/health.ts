/** GET /api/health: 프로세스가 요청을 받을 수 있는지만 본다 (쿠버네티스 프로브, compose healthcheck). 세션·back-end는 보지 않는다 */
export function health(): Response {
  return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
}
