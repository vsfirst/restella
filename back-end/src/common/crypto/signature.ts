import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// 채널 웹훅과 재고 동기화 요청의 서명 (docs/2-design/api.md "요청 서명")
// 서명 = "v1=" + hex(HMAC-SHA256(비밀키, "{timestamp}.{원본 본문}"))

export const SIGNATURE_HEADER = 'x-restella-signature';
export const TIMESTAMP_HEADER = 'x-restella-timestamp';
export const CHANNEL_HEADER = 'x-restella-channel';
export const MAX_CLOCK_SKEW_SECONDS = 300;

export function sign(secret: string, timestamp: number, rawBody: string | Buffer): string {
  const mac = createHmac('sha256', secret);
  mac.update(`${timestamp}.`);
  mac.update(rawBody);
  return `v1=${mac.digest('hex')}`;
}

export type VerifyResult = 'ok' | 'bad-signature' | 'stale';

export function verify(
  secret: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  rawBody: Buffer,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  const timestamp = Number(timestampHeader);
  if (!Number.isInteger(timestamp) || !signatureHeader) return 'bad-signature';
  if (Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) return 'stale';
  const expected = Buffer.from(sign(secret, timestamp, rawBody));
  const actual = Buffer.from(signatureHeader);
  // 길이가 다르면 timingSafeEqual이 예외를 던지므로 먼저 비교한다
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? 'ok' : 'bad-signature';
}

/** 요청 본문의 정규화 해시. 키 순서가 달라도 같은 내용이면 같은 값이 나온다 */
export function requestHash(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
  return createHash('sha256').update(canonical).digest('hex');
}
