import 'server-only';

/** 실행 환경. local은 내 컴퓨터(호스트 실행, Docker compose), demo·prod는 쿠버네티스 클러스터 */
export const APP_ENVS = ['local', 'demo', 'prod'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/**
 * local이 아니면 back-end는 같은 클러스터의 Service로 부른다. 환경변수로 받지 않는다.
 * 네임스페이스 restella의 Service api, 포트 3000. infra/gitops 차트의 이름과 맞춘다
 */
export const CLUSTER_BACKEND_URL: Record<Exclude<AppEnv, 'local'>, string> = {
  demo: 'http://api.restella.svc.cluster.local:3000',
  prod: 'http://api.restella.svc.cluster.local:3000',
};

export interface ServerEnv {
  appEnv: AppEnv;
  backendUrl: string;
  sessionSecret: string;
  /** HTTPS 전용 쿠키. local만 HTTP를 허용한다 */
  secureCookie: boolean;
}

/** 환경변수를 검증해 서버 설정으로 바꾼다 (테스트를 위해 process.env와 분리) */
export function resolveServerEnv(env: Record<string, string | undefined>): ServerEnv {
  const appEnv = env.APP_ENV;
  if (!APP_ENVS.includes(appEnv as AppEnv)) throw new Error(`APP_ENV는 ${APP_ENVS.join(', ')} 중 하나여야 한다 (.env.example 참고)`);
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET은 32자 이상이어야 한다 (.env.example 참고)');

  let backendUrl: string;
  if (appEnv === 'local') {
    if (!env.BACKEND_URL) throw new Error('APP_ENV=local이면 BACKEND_URL이 필요하다 (.env.example 참고)');
    backendUrl = env.BACKEND_URL;
  } else {
    backendUrl = CLUSTER_BACKEND_URL[appEnv as Exclude<AppEnv, 'local'>];
  }
  return { appEnv: appEnv as AppEnv, backendUrl: backendUrl.replace(/\/$/, ''), sessionSecret, secureCookie: appEnv !== 'local' };
}

let cached: ServerEnv | undefined;

/** 서버 전용 설정. 요청을 처리할 때 처음 읽고 검증한다 (빌드 시점에는 없어도 된다) */
export function serverEnv(): ServerEnv {
  cached ??= resolveServerEnv(process.env);
  return cached;
}
