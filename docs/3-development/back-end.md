# back-end 구현 노트

## 결과

- **구현한 요구사항:** 설계한 back-end 요구사항 20개를 모두 API로 구현했다. Could인 REQ-15(다른 객실타입으로 옮기기)도 포함한다.
- **모듈 9개:** auth, room-type, inventory, reservation, channel, conflict, event-log, simulator, health
- **테스트:** 단위 20개, E2E 60개, E2E 라인 커버리지 94.7%다(2026-10-11 재실행 기준)([테스트 결과](../4-testing/test-report.md)).
- **빌드 결과물 검증:** 빌드 → 마이그레이션 → 시드 → 기동 → 시뮬레이션까지 확인했다.

## 설계에서 바뀐 점과 이유

| 항목 | 설계 | 구현 | 이유 |
|---|---|---|---|
| 처음 처리 결과 | `status` 하나 | `initial_result` 컬럼 추가 | 같은 요청이 다시 오면 **처음** 결과를 돌려줘야 한다(AC-08-2). 그런데 `status`는 이후 취소 등으로 바뀐다 |
| 채널 수신 주소 | `availability_url` 하나 | `endpoint_url`(기본 주소) 아래 `/availability`, `/cancellations` | 충돌을 취소로 처리하면 채널에 취소를 알려야 한다(AC-14-1). 재고 동기화와 다른 수신 경로가 필요하다 |
| ID 타입 | BIGINT | INT UNSIGNED (revision만 BIGINT) | TypeORM의 자동 증가 기본키에는 값 변환기를 붙일 수 없어, BIGINT가 문자열로 돌아온다. 이 규모에서는 INT 범위(약 42억)로 충분하다 |
| 교착 대비 | 잠금 순서 고정만 | 잠금 순서 고정 + 교착·대기 시간 초과 시 최대 3회 재시도 | E2E 테스트에서 실제 교착을 관찰했다(먼저 INSERT한 트랜잭션이 롤백되는 경우). [테스트 결과](../4-testing/test-report.md) #2 |
| 재고 조정 출처 | 시뮬레이터가 이벤트 주체 | 주체는 실행한 운영자, `detail.source = "SIMULATOR:<id>"` | 시뮬레이터는 실행한 운영자의 토큰으로 운영자 API를 부른다. 시뮬레이터 경계 원칙에 따라 내부 코드를 직접 부르지 않으므로, 실제로 조정한 사람은 운영자다 |
| 가짜 채널 상태 초기화 | 없음 | `DELETE /api/v1/simulations/channels-state` | 테스트 격리와 데모 초기화에 필요하다 |
| 장애 주입 설정 | 환경변수 | 환경변수 + `PUT /api/v1/simulations/faults` | 데모와 테스트에서 재시도를 실행 중에 보여주기 위해서다 |

## 구현하며 정한 것

- **채널 동기화 이벤트:** 성공은 (객실타입, 숙박일, revision) 단위로 묶어 한 건으로 기록한다. 채널마다 남기면 이벤트 로그가 넘친다. 실패는 시도마다 기록한다.
- **채널 취소 통지:** 한 번만 시도한다. 실패하면 응답의 `channelNotified: false`와 이벤트 로그에 남긴다. 재시도는 범위 밖이다.
- **로그인:** 없는 아이디도 같은 시간이 걸리도록 실행할 때마다 새로 만든 더미 argon2 해시로 검증한다. 응답 시간으로 아이디 존재 여부를 알 수 없게 하려는 것이다.
- **한 예약의 최대 숙박:** 30박이다.
- **응답 형식:** 운영자 API와 채널 API의 응답을 모두 응답 DTO로 정의하고 Swagger에 연결했다. 이때 응답이 두 군데 바뀌었다.
  - 객실타입 목록에서 내부 컬럼(`createdAt`, `updatedAt`)을 뺐다.
  - 시뮬레이션 실행 응답을 목록·상세 조회와 같은 형태로 맞췄다. `startedAt`, `finishedAt`이 생겼고, 준비값을 주지 않으면 `prepareRemaining`이 `null`이다.
- **응답 형식 보강:** 오류 유형 목록(`common/http/problems.ts`)을 만들고 모든 예외를 이 목록으로 바꿨다. 입력 오류는 설계에 적어 둔 `{ field, message }` 형식으로 내보낸다(그전에는 메시지만 있었다). 모든 응답에 `X-Request-Id`를 붙인다. 채널 서명 오류의 유형이 `unauthorized`에서 `invalid-signature`로 구체화됐다.
- **목록 쿼리의 기본값:** `limit = 50`처럼 타입 없이 기본값만 쓰면 Swagger에 `limit`이 필수 `Object`로 나온다. front-end가 생성 타입을 쿼리 타입으로 쓰면서 발견했다. `@ApiPropertyOptional({ type: Number, default })`를 붙였다(목록 4개, 충돌 상태 포함).

## 개발 환경에서 정한 것

- **테스트 도구:** NestJS 12 CLI가 실제로 만든 템플릿은 ESM과 **Vitest**다. 기술 스택 문서에 적었던 "Jest(Nest 기본)"는 GitHub 저장소의 템플릿 파일을 보고 쓴 것이라 틀렸고, 고쳤다.
- **Vitest:** 템플릿의 4가 아니라 최신 5.0.3을 쓴다. NestJS 의존성 주입에 필요한 데코레이터 메타데이터가 Vitest 5(Vite 8의 Oxc 변환기)에서 동작하는지 먼저 확인했다. Vite 8이 tsconfig 경로를 기본 지원해서 `vite-tsconfig-paths`는 뺐다.
- **`@types/node`:** 최신은 26이지만 런타임인 Node 24 LTS에 맞춰 24.19.1을 쓴다(호환 우선).
- **pnpm 12:** `packageManager` 필드로 고정한다. 설치 스크립트 실행은 꼭 필요한 것만 허용한다(`pnpm-workspace.yaml`의 `allowBuilds`).
  - `argon2`: 허용. 미리 빌드된 바이너리를 확인만 한다.
  - `@scarf/scarf`: 거부. 설치 시 사용 통계를 외부로 보낸다.
  - `cpu-features`, `ssh2`, `protobufjs`: 거부. 필요 없다.
- **Swagger 플러그인:** 기본 설정(`*.dto.ts`, `*.entity.ts` 분석)을 쓴다. 처음에는 DTO를 컨트롤러 파일 안에 두고 분석 대상을 넓혔다. 이후 NestJS 관례대로 `dto/` 폴더로 분리하면서 기본값으로 되돌렸다([AI 활용 기록 #5](../ai-log.md#5-dto-위치와-응답-dto-누락-p2)).
- **`.env` 값:** JSON 값은 작은따옴표로 감싼다. 셸이 `.env`를 읽을 때 따옴표가 사라지지 않게 하려는 것이다.

## 남은 일

- Dockerfile(arm64)과 CI(GitHub Actions → ECR → gitops)는 infra 단계에서 작성한다.
- 코드 리뷰(`/code-review`)를 하고 [코드 리뷰 기록](code-review.md)을 남긴다.
