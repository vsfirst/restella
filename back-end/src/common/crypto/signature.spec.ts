import { requestHash, sign, verify } from './signature.js';

const SECRET = 'test-secret-test-secret-test-secret!';
const body = Buffer.from('{"a":1}');

describe('요청 서명 (REQ-09)', () => {
  it('올바른 서명은 통과한다', () => {
    const ts = 1_760_000_000;
    expect(verify(SECRET, String(ts), sign(SECRET, ts, body), body, ts)).toBe('ok');
  });

  it('AC-09-1: 다른 키로 만든 서명은 거절한다', () => {
    const ts = 1_760_000_000;
    expect(verify(SECRET, String(ts), sign('other-secret-other-secret-other!!', ts, body), body, ts)).toBe('bad-signature');
  });

  it('본문이 바뀌면 거절한다', () => {
    const ts = 1_760_000_000;
    expect(verify(SECRET, String(ts), sign(SECRET, ts, body), Buffer.from('{"a":2}'), ts)).toBe('bad-signature');
  });

  it('5분 넘게 차이 나는 시각은 재전송으로 보고 거절한다', () => {
    const ts = 1_760_000_000;
    expect(verify(SECRET, String(ts), sign(SECRET, ts, body), body, ts + 301)).toBe('stale');
  });

  it('헤더가 없거나 형식이 틀리면 거절한다', () => {
    expect(verify(SECRET, undefined, undefined, body)).toBe('bad-signature');
    expect(verify(SECRET, 'abc', 'v1=00', body)).toBe('bad-signature');
  });
});

describe('requestHash', () => {
  it('키 순서와 무관하다', () => {
    expect(requestHash({ a: 1, b: 'x' })).toBe(requestHash({ b: 'x', a: 1 }));
  });

  it('내용이 다르면 달라진다', () => {
    expect(requestHash({ checkOut: '2026-10-12' })).not.toBe(requestHash({ checkOut: '2026-10-13' }));
  });
});
