# API 명세

[요구사항](../1-planning/requirements.md)을 HTTP API로 옮긴 설계다. 구현할 때 NestJS Swagger가 OpenAPI 명세를 자동으로 만들고, 그 명세가 구현의 기준이 된다. 이 문서는 그 전에 합의할 경계, 규칙, 엔드포인트 목록을 정한다. 엔드포인트마다 근거 요구사항 ID를 적는다.

## API 구분과 노출 범위

| 구분 | 경로 | 호출자 | 인증 | 외부 노출 |
|---|---|---|---|---|
| 채널 API | `/api/v1/channel/*` | 채널(데모에서는 시뮬레이터) | 채널별 HMAC 서명 | `api.<도메인>`으로 공개 |
| 운영자 API | `/api/v1/*` (채널 API 제외) | front-end BFF만 | 운영자 토큰(JWT) | **비공개.** 클러스터 안에서만 접근한다 |
| API 문서 | `/api/docs`, `/api/docs-json` | 심사자 | 없음 | `api.<도메인>`으로 공개 |
| 상태 확인·지표 | `/health/*`, `/metrics` | Kubernetes 프로브 (지표 수집기는 아직 배포하지 않음) | 없음 | **비공개** |
| 시뮬레이터 수신 | `/internal/simulator/*` | Restella 동기화 발송기 | Restella HMAC 서명 (POST만. 상태 조회 `GET`은 서명 없음, 테스트·디버깅용) | **비공개** |

운영자 API는 Ingress에 노출하지 않는다. 그래도 JWT 검사는 그대로 한다. 네트워크 경계와 인증을 겹쳐 두는 것이다.

## 공통 규칙

- **버전:** 경로에 `/v1`을 넣는다.
- **날짜:** 숙박일은 `YYYY-MM-DD`이고 `Asia/Seoul` 기준이다(NFR-08). 시각은 ISO 8601 UTC(`2026-10-09T12:00:00.000Z`)다.
- **입력 검증:** 모든 요청 본문과 쿼리는 검증한 뒤 처리한다(NFR-03). 모르는 필드가 오면 거절한다.

## 응답 형식

성공 여부는 HTTP 상태로만 판단한다. 성공 응답을 `{ success, data }` 같은 봉투로 감싸지 않는다. 채널 API는 외부 채널과의 계약이라 형식을 바꾸지 않고, 운영자 API도 같은 규칙을 따른다.

