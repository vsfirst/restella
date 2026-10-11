import { getIronSession, type SessionOptions, unsealData } from 'iron-session';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import 'server-only';
import { serverEnv } from '../config/env.server';

/** 세션 쿠키에 담는 값. 브라우저 JavaScript는 이 쿠키를 읽을 수 없다 (httpOnly, 암호화) */
export interface SessionData {
  accessToken: string;
  /** 토큰 만료 시각 (epoch ms). iron-session 9는 Date를 받지 않는다 */
  expiresAt: number;
  operator: { id: number; name: string };
}

export const SESSION_COOKIE = 'restella_session';

export function sessionOptions(ttlSeconds?: number): SessionOptions {
  return {
    cookieName: SESSION_COOKIE,
    password: serverEnv().sessionSecret,
    // 토큰 만료와 맞춘다. 쿠키 max-age는 iron-session이 ttl - 60초로 정한다
    ttl: ttlSeconds,
    cookieOptions: {
      httpOnly: true,
      secure: serverEnv().secureCookie, // local만 HTTP 허용
      sameSite: 'lax',
      path: '/',
    },
  };
}

/** 유효한 세션만 돌려준다. 없거나 토큰이 만료됐으면 null */
export async function readSession(): Promise<SessionData | null> {
  // 만료 확인은 현재 시각을 읽으므로 요청 시점에만 한다 (세션 내용을 미리 렌더링하지 않는다)
  await connection();
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  if (!session.accessToken || !session.operator || !session.expiresAt || session.expiresAt <= Date.now()) return null;
  return { accessToken: session.accessToken, expiresAt: session.expiresAt, operator: session.operator };
}

export async function saveSession(data: SessionData): Promise<void> {
  const ttlSeconds = Math.max(120, Math.floor((data.expiresAt - Date.now()) / 1000));
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions(ttlSeconds));
  Object.assign(session, data);
  await session.save();
}

export async function destroySession(): Promise<void> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  session.destroy();
}

/** proxy.ts용 빠른 확인: 쿠키를 풀어 만료만 본다 (back-end 호출 없음) */
export async function isSealValid(seal: string | undefined): Promise<boolean> {
  if (!seal) return false;
  try {
    const data = await unsealData<Partial<SessionData>>(seal, { password: serverEnv().sessionSecret });
    return Boolean(data.accessToken && data.expiresAt && data.expiresAt > Date.now());
  } catch {
    return false;
  }
}
