# 테스트 전략

## 원칙

1. **요구사항의 완료 조건이 곧 테스트다.** 테스트 이름에 완료 조건 ID(`AC-05-1` 등)를 붙여서 [요구사항](../1-planning/requirements.md)과 1:1로 이어지게 한다.
2. **동시성은 실제 DB로 검증한다.** 잠금, 유일키, CHECK 제약은 DB마다 동작이 다르다. 그래서 모의 객체 대신 Testcontainers로 운영과 같은 MariaDB 12.3.3을 띄운다([ADR-0004](../adr/0004-reservation-consistency-and-sync.md)).
3. **실제 경로로 검증한다.** E2E 테스트는 앱을 실제 포트로 띄우고 HTTP로 요청한다. 채널 요청은 실제 HMAC 서명을 붙인다. 시뮬레이터와 동기화 발송기가 HTTP로 자기 자신을 부르는 경로까지 함께 검증된다.

## 수준별 범위

| 수준 | 도구 | 대상 | 위치 |
|---|---|---|---|
| 단위 | Vitest 5 | 순수 로직: 숙박일 계산, 서명, 재시도 간격, 잠금 재시도 | `back-end/src/**/*.spec.ts` |
| 통합·E2E (back-end) | Vitest 5 + Testcontainers(MariaDB 12.3.3) + HTTP | 요구사항의 완료 조건 전체(API 수준) | `back-end/test/*.e2e-spec.ts` |
| 빌드 결과물 확인 | 빌드 → 마이그레이션 → 시드 → 기동 → HTTP 호출 | 컴파일된 ESM이 실제로 뜨는지 | 로컬 Docker Compose |
| E2E (화면) | Playwright | "마지막 1실" 시연 시나리오 | `front-end/e2e/last-room.spec.ts` |
| 인프라 | terraform fmt·validate·plan, 로컬 k3s v1.36.5(Docker)에 차트 배포 후 Playwright E2E, demo 실제 배포 | 차트·클러스터 구성, demo 환경 | `infra/` ([infra 설계](../../infra/README.md)) |

## 동시성 테스트 설계

| 위험 | 테스트 | 기대 |
|---|---|---|
| 마지막 1실 경쟁 | 남은 1실에 동시 50건 (AC-05-1) | 확정 정확히 1건 |
| 연박과 채널 유형이 섞인 경쟁 | 겹치는 5가지 기간 × 5개 채널, 동시 80건 (AC-05-2) | 모든 숙박일 판매 수 ≤ 총 재고 |
| 교착 | 서로 다른 순서로 겹치는 연박 4종, 동시 60건 (AC-05-3) | 모든 요청이 200 또는 409로 끝남 (5xx 없음) |
| 같은 예약의 동시 재전송 | 같은 예약 동시 20건 (AC-08-3) | 예약 1건, 차감 1회 |
| 로직 우회 | DB에 직접 판매 수 > 총 재고를 저장 시도 (AC-N01-1) | CHECK 제약이 막음 |

간헐적인 실패를 잡기 위해, 동시성 테스트는 바꿀 때마다 여러 번 반복 실행해서 확인한다.

## 테스트 격리

- 모든 E2E 파일은 컨테이너 하나를 공유하고 순서대로 실행한다.
- 테스트마다 모든 테이블을 비우고 같은 시드를 넣는다.
- 가짜 채널이 기억한 값도 함께 초기화한다. DB를 비우면 revision이 1부터 다시 시작하는데, 가짜 채널은 "이미 받은 revision보다 오래된 값은 무시"하기 때문이다(AC-12-3).
- 비동기로 일어나는 일(채널 동기화)은 고정 대기 대신 조건이 만족될 때까지 기다린다(`waitFor`). 동기화 완료 시간 자체가 요구사항(5초)이라 기다리는 상한도 그 값으로 둔다.

## 실행

```bash
cd back-end
pnpm test            # 단위
pnpm test:e2e        # 통합·E2E (Docker 필요)
pnpm vitest run --config ./vitest.config.e2e.ts --coverage
```
