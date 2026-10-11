import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { resolveServerEnv } = await import('./env.server');

const SECRET = 'x'.repeat(32);

describe('resolveServerEnv', () => {
  it('local은 BACKEND_URL을 쓰고, HTTP 쿠키를 허용한다', () => {
    expect(resolveServerEnv({ APP_ENV: 'local', BACKEND_URL: 'http://back-end:3000/', SESSION_SECRET: SECRET })).toEqual({
      appEnv: 'local',
      backendUrl: 'http://back-end:3000',
      sessionSecret: SECRET,
      secureCookie: false,
    });
  });

  it('demo·prod는 BACKEND_URL을 무시하고 클러스터 내부 주소를 쓴다', () => {
    for (const appEnv of ['demo', 'prod']) {
      const env = resolveServerEnv({ APP_ENV: appEnv, BACKEND_URL: 'http://elsewhere', SESSION_SECRET: SECRET });
      expect(env.backendUrl).toBe('http://api.restella.svc.cluster.local:3000');
      expect(env.secureCookie).toBe(true);
    }
  });

  it('값이 없거나 틀리면 시작하지 않는다', () => {
    expect(() => resolveServerEnv({ SESSION_SECRET: SECRET, BACKEND_URL: 'http://x' })).toThrow('APP_ENV');
    expect(() => resolveServerEnv({ APP_ENV: 'staging', SESSION_SECRET: SECRET })).toThrow('APP_ENV');
    expect(() => resolveServerEnv({ APP_ENV: 'local', SESSION_SECRET: SECRET })).toThrow('BACKEND_URL');
    expect(() => resolveServerEnv({ APP_ENV: 'demo', SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET');
  });
});