| 응답 | 형식 |
|---|---|
| 단건 | 응답 DTO 그대로 (예: `{ "reservationId": 101, "result": "CONFIRMED" }`) |
| 페이지가 있는 목록 | `{ "items": [...], "nextCursor": "120" }`. `?cursor=&limit=`로 요청하고, `limit` 기본값은 50, 최대는 200이다. 마지막 페이지면 `nextCursor`가 `null` |
| 작은 고정 목록 | 배열 (객실타입, 채널) |
| 본문 없음 | 204 |
| 실패 | [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `application/problem+json` |

**모든 응답에 `X-Request-Id` 헤더가 붙는다.** 앞단(BFF)이 형식에 맞는 값(영문·숫자·`._-` 8~64자)을 보내면 이어 쓰고, 아니면 back-end가 새로 만든다. 오류 본문의 `requestId`와 같은 값이라, 오류가 나면 이 값으로 back-end 로그(`kubectl logs`)를 찾는다.

```json
{
  "type": "urn:restella:problem:validation",
  "title": "입력값이 올바르지 않다",
  "status": 400,
  "detail": "checkOut은 checkIn보다 뒤여야 한다",
  "instance": "/api/v1/inventory/3/2026-10-10",
  "requestId": "b200c71a-5cc0-40c4-ae1a-3545aded7c74",
  "errors": [{ "field": "totalRooms", "message": "totalRooms must be an integer number" }]
}
```

| 필드 | 뜻 |
|---|---|
| `type` | 오류 유형 `urn:restella:problem:<유형>`. **클라이언트는 문구가 아니라 이 값으로 분기한다** |
| `title` | 유형마다 정해진 짧은 설명 |
| `detail` | 이번 요청에 대한 구체적인 설명 (없을 수 있음) |
| `instance` | 요청 경로 |
| `requestId` | `X-Request-Id`와 같은 값 |
| `errors` | 입력 오류일 때 `{ field, message }` 목록. 중첩 필드는 점으로 잇는다 (예: `faults.OTA_C`) |

### 오류 유형

유형 목록은 `back-end/src/common/http/problems.ts` 한 파일에서 관리하고, 예외는 이 목록으로만 만든다. 유형을 추가·변경하면 이 표도 함께 고친다.

| 유형 | HTTP | 언제 |
|---|---|---|
| `validation` | 400 | 입력값 오류 (형식, 범위, 모르는 필드, 기간·숙박 수 제한) |
| `unknown-room-type` | 400 | 없는 객실타입 |
| `same-room-type` | 400 | 충돌을 같은 객실타입으로 옮기려 함 |
| `unauthorized` | 401 | 운영자 토큰 없음·만료 |
| `invalid-credentials` | 401 | 로그인 실패 |
| `invalid-signature` | 401 | 채널 서명 오류, 알 수 없는 채널, Restella 서명 오류(가짜 채널 수신) |
| `stale-request` | 401 | 채널 요청 시각이 서버와 5분 넘게 차이 남 |
| `not-found` | 404 | 대상 없음 (없는 경로 포함) |
| `reservation-not-cancellable` | 409 | 거절된 예약을 취소하려 함 |
| `reservation-not-in-conflict` | 409 | 충돌 상태가 아닌 예약을 옮기려 함 |
| `conflict-already-handled` | 409 | 이미 처리된 충돌 |
| `insufficient-stock` | 409 | 옮길 객실타입에 숙박일 전체의 재고가 없음 |
| `total-below-sold` | 409 | 총 재고를 판매 수보다 작게 줄이려 함 |
| `reservation-mismatch` | 422 | 같은 채널 예약번호로 다른 내용이 옴 (예약 변경은 지원하지 않음) |
| `too-many-requests` | 429 | 로그인 시도 과다 |
| `internal` | 500 | 예상하지 못한 오류. 내용은 숨기고 `requestId`로 로그를 찾는다 |
| `upstream-failed` | 502 | 시뮬레이터가 부른 운영자 API 실패 |
| `service-unavailable` | 503 | 가짜 채널의 장애 주입 |

확인형 채널의 매진 거절(409)은 오류가 아니라 정상 결과라서 problem+json이 아니다. `{ "reservationId", "result": "REJECTED", "reason": "SOLD_OUT" }`로 응답한다.

## 채널 API (채널 → Restella)

### 요청 서명 (REQ-09)

| 헤더 | 값 |
|---|---|
| `X-Restella-Channel` | 채널 코드. 예: `OTA_A` |
| `X-Restella-Timestamp` | 요청 시각(유닉스 초) |
| `X-Restella-Signature` | `v1=` + hex(HMAC-SHA256(채널 비밀 키, `{timestamp}.{원본 본문}`)) |

- 서명이 맞지 않으면 401을 응답한다. 비교는 시간 차이로 정보가 새지 않는 상수 시간 비교로 한다.
- 시각이 서버와 5분 넘게 차이 나면 401을 응답한다. 재전송 공격을 막기 위해서다.
- 서명에 쓰인 키의 채널과 `X-Restella-Channel`이 다르면 401을 응답한다(AC-09-2).

### `POST /api/v1/channel/reservations`: 예약 수신 (REQ-04~08)

```json
{
  "channelReservationNo": "OTA-A-0001",
  "roomTypeCode": "DLX-DBL",
  "checkIn": "2026-10-10",
  "checkOut": "2026-10-12",
  "guestName": "테스트 손님 1"
}
```

| 상황 | HTTP | 본문 |
|---|---|---|
| 확정 | 200 | `{ "reservationId": 101, "result": "CONFIRMED" }` |
| 매진 + 통보형 채널 | 200 | `{ "reservationId": 102, "result": "CONFLICT" }`. 수신은 성공이다(AC-07-1) |
| 매진 + 확인형 채널 | 409 | `{ "reservationId": 103, "result": "REJECTED", "reason": "SOLD_OUT" }` |
| 같은 예약번호, 같은 내용 | 처음과 같음 | 처음과 같은 본문. 헤더 `Idempotent-Replayed: true`(AC-08-2) |
| 같은 예약번호, 다른 내용 | 422 | problem+json |
| 체크아웃 ≤ 체크인, 모르는 객실타입 | 400 | problem+json |

### `POST /api/v1/channel/reservations/{channelReservationNo}/cancel`: 채널 취소 (REQ-10)

- 200 `{ "reservationId": 101, "status": "CANCELLED" }`
- 이미 취소된 예약도 200을 응답하고 재고는 변하지 않는다(AC-10-2).
- 해당 채널에 그 예약번호가 없으면 404를 응답한다.

## 채널 동기화 (Restella → 채널) (REQ-11, 12)

Restella가 채널에 보내는 요청의 계약이다. 실제 OTA 대신 back-end 안의 `simulator` 모듈이 받는다. 데모의 수신 주소는 `/internal/simulator/channels/{channelCode}/availability`이고 Ingress에 노출하지 않는다.

`POST {채널 수신 주소}/availability`. 같은 방식으로 서명한다. 서명 키는 Restella의 키다.

```json
{
  "roomTypeCode": "DLX-DBL",
  "stayDate": "2026-10-10",
  "available": 0,
  "stopSell": true,
  "revision": 42
}
```

- 채널은 2xx로 응답해야 성공으로 기록된다. 그 밖의 응답이나 시간 초과(3초)는 실패로 보고 다시 보낸다. 간격은 점점 늘리고 최대 5회다.
- 채널은 이미 받은 `revision`보다 작은 값이 오면 무시한다(AC-12-3).

`POST {채널 수신 주소}/cancellations`는 운영자가 예약이나 충돌을 취소했을 때 채널에 보내는 통지다(AC-14-1).

```json
{ "channelReservationNo": "OTA-A-0001", "reason": "CANCELLED_BY_PROPERTY" }
```

한 번만 시도한다. 실패하면 취소 응답의 `channelNotified: false`와 이벤트 로그(`SYNC_FAILED`, `kind: cancellation`)에 남긴다.

## 운영자 API (front-end BFF → Restella)

모든 요청은 `Authorization: Bearer <JWT>`가 필요하다. 로그인만 예외다.

| 메서드와 경로 | 설명 | 요구사항 |
|---|---|---|
| `POST /api/v1/auth/login` | `{ loginId, password }`를 받아 `{ accessToken, expiresAt }`(8시간)을 돌려준다. 같은 IP에서 1분에 5회까지 시도할 수 있다 | REQ-18 |
| `GET /api/v1/room-types` | 객실타입 목록 | REQ-02 |
| `GET /api/v1/inventory?from=&to=` | 재고 달력. 객실타입 × 날짜마다 총 재고, 판매 수, 남은 재고. 기간은 최대 31일이다 | REQ-02 |
| `PATCH /api/v1/inventory/{roomTypeId}/{stayDate}` | `{ totalRooms, source? }`로 총 재고를 조정한다. 판매 수보다 작으면 409. `source`는 이벤트 로그에 남길 출처(예: `SIMULATOR:12`) | REQ-03 |
| `GET /api/v1/reservations?channelId=&status=&from=&to=` | 예약 목록 | REQ-16 |
| `GET /api/v1/reservations/{id}` | 예약 상세. 목록과 같이 `conflictStatus`(충돌 처리 상태, 없으면 `null`)를 준다 | REQ-16 |
| `POST /api/v1/reservations/{id}/cancel` | 운영자 취소 | REQ-10 |
| `GET /api/v1/conflicts?status=OPEN` | 충돌 처리함 | REQ-13 |
| `POST /api/v1/conflicts/{id}/cancel` | 충돌을 취소로 처리하고 채널에 전달 | REQ-14 |
| `POST /api/v1/conflicts/{id}/resolve` | `{ note }`(필수)로 해결됨 처리 | REQ-14 |
| `POST /api/v1/conflicts/{id}/move` | `{ roomTypeId }`로 다른 객실타입으로 옮긴다 | REQ-15 (Could) |
| `GET /api/v1/events?type=&cursor=&limit=` | 이벤트 로그 (최신순, 유형은 쉼표로 여러 개) | REQ-17 |
| `GET /api/v1/events/stream` | SSE. 바뀐 대상만 알린다: `conflict.created`, `reservation.changed`, `inventory.changed`, `sync.changed`, 15초마다 `heartbeat` | REQ-13 |
| `GET /api/v1/channels` | 채널 목록과 유형(확인형, 통보형) | REQ-20 |
| `GET /api/v1/channels/availability?roomTypeId=&from=&to=` | 채널별로 마지막에 보낸 남은 재고와 시각 | REQ-20 |
| `POST /api/v1/simulations` | 동시 예약 시뮬레이션 실행. 아래 참고 | REQ-19 |
| `GET /api/v1/simulations`, `GET /api/v1/simulations/{id}` | 실행 기록 | REQ-19 |
| `GET·PUT /api/v1/simulations/faults` | 가짜 채널 장애 주입 설정. 예: `{ "faults": { "OTA_C": { "failureRate": 0.3 } } }` | REQ-12 시연 |
| `DELETE /api/v1/simulations/channels-state` | 가짜 채널이 받은 값 초기화 | 데모·테스트 |

### `POST /api/v1/simulations` (REQ-19)

```json
{
  "roomTypeId": 1,
  "checkIn": "2026-10-10",
  "checkOut": "2026-10-11",
  "prepareRemaining": 1,
  "requestCount": 50,
  "notifyRatio": 40,
  "duplicateRatio": 10
}
```

| 필드 | 설명 |
|---|---|
| `prepareRemaining` | 선택. 실행 전에 해당 숙박일의 남은 재고를 이 값으로 맞춘다. 총 재고를 조정하며, 이벤트 로그에는 실행한 운영자가 한 것으로 남고 `detail.source`에 `SIMULATOR:<실행 ID>`가 붙는다 |
| `requestCount` | 보낼 예약 수(1~100) |
| `notifyRatio` | 통보형 채널이 보내는 비율(%). 나머지는 확인형 채널이 보낸다 |
| `duplicateRatio` | 같은 예약을 한 번 더 보내는 비율(%, 0~50). 중복 처리를 보여준다 |

- 시뮬레이터는 **실제 채널 API**(`/api/v1/channel/reservations`)로 서명된 요청을 동시에 보낸다. 내부 함수를 직접 부르지 않는다.
- 응답(201)에는 확정, 거절, 충돌, 중복 건수와 실행 후 "판매 수 ≤ 총 재고" 검증 결과가 들어 있다.
- 10초 안에 끝나도록 동기로 처리한다(NFR-02).

## front-end BFF 경로

브라우저는 front-end(Next.js)의 경로만 호출한다. BFF가 세션의 토큰을 붙여 운영자 API로 중계한다([front-end 설계](../../front-end/README.md)).

| BFF 경로 | 하는 일 |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout` | 로그인하면 토큰을 iron-session 쿠키에 저장하고, 로그아웃하면 세션을 지운다 |
| `/api/bff/*` | 운영자 API `/api/v1/*`로 중계한다 |
| `GET /api/bff/events/stream` | SSE 스트림을 그대로 중계한다 |
