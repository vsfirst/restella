# front-end

Restella의 **운영자 콘솔**이다. 화면과 함께 BFF(Backend for Frontend) 역할을 맡는다. 운영자의 로그인 토큰을 서버 쪽에 보관하고, 브라우저 대신 back-end API를 호출한다.

- 기술: Next.js(App Router), iron-session, TanStack Query, Tailwind CSS, FSD
- 버전: [기술 스택](../docs/2-design/tech-stack.md)
- 시스템 전체에서의 위치: [README](../README.md#시스템-구성), [아키텍처](../docs/2-design/architecture.md)

## 역할과 경계

```
브라우저 ──▶ Next.js (화면 + BFF) ──▶ back-end API
            └ iron-session 암호화 쿠키에 토큰 보관
```

- 브라우저는 back-end를 직접 호출하지 않는다. 모든 API 요청은 Next.js Route Handler(BFF)를 거친다.
- back-end가 발급한 토큰은 iron-session 암호화 쿠키에만 있다. 브라우저 JavaScript는 토큰을 읽을 수 없다.
- `NEXT_PUBLIC_*` 환경변수는 브라우저 번들에 그대로 들어가므로 비밀값을 넣지 않는다([보안](../docs/2-design/security.md)).

## 화면

| 경로 | 화면 | 내용 |
|---|---|---|
| `/login` | S-01 로그인 | 운영자 로그인 |
| `/inventory` | S-02 재고 달력 | 객실타입 × 날짜별 남은 재고. 매진은 색으로 구분하고, 칸을 누르면 총 재고를 조정한다(S-02a) |
| `/reservations` | S-03 예약 목록 | 채널·상태·숙박 기간 필터. 행을 누르면 상세·이력·취소(S-03a, `?id=`) |
| `/conflicts` | S-04 충돌 처리함 | 오버부킹 충돌 목록과 처리(옮기기, 해결됨, 취소) |
| `/events` | S-05 이벤트 로그 | 예약, 충돌, 재고, 채널 동기화 기록 |
| `/simulator` | S-06 시뮬레이터 | 남은 1실에 여러 채널이 동시에 예약하는 상황을 실행하고 결과를 본다 |
| `/channels` | S-07 채널별 재고 | 원장과 각 채널이 받은 남은 재고 비교, 장애 주입 |

화면 흐름, 화면별 요구사항, 시연 시나리오, HTML 목업은 [화면 설계](../docs/2-design/ui/README.md)에 있다. 구현할 때는 목업의 마크업과 Tailwind 클래스를 출발점으로 쓴다.

## 인증 흐름

1. 로그인 폼을 BFF(`POST /api/auth/login`)에 제출한다. BFF가 back-end 로그인 API를 호출해 토큰을 받는다.
   - 폼은 `method="post"`다. JavaScript가 실행되기 전에 제출돼도 비밀번호가 URL에 실리지 않고, BFF가 303으로 이동시킨다.
2. BFF는 토큰을 iron-session 쿠키(httpOnly, 암호화)에 저장한다. 토큰은 응답 본문으로도 내보내지 않는다.
3. 페이지 접근은 `proxy.ts`가 쿠키를 풀어 만료만 빠르게 검사한다. Next.js 16부터 `middleware`가 `proxy`로 이름이 바뀌었다.
4. 서버 렌더링과 BFF Route Handler 안에서도 세션을 다시 검사한다. `proxy.ts`의 matcher가 바뀌면 보호가 조용히 빠질 수 있기 때문이다.
5. back-end가 토큰을 거절하면(401) BFF가 세션을 지우고, 화면은 로그인으로 이동한다.

**알려진 제약:** back-end의 로그인 시도 제한(1분 5회)은 IP 기준이다. 로그인이 BFF를 거치므로 모든 운영자가 front-end 서버 IP 하나를 함께 쓴다. 운영자 한 명인 데모에서는 문제가 없지만, 여러 명이 쓰려면 BFF가 원래 IP를 전달하고 back-end가 그 값을 믿도록 바꿔야 한다.

## 디렉토리 구조

[FSD 공식 Next.js 가이드](https://feature-sliced.design/docs/guides/tech/with-nextjs)를 따른다.

```
front-end/
├── app/                # Next.js App Router. 라우팅만 맡고 src/_pages의 화면을 re-export
│   └── api/            # Route Handler 진입점. 로직은 src/_app/api-routes에서 re-export
├── proxy.ts            # 세션 검사·페이지 보호. app/과 같은 위치에 둔다
├── public/
└── src/                # FSD 레이어
    ├── _app/           # 앱 전역 설정
    │   ├── api-routes/ # BFF 로직 (로그인·로그아웃, /api/bff 중계)
    │   ├── layouts/    # 루트 레이아웃, 콘솔 틀
    │   └── providers/  # TanStack Query, 실시간(SSE) 갱신
    ├── _pages/
    ├── widgets/
    └── shared/         # api · config · lib · ui
        └── api/        # endpoints(경로) · client(브라우저 → BFF) · server(서버 → back-end) · types · session
```

| 레이어 | 담을 것 |
|---|---|
| `_app` | 프로바이더(TanStack Query, 실시간 갱신), 전역 스타일, 레이아웃, BFF 로직 |
| `_pages` | 화면 단위 조합. 서버에서 화면 데이터를 받아 위젯에 props로 넘긴다 |
| `widgets` | 독립적인 큰 UI 블록과 그 안의 사용자 행동: 콘솔 상단(로그아웃), 재고 달력(총 재고 조정), 예약 표(예약 취소), 충돌 처리함(옮기기·해결됨·취소), 충돌 알림 토스트, 이벤트 표, 시뮬레이터(실행), 채널별 재고(장애 주입) |
| `shared` | 여러 레이어가 함께 쓰는 코드: API 경로·fetch(브라우저용·서버용)·타입·세션, 설정, 날짜와 도메인 표시 로직(라벨, 이벤트 문장, 재고 판정), 기본 UI와 도메인 배지 |

**`entities` 레이어는 두지 않는다.** 처음에는 엔티티 7개를 두었지만, API 경로를 `shared/api/endpoints.ts`로 모으고 화면 데이터를 서버가 props로 넘기게 바꾸자 엔티티 대부분이 한 줄짜리 요청 함수와 타입 별칭이 됐다. 실제 도메인 코드는 여러 위젯이 함께 쓰는 배지·문장 변환·재고 판정 몇 개뿐이라, 이것을 `shared`로 옮기고 레이어를 없앴다. 그래서 이 저장소의 `shared`는 도메인을 안다. FSD도 `entities`와 `features`는 필요할 때만 두는 선택 레이어로 본다.

**`features` 레이어도 두지 않는다.** 사용자 행동 6개(로그인·로그아웃, 총 재고 조정, 예약 취소, 충돌 처리, 시뮬레이션 실행, 장애 주입)가 모두 위젯 하나나 화면 하나에서만 쓰였다. 그래서 각 행동은 그것을 쓰는 위젯(로그인 폼은 로그인 화면) 안에 둔다. 같은 행동을 두 곳 이상에서 쓰게 되면 그때 `features`로 뺀다.

**슬라이스 안의 세그먼트**

| 세그먼트 | 담을 것 |
|---|---|
| `ui/` | 그리기만 한다. props와 컨트롤러가 준 값으로 마크업을 만든다 |
| `lib/use-*.controller.ts` | 그 UI의 로직: 화면 상태, 변경 요청(useMutation), 화면 이동, 표시용 계산. 서버 컴포넌트(`_pages`)의 searchParams 해석은 `lib/`의 순수 함수로 둔다 |
| `api/` | BFF 자체 경로 요청(로그인은 `_pages/login`, 로그아웃은 `widgets/console-header`)처럼 슬라이스에만 필요한 요청 |

iron-session 설정은 `_app`이 아니라 `shared/api`(서버 전용)에 둔다. 화면(`_pages`)이 서버 렌더링에서 세션의 토큰으로 back-end를 불러야 하는데, FSD에서는 아래 레이어가 `_app`을 import할 수 없기 때문이다.

**규칙**
- 위 레이어는 아래 레이어만 import한다. 같은 레이어의 다른 슬라이스는 import하지 않는다. 두 규칙 모두 ESLint(`import/no-restricted-paths`, `no-restricted-imports`)로 막는다.
- FSD의 `app`·`pages` 레이어는 Next.js 라우터와 이름이 겹치지 않도록 `_app`·`_pages`로 둔다.
- 각 슬라이스는 `index.ts`로만 외부에 공개한다. 서버 전용 코드는 `index.server.ts`로 분리해서 클라이언트 번들에 섞이지 않게 한다.

## 데이터 흐름

**화면 데이터는 서버가 받아 props로 그린다.** 화면을 열 때 필요한 데이터는 서버가 back-end에서 받아 위젯에 props로 넘긴다. 브라우저는 빈 화면이나 로딩 표시 없이 바로 데이터를 보고, 화면 데이터에는 TanStack Query를 쓰지 않는다.

```
요청 ─▶ proxy.ts (세션 쿠키 확인)
     ─▶ _pages: <Suspense> 안에서 세션·searchParams를 읽고 serverFetch(endpoints.x())로 back-end 호출
     ─▶ widgets: props를 그대로 그림 (UI 상태는 lib/use-*.controller.ts)
```

- **API는 브라우저용과 서버용으로 나눈다.** 둘 다 fetch만 쓴다.
  - `shared/api/server.ts`의 `serverFetch`: 서버 → back-end. 세션의 토큰을 붙인다(서버 전용). `_pages`가 부른다.
  - `shared/api/client.ts`의 `clientFetch`: 브라우저 → BFF(`/api/bff`). 토큰은 BFF가 붙인다. 위젯의 컨트롤러가 부른다.
  - 경로는 [`shared/api/endpoints.ts`](src/shared/api/endpoints.ts) 한 파일에서 관리한다. 엔드포인트마다 메서드, 경로, 요청·응답 타입을 함께 둔다. 경로를 추가·변경하면 이 파일과 [API 목록](../docs/3-development/api-reference.md)을 함께 고친다.

    ```ts
    conflictResolve: {
      method: 'POST',
      path: (id: number) => `/conflicts/${id}/resolve`,   // 경로 변수만
      dto: dto<{ Input: ResolveConflictRequestDto; Output: ConflictResolved }>(),
    },
    ```

    | 이름 | 뜻 |
    |---|---|
    | `Params` | 쿼리 문자열로 보내는 값. fetch 함수가 경로 뒤에 붙인다 |
    | `Input` | POST·PUT·PATCH 요청 본문 |
    | `Output` | 응답 |

    타입은 back-end Swagger에서 생성한 타입을 연결하고 손으로 다시 쓰지 않는다. 호출하는 쪽은 `clientFetch(endpoints.conflictResolve, { path: [id], input: { note } })`처럼 경로 변수·쿼리·본문만 넘기며, 메서드와 응답 타입은 정의에서 정해진다. 본문을 빠뜨리거나 경로 변수·상태값을 틀리면 타입 검사에서 걸린다.
  - BFF 접두사(`BFF_PREFIX`)와 BFF 자체 인증 경로(`authRoutes`)도 같은 파일에 있다.
  - 화면 props에 쓰는 응답 타입의 짧은 이름은 `shared/api/types.ts`에 있다.
  - 실패는 `ApiError`로 받는다. 분기는 문구가 아니라 `type`(오류 유형)으로 하고, 입력칸 오류는 `fieldError(field)`로 꺼낸다. 서버 오류 문구에는 요청 ID를 붙여 로그를 찾을 수 있게 한다. BFF는 back-end의 `X-Request-Id`를 브라우저에 그대로 넘기고, BFF가 직접 만드는 오류도 같은 형식을 쓴다.
- **화면 상태는 URL에:** 기간, 필터, 탭, 페이지(`?cursor=`), 선택한 예약(`?id=`)은 searchParams에 둔다. 바꾸면 서버가 그 조건으로 다시 받아 그리므로, 새로고침하거나 링크를 공유해도 같은 화면이 나온다.
- **변경 뒤와 실시간 갱신은 `router.refresh()`:** 총 재고 조정, 예약 취소, 충돌 처리, 시뮬레이션 실행이 끝나면 서버가 현재 화면을 다시 그린다. 오버부킹 충돌은 생기는 즉시 화면에 보여야 한다([문제 정의](../docs/1-planning/problem.md#목표)의 목표 3). back-end의 SSE 스트림을 BFF(`/api/bff/events/stream`)가 중계하고, 이벤트가 오면 0.3초씩 모아 한 번 다시 그린다. SSE가 끊기면 10초 간격으로 다시 그린다([ADR-0004](../docs/adr/0004-reservation-consistency-and-sync.md)).
- **TanStack Query는 브라우저에서만 생기는 요청에 쓴다:** 변경 요청(`useMutation`)과, 대화상자를 연 뒤에 필요한 조회(충돌 옮기기의 숙박일 재고)다.
- **Cache Components:** Next.js 16.4 기본 설정(`cacheComponents`, `partialPrefetching`)을 쓴다. 세션과 searchParams는 요청 시점 값이라 `<Suspense>` 안에서만 읽고, 현재 시각을 읽기 전에는 `connection()`을 부른다. 정적인 틀은 미리 렌더링되고 데이터 부분만 요청마다 스트리밍된다.
- **API 타입:** back-end Swagger 명세에서 생성한다(`pnpm gen:api` → `src/shared/api/generated`). back-end 응답 DTO가 바뀌면 다시 생성하고 타입 검사로 영향을 찾는다.

## 테스트

| 종류 | 위치 | 내용 |
|---|---|---|
| 단위 | `src/**/*.test.ts` (Vitest) | 날짜 계산(서울 기준), 이벤트 문장, 재고 판정, searchParams 해석, 로그인 뒤 이동 경로 검증 |
| E2E | `e2e/` (Playwright) | "마지막 1실" 시연 시나리오 전체: 로그인 → 시뮬레이션 → 충돌 알림 → 처리 → 재고·채널·이벤트 확인 → 로그아웃 |

E2E는 실제 back-end와 front-end를 띄운 상태에서 돈다. 로그인 시도 제한(1분 5회) 때문에 연달아 여러 번 돌리면 1분을 기다려야 한다.

## 정한 것

설계 단계에서 "결정 대기"로 남겼던 항목이다.

| 항목 | 결정 | 이유 |
|---|---|---|
| API 타입 생성 | `@hey-api/openapi-ts` (타입만 생성) | 후보였던 openapi-typescript 7.13은 TypeScript 5만 지원한다. 이 저장소는 TypeScript 6을 쓴다(호환 우선) |
| 입력 검증 라이브러리 | 쓰지 않음 | 입력은 로그인, 총 재고, 메모, 시뮬레이션 조건뿐이다. HTML 입력 제약으로 1차 검증하고 최종 검증은 back-end가 한다 |
| UI 부품 | 쓰지 않음 | 표가 단순하다(정렬·가상 스크롤 없음). 목업의 Tailwind 마크업을 그대로 옮겼다 |

## 환경변수

`.env.local`에 둔다(커밋하지 않음, 예시는 [.env.example](.env.example)). 서버(BFF·서버 렌더링)에서만 읽고 브라우저로 나가지 않는다.

| 변수 | 값 | 설명 |
|---|---|---|
| `APP_ENV` | `local`, `demo`, `prod` | 실행 환경. 값이 없거나 다르면 시작하지 않는다 |
| `BACKEND_URL` | 예: `http://localhost:3100` | `APP_ENV=local`일 때만 쓴다 |
| `SESSION_SECRET` | 32자 이상 | iron-session 쿠키 암호화 키 |

**back-end 주소는 `APP_ENV`로 정한다** ([env.server.ts](src/shared/config/env.server.ts)).

| `APP_ENV` | back-end 주소 | 세션 쿠키 |
|---|---|---|
| `local` | `BACKEND_URL` (호스트 실행은 `http://localhost:3100`, Docker compose는 `http://back-end:3000`) | HTTP 허용 |
| `demo`, `prod` | `http://api.restella.svc.cluster.local:3000` (코드에 고정, `BACKEND_URL`은 무시) | `Secure` (HTTPS 전용) |

클러스터 주소는 네임스페이스 `restella`의 Service `api`(포트 3000)를 뜻한다. infra/gitops 차트에서 back-end Service를 이 이름으로 만든다.

## 실행

**Docker로 실행 (권장).** 저장소 루트의 `compose.yaml`이 MariaDB → back-end → front-end를 띄운다.

```bash
cp .env.example .env                          # 저장소 루트: DB·back-end 값
cp front-end/.env.example front-end/.env.local
docker compose up -d --build --wait           # 운영자 콘솔: http://localhost:3200
```

이미지는 [Dockerfile](Dockerfile)로 만든다. Next.js `standalone` 출력과 정적 파일만 담고, root가 아닌 `node` 사용자로 실행한다. 환경변수는 실행할 때 넣고 이미지에 굽지 않는다(`.env*`는 `.dockerignore`로 뺀다). 상태 확인은 `GET /api/health`다(세션·back-end는 보지 않는다).

**호스트에서 실행 (개발용).** back-end가 `http://localhost:3100`에서 떠 있어야 한다([back-end 실행](../back-end/README.md#실행)).

```bash
cd front-end
cp .env.example .env.local   # SESSION_SECRET을 32자 이상 임의 값으로 바꾼다
pnpm install
pnpm dev --port 3200
```

검사와 테스트:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

E2E는 3200번 포트의 front-end(Docker 또는 `pnpm start --port 3200`)에 대해 돈다.

```bash
E2E_PASSWORD=<데모 운영자 비밀번호> pnpm test:e2e
```
