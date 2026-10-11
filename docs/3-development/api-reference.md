# API 목록

back-end에 구현된 엔드포인트 전체다. 코드의 라우트 선언과 대조해 작성했다.

- 설계(경계, 서명 방식, 응답 규칙, 오류 형식): [API 명세](../2-design/api.md)
- 요청·응답 스키마: Swagger `/api/docs`. 코드는 각 모듈의 `dto/` 폴더에 있다(요청 `*RequestDto`·`*QueryDto`, 응답 `*ResponseDto`)

**인증 표기**
- **HMAC:** 채널별 키 서명
- **JWT:** 운영자 토큰
- **Restella 서명:** Restella가 채널로 보낼 때 붙이는 서명
- **없음:** 인증 없음

## 채널 API: 채널 → Restella (HMAC, `api.<도메인>`으로 공개)

| 메서드 | 경로 | 설명 | 요구사항 |
|---|---|---|---|
| POST | `/api/v1/channel/reservations` | 예약 수신. 확정·충돌은 200, 확인형 매진 거절은 409, 같은 예약 재전송은 처음과 같은 응답(`Idempotent-Replayed: true`), 같은 번호의 다른 내용은 422 | REQ-04~09 |
| POST | `/api/v1/channel/reservations/{channelReservationNo}/cancel` | 채널 취소. 이미 취소된 예약도 200, 거절된 예약은 409, 없는 번호는 404 | REQ-10 |

## 운영자 API: front-end BFF → Restella (JWT, 비공개)

| 메서드 | 경로 | 설명 | 요구사항 |
|---|---|---|---|
| POST | `/api/v1/auth/login` | 로그인. 토큰 유효기간 8시간. 같은 IP에서 1분에 5회까지 (인증 없음) | REQ-18 |
| GET | `/api/v1/room-types` | 객실타입 목록 | REQ-02 |
| GET | `/api/v1/inventory?from=&to=` | 재고 달력. 객실타입 × 날짜, 최대 31일 | REQ-02 |
| PATCH | `/api/v1/inventory/{roomTypeId}/{stayDate}` | 총 재고 조정 `{ totalRooms, source? }`. 판매 수보다 작으면 409 | REQ-03 |
| GET | `/api/v1/reservations?channelId=&status=&from=&to=&cursor=&limit=` | 예약 목록 (최신순) | REQ-16 |
| GET | `/api/v1/reservations/{id}` | 예약 상세: 숙박일, 이력 | REQ-16 |
| POST | `/api/v1/reservations/{id}/cancel` | 운영자 취소. 재고 복원, 채널 동기화, 채널 취소 통지 | REQ-10 |
| GET | `/api/v1/conflicts?status=&limit=` | 충돌 처리함. 기본은 미처리(OPEN), 미처리 건수 포함 | REQ-13 |
| POST | `/api/v1/conflicts/{id}/cancel` | 충돌을 취소로 처리하고 채널에 통지 | REQ-14 |
| POST | `/api/v1/conflicts/{id}/resolve` | 해결됨 처리 `{ note }` (메모 필수) | REQ-14 |
| POST | `/api/v1/conflicts/{id}/move` | 다른 객실타입으로 옮기기 `{ roomTypeId }` | REQ-15 |
| GET | `/api/v1/events?type=&cursor=&limit=` | 이벤트 로그 (최신순, 유형은 쉼표로 여러 개) | REQ-17 |
| GET | `/api/v1/events/stream` | SSE 실시간 알림: `conflict.created`, `reservation.changed`, `inventory.changed`, `sync.changed`, 15초마다 `heartbeat` | REQ-13 |
| GET | `/api/v1/channels` | 채널 목록과 유형(확인형, 통보형) | REQ-20 |
| GET | `/api/v1/channels/availability?roomTypeId=&from=&to=` | 채널별로 마지막에 보낸 남은 재고·시각, 재시도 상태 | REQ-20 |
| POST | `/api/v1/simulations` | 동시 예약 시뮬레이션 실행 (동기, 50건 기준 10초 이내) | REQ-19 |
| GET | `/api/v1/simulations?limit=` | 실행 기록 목록 | REQ-19 |
| GET | `/api/v1/simulations/{id}` | 실행 기록 상세 | REQ-19 |
| GET | `/api/v1/simulations/faults` | 가짜 채널 장애 주입 설정 조회 | REQ-12 시연 |
| PUT | `/api/v1/simulations/faults` | 장애 주입 설정 `{ faults: { OTA_C: { failureRate, delayMs } } }` | REQ-12 시연 |
| DELETE | `/api/v1/simulations/channels-state` | 가짜 채널이 받은 값 초기화 | 데모·테스트 |

## 내부 경로 (Ingress 비공개)

| 메서드 | 경로 | 호출자 | 인증 | 설명 |
|---|---|---|---|---|
| POST | `/internal/simulator/channels/{code}/availability` | Restella 동기화 발송기 | Restella 서명 | 가짜 채널의 재고 동기화 수신. 오래된 revision은 무시 |
| POST | `/internal/simulator/channels/{code}/cancellations` | Restella | Restella 서명 | 가짜 채널의 취소 통지 수신 |
| GET | `/internal/simulator/channels` | 테스트·디버깅 | 없음 | 가짜 채널이 받은 상태 |
| GET | `/health/live` | Kubernetes | 없음 | 생존 확인 |
| GET | `/health/ready` | Kubernetes | 없음 | 준비 확인 (DB 연결) |
| GET | `/metrics` | Prometheus | 없음 | Prometheus 지표 |
| GET | `/api/docs`, `/api/docs-json` | 심사자 | 없음 | Swagger 문서 (`api.<도메인>`으로 공개) |

## 유지 규칙

엔드포인트를 추가·변경·삭제하면 이 문서와 [API 명세](../2-design/api.md), [요구사항 추적표](../4-testing/traceability.md)를 함께 고친다.
