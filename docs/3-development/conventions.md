# 코딩 규칙

## 공통

- **버전:** 호환성 → 최신 LTS → 최신 안정 순서로 고른다. 버전을 고정하고 lockfile을 커밋한다([기술 스택](../2-design/tech-stack.md)).
- **공개 저장소:** 비밀값, 계정 ID, 도메인, 개인정보를 커밋하지 않는다. 커밋 전 gitleaks 훅이 막는다([보안](../2-design/security.md)).
- **예시 데이터:** 누가 봐도 가짜인 값만 쓴다(`테스트 손님 1`, `OTA A`).
- **주석:** "왜"를 적는다. 근거가 되는 요구사항 ID(`REQ-xx`, `AC-xx-x`)나 ADR을 함께 적는다.

## back-end

- **모듈 형식:** ESM이다(`"type": "module"`, NodeNext). 상대 경로 import에는 `.js` 확장자를 붙인다.
- **스키마 변경:** 마이그레이션으로만 한다. 마이그레이션은 SQL을 직접 써서 CHECK 제약, 유일키, 인덱스를 정확히 통제한다. `synchronize`는 쓰지 않는다.
- **쓰기 트랜잭션:**
  - `READ COMMITTED` 격리 수준으로 열고, 교착에 대비해 `withLockRetry`로 감싼다.
  - 잠금 순서는 **예약 행 → 재고 행(날짜 오름차순)**으로 고정한다([ADR-0004](../adr/0004-reservation-consistency-and-sync.md)).
- **트랜잭션 안에서 할 일:** 재고를 바꾸면 같은 트랜잭션에서 채널 동기화 상태(`AvailabilitySyncWriter`)와 이벤트 로그를 함께 기록한다.
- **트랜잭션 밖(커밋 후)에서 할 일:** 실시간 알림(`RealtimeService`), 발송기 깨우기, 채널 취소 통지
- **날짜:** 숙박일은 `'YYYY-MM-DD'` 문자열로만 다룬다(`dateStrings: ['DATE']`). JS `Date`로 바꾸지 않는다(NFR-08).
- **응답 형식:** 성공은 응답 DTO 그대로(봉투 없음), 실패는 RFC 9457 `application/problem+json`이다([API 명세 "응답 형식"](../2-design/api.md#응답-형식)). 예외는 `problem('<유형>', detail)`로만 만들고, 유형은 `common/http/problems.ts`의 목록에서 고른다. Nest의 `XxxException`을 직접 던지지 않는다. 입력 오류는 `{ field, message }` 목록으로, 모든 응답에는 `X-Request-Id`가 붙는다.
- **DTO:**
  - 모듈마다 `dto/` 폴더에 `*.dto.ts`로 둔다. 요청 DTO는 한 파일에 하나, 응답 DTO는 리소스별로 한 파일에 모은다.
  - 이름 끝으로 쓰임새를 드러낸다. 요청 본문은 `*RequestDto`, 쿼리는 `*QueryDto`, 응답은 `*ResponseDto`다.
  - 요청 DTO는 class-validator로 검증한다.
  - 응답은 엔티티나 DB 행을 그대로 내보내지 않고 응답 DTO로 옮겨 담는다. 내부 컬럼이 API로 새지 않고, 응답 형태가 바뀌면 타입 검사에서 걸린다.
  - 컨트롤러 메서드는 반환 타입을 응답 DTO로 적고 `@ApiOkResponse` 등으로 Swagger에 연결한다. 문자열 유니언 타입은 `@ApiProperty({ enum })`로 값을 명시한다.
  - Swagger에서 뺀 내부 경로(가짜 채널 수신, 상태 확인)에는 응답 DTO를 두지 않는다.
- **인증:**
  - 운영자 API는 전역 가드(JWT)로 보호한다.
  - 다른 방식으로 보호하는 경로에만 `@Public()`을 붙인다. 채널 API(HMAC), 가짜 채널 수신(Restella 서명), 로그인, 상태 확인이 해당한다.
- **시뮬레이터 경계:**
  - `src/modules/simulator`(하위 `dto/` 포함)는 다른 도메인 모듈을 import하지 않는다. oxlint `no-restricted-imports`로 강제한다.
  - Restella와는 HTTP 계약으로만 주고받는다.
- **테스트:**
  - 순수 로직은 `src/**/*.spec.ts`(단위)에 둔다.
  - 요구사항 검증은 `test/*.e2e-spec.ts`(실제 MariaDB와 HTTP)에 둔다.
  - 테스트 이름에 완료 조건 ID를 붙인다.

## front-end

- **FSD 레이어:** 위 레이어는 아래 레이어만, 슬라이스는 `index.ts`(서버 전용은 `index.server.ts`)로만 가져온다. ESLint로 강제한다([front-end 설계](../../front-end/README.md#디렉토리-구조)).
- **화면 데이터는 서버에서 props로:** `_pages`의 서버 컴포넌트가 `serverFetch(endpoints.x, { params })`로 받아 위젯에 props로 넘긴다. 서버 쪽 코드는 TanStack Query를 쓰지 않는다.
- **API 분리:** 서버 요청은 `serverFetch`(→ back-end), 브라우저 요청은 컨트롤러에서 `clientFetch`(→ BFF)로 한다. 경로·메서드·요청(`Params` 쿼리, `Input` 본문)·응답(`Output`) 타입은 `shared/api/endpoints.ts` 한 파일에서만 정의하고, 타입은 생성된 API 타입을 연결한다. 호출하는 쪽에서 경로 문자열, 메서드, 응답 타입(`<T>`)을 직접 쓰지 않는다.
- **레이어:** `_app → _pages → widgets → shared`. `entities`와 `features`는 두지 않는다. 여러 위젯이 함께 쓰는 도메인 표시 부품(배지, 라벨, 이벤트 문장)은 `shared`에, 사용자 행동은 그것을 쓰는 위젯 안에 둔다. 두 곳 이상에서 쓰게 되면 그때 레이어로 뺀다.
- **UI와 로직 분리:** `ui/`는 그리기만 한다. 상태·변경 요청·화면 이동·표시용 계산은 같은 슬라이스의 `lib/use-*.controller.ts`가 맡는다.
- **갱신:** 변경이 끝나거나 실시간 알림이 오면 `router.refresh()`로 서버가 다시 그리게 한다. TanStack Query는 변경 요청과 대화상자처럼 브라우저에서만 생기는 조회에만 쓴다.
- **요청 시점 값:** 세션, searchParams는 `<Suspense>` 안에서만 읽는다. 현재 시각을 읽기 전에는 `connection()`을 부른다(Cache Components).
- **화면 상태는 URL에:** 기간·필터·탭·페이지·선택한 항목은 searchParams에 둔다.
- **시간 표시:** 서울 기준 절대 시각만 쓴다(`shared/lib/dates`). 상대 시각은 서버와 브라우저 결과가 달라 hydration 불일치가 난다.
- **비밀값:** 토큰은 세션 쿠키에만 둔다. `NEXT_PUBLIC_*`에는 비밀값을 넣지 않는다.

## 검사 명령

```bash
cd back-end
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build
```

```bash
cd front-end
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
