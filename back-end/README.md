# back-end

Restella의 **재고 원장 API**다. 모든 채널의 예약을 하나의 재고 원장에서 처리하고, 오버부킹을 막거나 즉시 드러낸다.

- 기술: NestJS, TypeORM, Swagger, MariaDB
- 버전: [기술 스택](../docs/2-design/tech-stack.md)
- 시스템 전체에서의 위치: [README](../README.md#시스템-구성), [아키텍처](../docs/2-design/architecture.md)

## 책임

| 책임 | 내용 |
|---|---|
| 재고 원장 | 객실타입 × 숙박일(박) 단위로 총 재고와 판매 수를 관리한다. 체크아웃 날짜는 차감하지 않는다 |
| 예약 수신 | 채널 예약을 받아 재고를 차감한다. 연박은 모든 날짜를 한꺼번에 잡거나 하나도 잡지 않는다 |
| 채널 유형별 처리 | 확인형 채널은 매진이면 거절한다. 통보형 채널(이미 확정된 OTA 예약)은 매진이면 '오버부킹 충돌'로 기록한다 |
| 취소 | 재고를 정확히 되돌린다 |
| 채널 동기화 | 재고가 바뀌면 모든 채널에 남은 수량을 보낸다 |
| 충돌 관리 | 오버부킹 충돌을 모으고 운영자가 처리하게 한다 |
| 시뮬레이터 | 채널 5개를 흉내 낸다. 실제 채널 API로 동시 요청을 보내고, Restella가 보내는 남은 재고를 받는다 |
| 운영자 인증 | 로그인과 토큰 발급 |

## API 경계

| API | 호출자 | 인증 |
|---|---|---|
| 운영자 API | front-end BFF만 | back-end가 발급한 토큰 |
| 채널 웹훅 API | 채널(시뮬레이터) | 채널별 비밀 키로 만든 HMAC 서명 |

- 두 API는 경로와 인증을 분리한다.
- API 명세는 Swagger로 자동 생성한다.

## API 목록

구현된 엔드포인트 전체(채널 API 2개, 운영자 API 21개, 내부 경로)는 [API 목록](../docs/3-development/api-reference.md)에 있다. 설계는 [API 명세](../docs/2-design/api.md), 실행 중에는 Swagger(`/api/docs`)로 볼 수 있다.

## 핵심 설계

- **동시성:**
  - 트랜잭션 안에서 재고 행을 날짜 오름차순으로 잠그고(`SELECT … FOR UPDATE`), 남은 수량을 확인한 뒤 차감한다.
  - 잠금 순서를 고정해서 날짜가 겹치는 연박끼리 데드락이 나지 않게 한다.
  - `CHECK (sold <= total)` 제약을 마지막 방어선으로 둔다.
  - Redis 분산 락이나 메시지 큐는 쓰지 않는다. DB 트랜잭션으로 충분하다([범위](../docs/1-planning/scope.md)).
- **중복 요청 처리:** `(channel_id, channel_reservation_no)`에 UNIQUE를 건다. 같은 웹훅이 다시 와도 기존 결과를 돌려주고, 재고는 한 번만 줄인다. 거절도 저장해 같은 결과를 돌려준다.
- **채널 동기화:** 재고를 바꾸는 트랜잭션 안에서 채널별 "보내야 할 최신 값"(`channel_availability`)을 함께 기록하고, 발송기가 보낸다. 누락 없이 최신 값만 보낸다.
- **격리 수준:** 쓰기 트랜잭션은 `READ COMMITTED`다. MariaDB 기본값의 간격 잠금을 피한다.
- **날짜:** 숙박일은 시간이 없는 `DATE`로 저장한다. 기준 시간대는 `Asia/Seoul`이다.
- **스키마 변경:** TypeORM 마이그레이션으로만 바꾼다. `synchronize`는 쓰지 않는다.

상세 설계는 다음 문서에 있다.
- [도메인 모델·ERD](../docs/2-design/domain-model.md): 테이블, 상태 전이, 트랜잭션 흐름
- [API 명세](../docs/2-design/api.md)
- [ADR-0004](../docs/adr/0004-reservation-consistency-and-sync.md): 동시성, 중복 처리, 동기화, 실시간 알림 방식을 고른 근거

## 디렉토리 구조

```
back-end/
├── src/
│   ├── common/         # 예외 필터, 인터셉터, 가드, 데코레이터, 공용 DTO(날짜 범위)
│   ├── config/         # 환경변수 검증, TypeORM 설정
│   ├── app.setup.ts    # 전역 검증 파이프, 요청 ID, Swagger 설정 (main과 테스트가 함께 쓴다)
│   ├── database/
│   │   ├── migrations/ # TypeORM 마이그레이션
│   │   └── seeds/      # 데모 데이터 (가짜 값만)
│   └── modules/        # 도메인 모듈
│       └── <모듈>/     # controller · service · entity, dto/(요청·응답 DTO)
└── test/               # e2e, 동시성 통합 테스트
```

| 모듈 | 내용 |
|---|---|
| `auth` | 운영자 로그인, 토큰 발급 |
| `room-type` | 객실타입 |
| `inventory` | 재고 원장, 잠금과 차감 |
| `reservation` | 예약 수신·취소, 중복 요청 처리 |
| `channel` | 채널 목록, 웹훅 서명 검증, 동기화 상태 기록과 발송기, 채널 연결 인터페이스(시뮬레이터 구현) |
| `conflict` | 오버부킹 충돌 조회와 처리 |
| `event-log` | 이벤트 기록·조회, SSE 스트림 |
| `simulator` | 채널 시뮬레이터. 서명된 예약을 채널 API로 보내고, 재고 동기화를 받는 엔드포인트를 둔다 |
| `health` | 상태 확인, 지표 |

## 시뮬레이터의 경계

`simulator` 모듈은 같은 앱 안에 있지만 **외부 채널처럼** 동작한다. 데모를 위해 앱 하나로 묶었을 뿐, 경계는 실제 채널과 같게 지킨다.

- **주고받는 방식:** Restella와는 HTTP로만 주고받는다.
  - 예약과 취소는 채널 API(`/api/v1/channel/*`)로, 채널별 키로 서명해서 보낸다.
  - 남은 재고는 동기화 계약대로 받는다. 수신 주소는 `/internal/simulator/channels/{channelCode}/availability`이고 Ingress에 노출하지 않는다.
- **import 금지:** 다른 도메인 모듈(`inventory`, `reservation` 등)의 서비스나 리포지토리를 import하지 않는다. 설정과 공용 유틸만 쓴다. 구현할 때 린트 규칙으로 막는다.
- **수신 쪽 규칙:** 채널 쪽 규칙도 흉내 낸다. 이미 받은 `revision`보다 오래된 값은 무시한다.
- **장애 주입:** 재시도를 시연하려고 채널별로 실패율과 지연을 줄 수 있다. 예: OTA C는 30% 확률로 503을 응답한다. 지연(`delayMs`)을 3초 넘게 주면 시간 초과가 된다.
- **replicas 1:** 가짜 채널이 받은 값은 Pod 메모리에 있고, 시드가 채널 주소를 자기 자신(`SIMULATOR_TARGET_URL=http://localhost:3000`)으로 만든다. 그래서 배포는 replicas 1로 고정한다.

이렇게 두면 나중에 별도 앱으로 떼어내거나 실제 OTA 연결 코드로 바꿀 때 Restella 쪽 코드는 바뀌지 않는다.

## 테스트

Testcontainers로 운영과 같은 MariaDB 12.3.3을 띄우고, 앱을 실제 포트로 기동해 HTTP로 검증한다. 테스트 이름에는 요구사항의 완료 조건 ID를 붙인다([요구사항 추적표](../docs/4-testing/traceability.md)).

증명하는 불변식:

1. 아무리 동시에 요청해도 판매 수가 총 재고를 넘지 않는다 (AC-05-1·2).
2. 연박에서 일부 날짜만 잡히지 않는다 (AC-04-2).
3. 같은 요청을 N번 보내도, 동시에 보내도 예약은 1건이다 (AC-08-1·3).
4. 취소하면 재고가 정확히 원래대로 돌아온다 (AC-10-1).
5. 날짜가 겹치는 연박을 동시에 요청해도 교착이 없다 (AC-05-3).

| 종류 | 위치 | 개수 |
|---|---|---|
| 단위 (Vitest) | `src/**/*.spec.ts` | 20 |
| 통합·E2E (Vitest + Testcontainers) | `test/*.e2e-spec.ts` | 60 (8개 파일) |

결과와 커버리지는 [테스트 결과 보고서](../docs/4-testing/test-report.md)에 있다.

## 관측

- `/metrics`로 Prometheus 지표를 낸다(수집하는 Prometheus와 대시보드는 아직 배포하지 않았다).
  - `restella_reservations_total{result}`: 예약 확정·거절·충돌·중복 건수
  - `restella_sync_latency_seconds`: 채널 동기화 지연
  - `restella_sync_failures_total`: 동기화 실패
  - `restella_http_request_duration_seconds`: API 응답 시간
- `/health/live`, `/health/ready`(DB 연결)를 Kubernetes 프로브에 연결한다.
- `/metrics`와 `/health/*`는 Ingress에 노출하지 않는다.

## 실행

필요한 것: Docker. 코드를 고치며 실행하려면 Node.js 24 LTS, pnpm(`packageManager` 필드에 따라 12.10.1로 자동 전환)도 필요하다.

**Docker로 실행 (권장).** 저장소 루트의 `compose.yaml`이 MariaDB → 마이그레이션·시드 → back-end 순서로 띄운다.

```bash
cp .env.example .env                 # 저장소 루트. 값은 모두 로컬 예시
docker compose up -d --build --wait  # API: http://localhost:3100, 문서: /api/docs
docker compose logs -f back-end
```

| 서비스 | 하는 일 |
|---|---|
| `mariadb` | MariaDB 12.3.3 (utf8mb4, UTC). 데이터는 `restella_mariadb-data` 볼륨 |
| `back-end-migrate` | 마이그레이션과 시드를 한 번 실행하고 끝난다. 운영의 Argo CD Sync 훅 Job(wave 0)과 같은 역할이다 |
| `back-end` | API 서버. 마이그레이션이 성공해야 뜨고, `/health/ready`(DB 연결)로 상태를 본다 |

이미지는 [Dockerfile](Dockerfile)로 만든다. `node:24.21.0-trixie-slim` 위에 컴파일 결과와 실행용 의존성만 담고, root가 아닌 `node` 사용자로 실행한다. `.env`는 이미지에 들어가지 않는다(`.dockerignore`).

**호스트에서 실행 (개발용).** 코드를 고치며 돌릴 때 쓴다.

DB는 루트의 `compose.yaml`로 띄운다(로컬 전체 실행과 같은 DB).

```bash
cp .env.example .env                       # 저장소 루트. DB 접속 값 (로컬 예시)
docker compose up -d --wait mariadb        # 로컬 MariaDB 12.3.3 (utf8mb4, UTC)

cd back-end
pnpm install
cp .env.example .env          # 값은 모두 로컬 예시. DB 값은 루트 .env와 맞춘다. 운영 비밀값은 Secrets Manager에 있다
pnpm build
set -a && . ./.env && set +a
pnpm migration:run            # 마이그레이션
pnpm seed                     # 데모 데이터 (객실타입 3, 채널 5, 90일치 재고, 데모 운영자)
pnpm start:prod               # http://localhost:3000 (API 문서: /api/docs)
```

3000번 포트를 다른 앱이 쓰고 있으면 `.env`의 `PORT`와 `SIMULATOR_TARGET_URL`을 함께 바꾼다.

검사:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

구현 결과와 설계에서 바뀐 점은 [back-end 구현 노트](../docs/3-development/back-end.md)에 있다.
