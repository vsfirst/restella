# AI 활용 기록

## 원칙

- **역할:** 문제 선정, 범위, 아키텍처·스택 결정, 커밋은 사람이 한다. 대안 조사, 초안, 구현, 테스트, 리뷰는 AI(Claude Code)가 맡는다.
- **검증:**
  - 불변식 테스트를 먼저 작성한다.
  - 코드 리뷰는 로컬에서 Claude Code `/code-review`로 한다. 구현과 분리된 새 컨텍스트에서 실행하고, 지적마다 반영·기각과 그 이유를 [코드 리뷰 기록](3-development/code-review.md)에 남긴다.
  - 리뷰어와 구현자가 같은 모델 계열이라는 한계는 불변식 테스트와 사람의 최종 판정으로 보완한다.
  - 버전·API 같은 사실은 공식 문서와 레지스트리로 확인한다.
- **기록:**
  - 이 문서: 요청 → AI 산출 → 검토 → 채택·수정·기각.
  - [ADR](adr/): 설계 결정 기록.
  - [코드 리뷰 기록](3-development/code-review.md): `/code-review` 지적과 판정.
  - 커밋의 AI 공동 작성 표기. PR은 쓰지 않는다(리뷰를 로컬에서 하므로).

## 결정 기록

| 날짜 | 사람의 결정·요청 | AI가 한 일 |
|---|---|---|
| 2026-10-09 | 진행 계획을 요청 | 과제 해석, 문제 후보 3개와 추천안, 단계별 계획 제안 |
| 2026-10-09 | 문제를 "멀티채널 판매 숙소의 오버부킹"으로 확정 | 후보 3개(오버부킹, 하우스키핑 상태 불일치, 노쇼)의 장단점 비교와 추천 |
| 2026-10-09 | 기술 스택과 디렉토리 구조를 지정하고, 패키지 설치 없이 뼈대와 README부터 요청 | 최신 버전 조사, FSD·Next.js 공식 문서를 확인해 하위 구조 설계, 뼈대와 README 작성 |
| 2026-10-09 | 버전 원칙을 "호환성 → 최신 LTS → 최신 안정"으로 수정 | 호환성 충돌 보고([검토 사례 #1](#1-버전-선정-p0)), 바뀐 원칙으로 전체 재검토 |
| 2026-10-09 | README에는 서비스 소개와 전체 구조만 두고, 설계·구현 문서는 docs로 분리 | 문서 재구성 |
| 2026-10-09 | 코드 리뷰는 PR이 아니라 로컬에서, Claude Code `/code-review`로 진행 | 리뷰 도구 후보(OCR, Codex, CodeRabbit, Gemini CLI, Claude Code) 조사와 장단점 비교 |
| 2026-10-09 | GitHub 저장소는 public. 비밀값·민감 정보·개인정보는 절대 커밋 금지 | 보안 원칙 문서 작성, `.gitignore` 보강, 현재 파일 검사, 커밋 작성자 이메일 노출 위험 보고 |
| 2026-10-09 | 커밋 작성자 이메일을 GitHub noreply 주소로 변경 | 이 저장소 설정만 변경(전역 설정 유지) |
| 2026-10-09 | gitleaks 설치 | Homebrew로 8.30.1 설치, pre-commit 훅 구성, 가짜 AWS 키로 커밋이 차단되는지 확인 |
| 2026-10-09 | 인프라를 demo(퍼블릭 EC2 + Let's Encrypt, 실제 배포)와 prod(ALB·NAT·프라이빗 서브넷, 코드만)로 분리 | VPC 구성, ALB와 ACM의 관계, NAT 대신 VPC 엔드포인트만 쓰는 안, CloudFront 안의 비용과 제약 조사. [ADR-0001](adr/0001-network-topology.md) 작성 |
| 2026-10-09 | 리전 서울, VPC `10.0.0.0/16`, state 버킷은 bootstrap Terraform으로 생성 | bootstrap 코드 작성(버전 관리·암호화·공개 차단·HTTPS 전용·삭제 방지, S3 네이티브 잠금), fmt·validate·plan으로 검증(apply 전). Route 53 호스팅 영역과 상위 도메인 위임 상태 확인 |
| 2026-10-09 | infra, front-end, back-end 디렉토리마다 설계를 설명하는 README를 둠 | 구성 요소별 설계를 각 README로 옮기고, `docs/design`은 공통 설계(아키텍처 흐름, 기술 스택, 보안)만 남김. 중복을 피하려고 `deployment.md`는 `infra/README.md`로 통합 |
| 2026-10-09 | 로컬 Terraform을 1.16.5로 업그레이드 | Homebrew tap 갱신 후 업그레이드, bootstrap 재검증 |
| 2026-10-09 | demo 인스턴스를 t4g.large 스팟으로 결정 | 워크로드별 메모리 산정, AWS Pricing API로 서울 가격 조회, 스팟 가격 조회, 회수 대비책(`stop` 동작, `use_spot` 전환) 제안 |
| 2026-10-09 | OS를 Amazon Linux 2023으로 결정 (AI는 Ubuntu 26.04 추천) | k3s 지원표와 AL2023 AMI 확인, 설치 스크립트를 읽고 AL2023 오판별 문제 발견([검토 사례 #2](#2-k3s-설치-스크립트의-al2023-판별-p4)). [ADR-0002](adr/0002-demo-node-os-and-instance.md) 작성 |
| 2026-10-09 | demo Terraform 코드 작성 요청 | network·k3s-node 모듈과 envs/demo 작성. fmt·validate 통과, 임시 로컬 backend로 plan(23개 생성 예정) 확인. apply는 하지 않음 |
| 2026-10-09 | 배포 파이프라인을 "ECR 푸시 → gitops에 이미지 sha 반영 → Argo CD 업데이트"로, ECR과 Secrets Manager 이름을 `restella-demo`로 결정 | ECR 모듈, GitHub OIDC 공급자(bootstrap)와 저장소·브랜치로 좁힌 푸시 역할, 비밀값 그릇, 노드 권한 작성. 클러스터의 ECR 인증 방식 3가지 비교 후 ESO 토큰 생성기 채택. 기존 리소스 충돌 없음 확인. [ADR-0003](adr/0003-delivery-pipeline.md) 작성 |
| 2026-10-09 | 기획·디자인·개발·테스트 단계를 모두 거쳤음을 레포에서 보여줄 것. 화면 설계는 레포 안에 보관 | 단계별 문서 구조, 요구사항 → 설계 → 구현 → 테스트 추적표, 단계 태그 제안. `docs`를 `1-planning`~`4-testing`으로 재배치하고 링크 22개를 자동으로 고침 |
| 2026-10-09 | 요구사항 목록 작성 요청 | 문제 정의의 목표 3개를 기능 요구사항 20개(Must 16, Should 3, Could 1)와 품질 요구사항 8개로 나누고 완료 조건을 붙임. 수치 목표는 사람이 확정하도록 ⚑로 표시. 범위 문서와 우선순위를 맞춤 |
| 2026-10-09 | 요구사항 확정(수치 목표 포함), 디자인 단계 진행 | 도메인 모델·ERD, 예약 상태 전이, 예약·취소 트랜잭션과 잠금 순서, API 명세(채널 HMAC 서명, 운영자 API, 동기화 계약), 화면 목록·흐름·시연 시나리오 작성. 동시성, 중복 처리, 동기화, 실시간 알림 방식의 대안 비교를 [ADR-0004](adr/0004-reservation-consistency-and-sync.md)로 정리. 모든 테이블과 엔드포인트에 근거 요구사항 ID를 붙임 |
| 2026-10-09 | 와이어프레임은 HTML 목업으로 | 화면 7개(+상세·모달 3개)를 Tailwind 4.3.3 브라우저 빌드로 작성(패키지 설치 없음). 헤드리스 Chrome 캡처 스크립트로 스크린샷 10장 생성. 캡처를 직접 보고 시각 열 줄바꿈, 이벤트 주체 표기, 이력 시각 불일치, 배지 숫자 불일치를 고침. 모든 화면의 숫자를 "마지막 1실" 시나리오 한 시점으로 맞춤 |
| 2026-10-09 | README 그림의 "채널 시뮬레이터"가 어떤 앱인지 질문 → back-end 안의 모듈로 유지(A안) | 그림이 설계(back-end 모듈)와 어긋나 별도 앱처럼 보이는 문제를 인정하고, 모듈 유지와 별도 앱 분리를 비교. 그림을 back-end 안의 모듈로 고치고, 시뮬레이터 경계 원칙(HTTP 계약만 사용, 다른 도메인 모듈 import 금지, 비공개 수신 주소)을 문서에 명시 |
| 2026-10-09 | 설계 확정, back-end 개발 시작 | 설계 문서를 기준으로 구현 시작 |
| 2026-10-09 | (back-end 구현) | NestJS 12 프로젝트 생성, 모듈 9개와 마이그레이션 구현, 단위 20개·E2E 56개 테스트 작성. 테스트로 발견한 문제 6건 수정([테스트 결과](4-testing/test-report.md)). 빌드 결과물로 마이그레이션 → 시드 → 기동 → 시뮬레이션 확인. 설계에서 바뀐 점은 [구현 노트](3-development/back-end.md)에 기록 |
| 2026-10-10 | README 서비스 소개를 문제 상황 · 해결 방안 중심으로 재구성하고, 맨 위에 비즈니스 관점 요약(운영자·고객에게 좋은 점)을 둠 | 서비스 흐름·문제 상황·해결 방안 그림 작성. 순서도는 세로·가로 모두 GitHub 폭에서 읽기 어려워 시퀀스 그림으로 바꿈. 모든 그림을 헤드리스 Chrome으로 렌더링해 확인. 운영자·고객 관점 비교표, 검증 결과, 범위, 채널 시뮬레이터 설명 추가. "마지막 방을 미리 닫아 생기는 판매 손실"은 새 가정이라 문제 정의에도 반영하고 가정임을 보고 |
| 2026-10-10 | DTO를 NestJS 관례대로 `dto/*.dto.ts`로 분리하고 응답 DTO 추가 | 요청 DTO 14개 분리, 응답 DTO 작성과 Swagger 연결, 플러그인 설정 원복, 시뮬레이터 경계 린트 확장. 전체 테스트와 Swagger 문서로 검증([검토 사례 #5](#5-dto-위치와-응답-dto-누락-p2)) |
| 2026-10-10 | front-end 구현. 초기 데이터는 서버 렌더링으로 처리 | Next.js 16.4 템플릿과 패키지에 들어 있는 해당 버전 문서를 먼저 읽고, 서버에서 받아 TanStack Query로 넘기는 구조로 화면 7개·BFF·실시간 갱신 구현. 결정 대기 3건은 AI가 정함(API 타입 생성은 TS 6 호환 때문에 @hey-api/openapi-ts, zod·UI 부품은 쓰지 않음). 단위 11개·E2E 2개 통과, 스크린샷을 직접 보고 확인([검토 사례 #6](#6-front-end-e2e가-드러낸-문제-p3)) |
| 2026-10-10 | front-end의 UI와 로직을 나눠, 로직은 `lib/use-*.controller.ts`로 | features·widgets·_app의 UI 19개에서 상태·요청·이동 로직을 컨트롤러 훅으로 옮김. 서버 컴포넌트의 searchParams 해석은 `lib/`의 순수 함수로 분리하고 단위 테스트 추가. 훅을 서버도 쓰는 공용 index에서 export해 빌드가 깨진 것을 고침 |
| 2026-10-10 | API를 브라우저용과 서버용으로 나누고 둘 다 fetch로. 서버는 TanStack Query에 의존하지 않고, props로 바로 그릴 수 있는 것은 props로 | `clientFetch`(브라우저 → BFF)·`serverFetch`(서버 → back-end)로 나누고 엔티티마다 `endpoints.ts`·`*.client.ts`·`*.server.ts` 작성. 서버의 prefetch·HydrationBoundary를 없애고 props로 전달, 갱신은 `router.refresh()`, "더 보기"는 `?cursor=` 페이지 이동으로 바꿈. TanStack Query는 변경 요청과 대화상자 조회에만 남김. 단위·E2E 재통과 |
| 2026-10-10 | API 경로는 `shared/api/endpoints.ts` 한 파일에서 관리 | 엔티티 7곳에 나뉜 경로 정의와 코드에 직접 쓴 BFF·인증·SSE 경로를 한 파일로 모음. `shared`는 엔티티 타입을 쓸 수 없어 파라미터 타입은 생성된 API 타입에서 가져옴. 경로 단위 테스트 추가, 단위·E2E 재통과 |
| 2026-10-10 | FSD `entities` 레이어를 없앰 (A안) | 엔티티 38개 파일을 분석해 대부분이 한 줄짜리 요청 함수와 타입 별칭임을 보고하고, 없애는 안(A)과 얇게 남기는 안(B)을 비교해 A를 권함. 타입 별칭·라벨·이벤트 문장·재고 판정·배지를 `shared`로 옮기고, 화면은 `serverFetch`, 컨트롤러는 `clientFetch`를 직접 부르게 바꿈. ESLint 레이어 규칙과 설계 문서의 레이어 표를 고침. 단위·E2E 재통과 |
| 2026-10-10 | widgets는 남기고 features는 없앰 | features 6개와 widgets 8개가 모두 한 곳에서만 쓰인다는 것을 보고하고, features만 없애는 안과 둘 다 없애는 안을 비교(AI는 둘 다 없애는 안 권장). 사람은 widgets를 남기기로 결정. 각 기능을 쓰는 위젯 안으로(로그인 폼은 로그인 화면으로) 옮기고 ESLint 레이어 규칙과 문서를 고침. 단위·E2E 재통과 |
| 2026-10-10 | 엔드포인트마다 메서드·경로·요청·응답 타입을 함께 정의. 쿼리는 `Params`, 본문은 `Input`, 응답은 `Output` | DTO는 손으로 다시 쓰지 말고 생성된 타입을 연결하자고 제안. 생성 타입을 쿼리 타입으로 쓰다가 back-end 목록 DTO의 `limit`이 Swagger에 필수 `Object`로 나오는 문제를 발견해 함께 고침. `clientFetch`·`serverFetch`가 정의를 받아 메서드와 응답 타입을 정하게 바꾸고, 본문 누락·경로 변수 타입·GET 본문·응답 타입·잘못된 상태값 5가지를 일부러 넣어 타입 검사가 모두 잡는 것을 확인. back-end E2E 56개, front-end 단위 16개·E2E 재통과 |
| 2026-10-10 | 공통 응답 형식은 B안: 성공은 그대로, 실패는 RFC 9457, 목록·요청 ID·오류 유형 규칙을 명시 | 봉투 형식(A)과 HTTP 표준+규칙(B)을 비교해 B를 권함(채널 API 계약 유지, 성공 판단을 HTTP 상태 하나로). 구현 중 설계에 적힌 `errors: [{ field, message }]`가 실제로는 메시지만 나가던 차이를 발견해 맞춤. 오류 유형 목록 파일, `X-Request-Id` 미들웨어, 입력 오류 변환 추가, 예외를 던지는 31곳을 목록 유형으로 교체. BFF가 요청 ID를 전달하고 BFF 자체 오류도 같은 형식으로. back-end E2E 60개, front-end 단위 18개·E2E 통과 |
| 2026-10-10 | f/e·b/e는 별도 pnpm 프로젝트로 유지. 로컬 실행은 Docker로, DB부터 | 루트 `compose.yaml`에 MariaDB(utf8mb4·UTC·localhost 전용 포트) 정의, back-end용 compose는 루트로 합침. 기존 로컬 DB 값을 루트 `.env`로 옮김(값은 출력하지 않음) |
| 2026-10-10 | back-end 컨테이너 | 베이스 이미지와 pnpm 12 설치를 먼저 컨테이너에서 확인한 뒤 멀티스테이지 Dockerfile 작성(trixie-slim, 실행용 의존성만, node 사용자). 이미지 안에서 argon2 동작, `.env` 없음 확인. compose에 마이그레이션·시드 일회성 작업과 back-end를 순서대로 연결. 컨테이너에서 로그인 → 50건 시뮬레이션(확정 1, 초과 판매 0) → 5개 채널 동기화 확인. 새 파일 gitleaks 통과 |
| 2026-10-10 | front-end 컨테이너. 값은 `.env.local`에, `APP_ENV`(local·demo·prod)로 back-end 주소를 정함. local이 아니면 클러스터 내부 주소 `http://api.restella.svc.cluster.local:3000` | `APP_ENV` 검증과 주소 결정을 순수 함수로 만들고 단위 테스트 추가. 세션 쿠키 `Secure`도 `APP_ENV`로. standalone Dockerfile, `/api/health`, `robots.txt` 추가. 컨테이너 E2E에서 로그인 이동 주소가 서버 바인드 주소(0.0.0.0:3000)로 만들어지는 문제를 찾아 고침(테스트 결과 F6). 클러스터 이름을 infra README에 적어 gitops 차트와 맞추게 함 |
| 2026-10-11 | 프로젝트 파악 후 문서 불일치부터 수정 | 문서 전체를 코드와 대조해 불일치를 찾음. 없앤 FSD 레이어(`features`·`entities`)를 가리키던 추적표·화면 설계 3곳, 실제보다 적게 적힌 테스트 수(E2E 56 → 60, front-end 단위 파일 10 → 9), 이미 구현했는데 "여유가 되면"으로 남은 범위 항목, 실제 진행과 다른 계획 상태, PR을 쓰지 않는데 "PR 표기"가 적힌 AI 활용 원칙을 고침. 숫자는 문서를 믿지 않고 테스트를 다시 실행해 확인. 범위 "확정" 표시는 사람 결정이라 바꾸지 않음 |
| 2026-10-11 | README 맨 위에 작업 과정(AI와 어떤 순서로 어떻게 작업했는지)과 문서 목록을 둠 | 사람·AI 역할, 단계별 표(사람이 정한 것·AI가 한 일·상태), 검증 방법, 검토 사례 요약을 ai-log에서 뽑아 작성. 목록에 빠진 front-end 구현 노트 추가 |
| 2026-10-11 | demo 인프라 준비(ECR, Secrets Manager 필요). prod는 코드만 | ECR·비밀값 그릇·노드 권한·CI 푸시 역할은 이미 코드에 있음을 보고. 비어 있던 비밀값 JSON의 키 계약 7개를 앱의 환경변수 검증 코드에서 도출해 정함. 없는 키만 무작위로 채우고 값을 출력하지 않는 스크립트 작성(값은 사람이 실행해 넣음). 가짜 AWS CLI로 첫 실행·재실행·키 추가·짧은 비밀번호 거절을 확인. infra README의 IMDS 홉 설명(1)이 demo 설정(2)과 다른 것을 발견해 고침 |
| 2026-10-11 | `terraform/global`을 만들어 Route 53 관리 | 호스팅 영역을 `global` 스택으로 옮기고(`prevent_destroy`), 레코드는 각 환경이 관리하도록 경계를 나눔. 영역이 이미 있으므로 새로 만들면 네임서버가 바뀌는 문제를 짚고, 영역 ID를 tfvars로 받는 `import` 블록으로 가져오게 함. 적용 순서를 bootstrap → global → demo → 비밀값으로 정리. 세 스택 fmt·validate 통과, gitleaks 통과. AWS 세션 만료로 plan은 하지 못함 |
| 2026-10-11 | GitHub OIDC 공급자를 bootstrap에서 global로 옮김 (AI 권장안 채택) | bootstrap의 state는 로컬 파일이라 잃어버리기 쉽다는 이유로 권장. 적용 전이라 state 이동 없이 파일만 옮기고, 출력·주석·ADR-0003·infra README·적용 순서(bootstrap → global → demo)를 고침. AWS에 OIDC 공급자와 state 버킷이 아직 없어 가져오기(import)가 필요 없음을 확인. bootstrap plan: S3 관련 7개 생성 |
| 2026-10-11 | GitHub에 public으로 올림. 소유자 외에는 아무도 쓰거나 고칠 수 없게 | 올리기 전에 커밋 대상 364개 파일을 검사: 제외 대상 파일 없음, 실제 도메인·계정 ID·개인 이메일·로컬 경로·공인 IP 없음(AWS에서 실제 값을 읽어 대조, 값은 출력하지 않음), gitleaks 0건, 작성자는 noreply. 첫 커밋 후 `gh`로 저장소 생성·푸시. 협업자 없음, 이슈·위키·프로젝트·토론 끔, 상호작용 제한(협업자만, 6개월), secret scanning·push protection, Actions 토큰 읽기 전용, 외부 기여자 워크플로 승인 필수로 설정하고 API로 다시 읽어 확인. 포크는 막을 수 없고 상호작용 제한은 6개월마다 다시 걸어야 함을 [보안](2-design/security.md#저장소-쓰기-권한)에 기록 |
| 2026-10-11 | bootstrap apply 승인 | plan을 파일로 저장해 승인된 7개만 적용. 버킷의 버전 관리·공개 차단·암호화·HTTP 거부를 AWS에서 다시 읽어 확인. backend.hcl과 tfvars를 AWS 값으로 만들고(커밋 제외 확인, 값은 출력하지 않음) global plan 실행: 영역 가져오기 1, OIDC 공급자 생성 1. plan에서 영역 설명을 덮어써 기존 운영 메모(위임 출처)가 사라지는 것을 발견해 `ignore_changes = [comment]`로 막음. 공개 DNS의 NS 위임이 Route 53 영역 네임서버와 일치함을 확인 |
| 2026-10-11 | global apply 승인 | 저장한 plan대로 적용(영역 가져오기 1, OIDC 공급자 생성 1, 태그 변경 1). 다시 plan해 변경 없음 확인. 이어서 demo plan(적용 안 함): 31개 생성, 변경·삭제 없음. plan JSON에서 스팟(persistent/stop), IMDSv2·홉 2, 인바운드 80·443만, CI 역할 신뢰 조건(`vsfirst/restella`의 main만), ECR 태그 덮어쓰기 금지·스캔, 비밀값 복구 기간을 확인. 가용영역의 t4g.large 제공 여부, 스팟 가격, 스팟 vCPU 할당량도 확인 (이 신뢰 조건의 형식이 틀렸음은 첫 CI에서 드러남, [검토 사례 #8](#8-plan이-통과시킨-두-가지-오류-p4)) |
| 2026-10-11 | demo는 ECR·비밀값·CI 역할만 먼저 적용 (노드 비용을 gitops 준비 뒤로 미루는 AI 권장안 채택) | `-target` plan을 저장해 대상 7개만 들어 있는지 확인 후 적용. AWS에서 ECR 2개(태그 덮어쓰기 금지·스캔·수명 주기 2규칙), 비밀값 그릇(값 없음), CI 역할 신뢰 조건과 권한을 다시 읽어 확인. 남은 demo 리소스는 24개(네트워크·노드) |
| 2026-10-11 | `restella-demo`에 값 입력을 AI에게 요청. 비용을 아끼려고 비밀값 1개에 `fe`·`be` 키 2개만, 값은 JSON으로 | 스크립트를 앱별 중첩 구조로 바꾸고, 사람 입력이던 데모 운영자 비밀번호도 무작위(20자, 기호 없음)로 만들게 함. 구조가 다르면 덮어쓰지 않고 멈추게 함. 가짜 AWS CLI로 구조, 앱의 환경변수 검증 규칙(길이, 채널 5개), 재실행 시 변경 없음, 빠진 키만 추가, 옛 구조 거부를 확인한 뒤 실제 입력. 확인은 키 이름과 길이까지만 해서 AI 대화 기록에 값이 남지 않게 함. 앱별 키 2개라 Grafana 관리자 비밀번호는 넣지 않음. 보안 문서의 AI 규칙을 "AI는 값을 보지 않는다"로 고침 |
| 2026-10-11 | 워크플로를 앱별로(`demo-front-end.yaml`, `demo-back-end.yaml`). main에 push·머지되면 빌드 → ECR → gitops 이미지 다이제스트 변경. Grafana도 앱 저장소가 필요한지 질문 | 테스트 → arm64 네이티브 빌드 → ECR 푸시 → gitops 커밋 워크플로 작성. 액션 7개의 최신 릴리스를 조회해 커밋 SHA로 고정하고, 입력·출력 이름은 각 `action.yml`에서 확인. 그 과정에서 `configure-aws-credentials`가 기본값으로 계정 ID를 로그에서 가리지 않는다는 것과, 레지스트리 주소(계정 ID 포함)를 gitops에 커밋하면 공개 저장소에 계정 ID가 실린다는 것을 발견해 막음(가리기 옵션, job 사이에는 다이제스트만, 값 파일에는 레지스트리 주소 제외). 같은 커밋 재실행(ECR 태그 덮어쓰기 금지), 두 워크플로의 동시 커밋, 오래된 실행의 덮어쓰기에 대비. 첫 실행에서 실패하지 않게 두 앱의 lint·typecheck를 로컬에서 먼저 확인. actionlint 1.7.12 통과. 역할 ARN은 값을 출력하지 않고 저장소 Secret으로 등록. Grafana는 자체 이미지가 없어 별도 저장소가 필요 없다고 답함 |
| 2026-10-11 | DB용 Dockerfile이 따로 있는지, EC2 로그 로테이션은 어떤지 질문 | DB는 공식 MariaDB 이미지를 그대로 쓰고 스키마는 back-end 이미지의 마이그레이션 Job이 만든다고 답함(Dockerfile 불필요). 로그는 AL2023의 journald 기본 상한(파일시스템의 10%)과 kubelet 기본 로테이션(10Mi × 5)이 루트 20GiB를 이미지와 나눠 쓰기엔 크다고 보고, 노드가 생기기 전이라 user-data에 journald 500MB·14일, 컨테이너 로그 10Mi × 3을 넣음. 템플릿을 렌더링해 셸 문법과 k3s 설정 YAML을 확인하고, Kubernetes v1.36.5 소스에서 두 kubelet 플래그가 있고 폐기되지 않았음을 확인 |
| 2026-10-11 | 로그는 적당히 쌓이면 예전 것을 지우도록 | 넣은 설정이 이미 그렇게 동작함을 설명(journald는 상한·기간을 넘으면 오래된 파일부터 삭제, kubelet은 3개만 유지). 남은 위험으로 k3s 내장 containerd가 journald가 아닌 별도 파일에 로그를 쓰는 점을 짚고, k3s v1.36.5+k3s1 소스에서 이 파일도 lumberjack으로 50MB × 3개·28일 로테이션됨을 확인해 추가 설정 없이 문서에만 반영 |
| 2026-10-11 | MariaDB 차트부터 gitops 작성 | 공식 이미지를 다이제스트로 고정한 StatefulSet 차트, demo values, Argo CD Application 작성. ESO 2.12 소스에서 `be.DB_PASSWORD` 같은 경로 읽기(gjson)와 API 버전(v1)을 확인. 먼저 Docker로 mysql 사용자·읽기 전용 루트 파일시스템·권한 제거 조건에서 공식 이미지가 초기화되는지 확인한 뒤 차트에 반영. 대상과 같은 k3s v1.36.5를 Docker로 띄워 CRD 서버 검증, 설치, 접속 허용·차단, root 원격 거부, 외부 연결 차단, 데이터 유지를 확인하고 지움. 첫 테스트에서 허용된 Pod도 접속에 실패해 원인을 나눠 보니, 정책 컨트롤러가 새 Pod를 허용하기까지의 시간차였음(운영에서도 생길 수 있어 back-end의 재시도·Job backoffLimit을 차트 설계에 남김). 공식 이미지가 무작위 root 비밀번호를 로그에 찍는 것을 entrypoint 원문에서 확인해 알려진 제약으로 기록. 테스트 중 `kubectl run --rm`과 `sh -c`가 섞인 명령이 안전 검사에 막혀, 우회하지 않고 `--rm` 없이 Pod를 만들고 지우는 방식으로 바꿈 |
| 2026-10-11 | ESO와 Argo CD 클러스터 구성 진행 | Argo CD 설치 방법 3가지(노드에서 helm, user-data, k3s HelmChart + 자기 관리)를 비교해 HelmChart 방식으로 정하고 [ADR-0005](adr/0005-cluster-bootstrap.md)에 기록. 차트 최신 패치(argo-cd 10.10.2), k3s helm-controller의 실제 필드, Application 상태 판단 설정 원문, ESO의 기본 자격 증명 체인과 ECR 생성기 출력을 소스에서 확인. 부트스트랩 스크립트(SSM), ESO Application, 클러스터 공통 설정 차트(ClusterSecretStore, ECR pull Secret, 네임스페이스별 메타데이터 차단) 작성. k3s v1.36.5 테스트 클러스터에서 정책을 먼저 건 채 부트스트랩을 돌려 검증하는 중에 리소스 이름 문제(`argo-cd-argocd-server`)와 `k3s kubectl` 호출 문제를 찾아 고침. ESO는 자격 증명 단계까지 가는지, pull Secret 템플릿은 Fake 생성기로, 차단 정책은 대체 주소로 확인. 안전 검사가 변수가 든 `bash -c`를 막아 curl 이미지로 바꿔 검증. shellcheck 0.11.0 통과 |
| 2026-10-11 | back-end 차트 작성. 레지스트리와 도메인은 클러스터 메타데이터로 주입(AI 권장안 채택, 질문으로 확인) | 앱 경로·헬스체크·시드 동작을 코드에서 확인하고 차트 작성(ExternalSecret → 마이그레이션·시드 Sync 훅 → API, Service `api`, 채널 API·문서만 여는 Ingress, NetworkPolicy). 레지스트리 주입 대안 4가지를 비교해 [ADR-0005 결정 4](adr/0005-cluster-bootstrap.md)에 기록하고, 부트스트랩에 클러스터 Secret 단계와 형식 검사를 추가. 계정 ID나 도메인이 든 Terraform 출력을 sensitive로 바꿈. ESO 소스에서 `extract`+`property`가 객체를 키별로 푸는 것과 Argo CD 내장 ExternalSecret 상태 판단을 확인. 실제 back-end 이미지를 k3s v1.36.5에 넣어 Job 완료, API Ready, 로그인 후 50건 시뮬레이션(확정 1, 초과 판매 0), 레이블 없는 Pod 차단을 확인하고, 가짜 값으로 ApplicationSet 파라미터 주입도 확인. 서버 검증 중 helm으로 설치한 Job 위에 덮어써 생긴 "immutable" 오류는 차트 문제가 아님을 빈 네임스페이스에서 재확인 |
| 2026-10-11 | front-end 차트 작성. 콘솔 주소는 `fe.<도메인>` | 사람이 실제 주소를 말했지만, 앞서 정한 대로 도메인은 Git에 넣지 않고 `fe.` 접두사만 ApplicationSet에 둠(호스팅 영역 이름이 그 주소와 같은지는 값을 출력하지 않고 비교). 앱 코드에서 환경변수(`APP_ENV`, `SESSION_SECRET`), 헬스체크, Secure 쿠키 조건을 확인하고 차트 작성. 두 이미지를 빌드해 k3s v1.36.5에 전체 스택을 올리고 Playwright E2E를 port-forward로 돌려 2개 통과. 스크린샷을 직접 열어 채널 5개 판매 중지와 충돌 17건 표시를 확인. 레이블 없는 Pod 차단, demo 값 렌더링 결과와 ApplicationSet의 서버 검증 통과 |
| 2026-10-11 | cert-manager 진행 | cert-manager 최신 패치(v1.21.2)와 k3s v1.36.5 내장 Traefik(차트 40.1.0)의 리디렉션 문법을 원문으로 확인. 80번 전체 리디렉션이 HTTP-01을 깨지 않는지 cert-manager 소스(사전 점검이 리디렉션을 따라가고 인증서를 검증하지 않음)로 확인한 뒤 Traefik HelmChartConfig로 구성. 이메일 없는 Let's Encrypt 발급자(실제·staging), cert-manager Application, 메타데이터 차단 목록에 cert-manager 추가. Traefik을 켠 테스트 k3s에서 리디렉션, 자체 서명 대체 발급자로 Ingress → 인증서 → Traefik 응답 흐름, NetworkPolicy 통과, `api.` 경로 공개 범위를 확인. 테스트 중 cert-manager webhook이 CA 주입 전 요청을 거부하는 시간차를 재현해, 기본값으로는 재시도하지 않는 Argo CD 자동 동기화에 재시도(5회)를 모든 Application에 추가. 처음 넣은 재시도 블록의 들여쓰기가 ApplicationSet에서 틀린 것을 YAML 파싱으로 찾아 고침 |
| 2026-10-11 | 커밋하고 push | 변경 70개를 커밋 전 검사(계정 ID·도메인·상위 도메인을 AWS·tfvars의 실제 값과 대조, 이메일, 공인 IP, 제외 파일)한 뒤 infra·ci·gitops·docs 4개 커밋으로 나눠 push. 첫 CI는 테스트는 통과했지만 빌드에서 AWS 역할을 맡지 못해 실패 |
| 2026-10-11 | 노드 적용 | plan을 저장해 24개 생성만 있는지 확인 후 적용. 보안 그룹 규칙 1개가 실패: 설명에 한글과 `'`가 있었는데 AWS는 영문·일부 기호만 받고, validate·plan은 이를 검사하지 않음. 설명을 영문으로 바꾸고 같은 실수가 plan에서 걸리도록 모듈 변수에 형식 검사를 추가(옛 설명은 거부, 새 설명은 통과 확인). SSM으로 노드를 확인: k3s v1.36.5 Ready, 데이터 볼륨 마운트, 로그 상한 적용 |
| 2026-10-11 | (CI 실패 원인 조사) | 역할 신뢰 조건은 `repo:vsfirst/restella:...`였지만, 이 저장소의 OIDC 토큰은 소유자·저장소 ID가 붙는 "변경 불가 subject" 형식임을 GitHub API로 확인. 변수를 `github_oidc_subject_prefix`로 바꿔 ID 형식으로 맞추고(이름 재사용 공격도 막힘) 적용 후 실패한 job만 재실행. ADR-0003에 기록. 재실행한 두 워크플로가 ECR 푸시와 gitops 다이제스트 커밋까지 성공 ([검토 사례 #8](#8-plan이-통과시킨-두-가지-오류-p4)) |
| 2026-10-11 | 부트스트랩 진행 | 스크립트가 55초 만에 Argo CD 설치 → 클러스터 Secret → 루트 Application 등록까지 마침. 그런데 7분간 하위 앱이 생기지 않아 SSM으로 확인하니 루트는 `argocd-bootstrap`(wave -2)을, `argocd-bootstrap`은 자기가 관리하는 루트를 기다리는 순환 대기. 로컬 테스트 때는 GitHub의 `apps/demo`가 비어 있어 드러나지 않았던 문제. `argocd-bootstrap`은 `argocd.yaml`만 관리하고 루트는 스크립트만 적용하도록 바꾸고 ADR-0005에 기록 ([검토 사례 #7](#7-잘못된-이유로-통과한-부트스트랩-테스트-p4)) |
| 2026-10-11 | (멈춘 클러스터 복구) | Git 수정만으로는 이미 멈춘 클러스터가 풀리지 않음을 확인: 새 `argocd-bootstrap` 정의를 반영하는 루트의 동기화가 바로 그 앱을 기다리며 멈춰 있었다. SSM으로 노드에서 새 정의를 직접 적용하고 `root-demo`에 남은 `argocd.argoproj.io/tracking-id` annotation을 지움. 옛 정의로 진행 중이던 동기화가 annotation을 다시 붙여 한 번 더 지운 뒤, 하위 앱이 wave 순서대로 생성됨 |
| 2026-10-11 | 상태 확인 (긴 대기 루프는 "너무 오래 걸린다"며 중단) | `cluster-config` 첫 동기화가 ESO webhook에 엔드포인트가 아직 없어 실패했지만, 앞서 넣은 재시도(5회)로 사람 개입 없이 회복. 최종 상태: 모든 Application Synced/Healthy, ClusterSecretStore Valid(노드 역할로 Secrets Manager 접근), ECR pull Secret 동기화, Let's Encrypt 실제 인증서 발급, HTTP 301. 이후 확인은 짧게 한 번씩만 하기로 바꿈. Argo CD 화면은 Ingress로 열지 않고 SSM 포트 포워딩, DB는 SSM + `kubectl exec`/`port-forward`로 접속하는 방법 안내(비밀번호는 사람이 직접 읽음) |
| 2026-10-11 | 면접관이 demo를 직접 써 볼 수 있도록 루트에 사용 방법을 상세히. 계정·비밀번호는 사람이 따로 전달 | 화면 이름·버튼·기본값을 UI 코드와 E2E에서 확인해 [DEMO.md](../DEMO.md) 작성: 5분 시연 순서와 기대 결과, 추가 실험, API 문서와 401이 정상인 이유, 공용 환경·로그인 제한(모든 사용자가 1분 5회 공유)·스팟 회수 같은 제약. 도메인은 Git에 두지 않는 결정에 따라 `fe.<도메인>`으로 쓰고 따로 전달 |
| 2026-10-11 | 모든 기록(.md)이 제대로 작성됐는지 확인하고 수정 | 문서를 세 묶음으로 나눠 하위 에이전트 3개가 코드·설정·배포 상태와 대조(읽기 전용). 깨진 링크는 없었고, 배포 이후 상태 미반영("적용 전", "배포하면서 추가"), 미구현을 구현처럼 쓴 곳(Prometheus·Grafana, prod 코드), 코드와 다른 사실(이벤트 API 쿼리, `simulation_run` 컬럼, 마이그레이션 훅 종류, "채널 API 키")을 찾음. 주요 주장은 코드로 다시 확인한 뒤 README·기획·설계·개발·테스트 문서, ADR-0001~0003·0005, infra README에 반영. 추적표에서 AC-N03-1·N03-2·N06-1을 ✅로 바꾸고 나머지는 ⏳ 유지. 검토 사례 #7·#8 추가 |
| 2026-10-11 | Grafana 구축. 면접관 접근은 익명 읽기 전용(질문으로 확인, AI 권장안) | kube-prometheus-stack 92.3.0(Prometheus 3.13.4 LTS 고정, Alertmanager·k3s 내장 컴포넌트 수집 끔, 7일·3GB 보관)을 ApplicationSet으로 넣어 `grafana.<도메인>` 주입. 차트 기본 관리자 비밀번호(`prom-operator`)를 쓰지 않고, Secrets Manager 구조도 늘리지 않으려고 ESO Password 생성기로 한 번만 생성(`CreatedOnce`). Restella 대시보드(예약 결과·충돌·동기화 지연·실패·API p95)를 ConfigMap으로. back-end에 ServiceMonitor와 Prometheus 수집 허용 NetworkPolicy, monitoring 네임스페이스 메타데이터 차단 추가. 대시보드 JSON의 `{{result}}`를 Helm이 해석하는 문제를 렌더링에서 잡아 `.Files.Get`으로 바꿈. 배포 후 HTTPS·익명 조회·편집 403·back-end 수집을 한 번씩 확인 |
| 2026-10-13 | 배포된 AWS 환경 확인 요청 | 읽기 전용 점검(세 스택 plan, SSM으로 클러스터 조회, 외부 HTTPS). Pod 재시작 횟수와 노드 가동 시간이 맞지 않는 것을 보고 부팅 기록·CloudTrail로 잦은 스팟 회수(55시간에 49번, 가동률 71%)를 찾음. `use_spot = false`가 아무것도 바꾸지 않는 문제를 찾아 postcondition 안을 plan으로 확인. 사람이 코드는 되돌리기로 결정. `-replace` 절차와 교체 영향만 문서화 |
| 2026-10-13 | 예약 상세가 서버 렌더링인지 질문, 이어서 화면 오해 소지 2건 수정 지시 | 스크린샷의 "상태: 충돌"과 이력의 "충돌 해결됨"이 어긋나 보여 로컬 DB로 확인(설계대로 예약은 `CONFLICT`로 남음). 예약 응답에 `conflictStatus` 추가, 배지를 "충돌 · 해결됨"으로, 해결된 충돌의 취소 안내 문구 수정. nullable enum이 생성 타입에서 `null`을 잃는 것을 발견해 enum 목록에 `null` 추가 |
| 2026-10-13 | 온디맨드로 전환(사람 결정, 적용은 사람이 실행) | 교체 plan 저장과 영향 설명. 스팟 요청 취소·종료·apply·부트스트랩은 권한 검사에 막혀 명령을 안내하고 사람이 실행. 중지 거부로 실패한 apply의 원인 분석, 실패 후 상태 확인(인스턴스 중지, 요청 취소, state 불변)과 복구 순서 제시, 새 클러스터 동기화·인증서·외부 접속 확인 |
| 2026-10-13 | Grafana에 로그가 없다는 지적 → Loki·Alloy 추가 지시 | 로그 수집이 아예 구성되지 않았음을 확인. Loki 오픈소스 차트가 grafana-community로 옮겨진 것을 확인해 그 차트 사용. Alloy 차트 기본 권한(클러스터 전체 Secret 읽기)과 root 실행을 찾아 restella Role·alloy 사용자로 좁힘. 익명 Grafana로 로그가 공개되는 점을 고려해 수집 범위를 restella로 제한하고 Loki에 NetworkPolicy. 로컬 k3s에서 수집·범위·차단·비root 검증 |

## 검토 사례

### #1 버전 선정 (P0)

처음 원칙은 "모든 패키지 최신 버전"이었다. AI가 각 패키지의 peer·engine 범위와 공식 지원 매트릭스를 대조해서 호환성 충돌 2건(TypeScript 7, k3s v1.37)과 운영 리스크 1건(MariaDB rolling 릴리스)을 찾아 보고했다. 사람이 이를 보고 원칙을 **호환성 → 최신 LTS → 최신 안정** 순서로 다시 정했다. AI는 바뀐 원칙으로 전체 스택을 다시 검토해 Node.js(24 LTS), Helm CLI(Argo CD 내장 버전), Prometheus(3.13 LTS)를 추가로 조정했고, 고른 조합이 서로의 범위를 만족하는지 semver로 검사했다. 결과는 [기술 스택](2-design/tech-stack.md)에 있다.

디렉토리 설계에는 FSD 공식 Next.js 가이드(`_app`·`_pages`)와 Next.js 16의 `middleware` → `proxy` 변경을 공식 문서로 확인해 반영했다.

### #2 k3s 설치 스크립트의 AL2023 판별 (P4)

사람이 OS를 Amazon Linux 2023으로 정한 뒤, AI는 문서만 믿지 않고 k3s v1.36.5의 `install.sh` 원문을 읽었다. 그 결과 `ID=amzn`, `VERSION_ID=2023`이 숫자 비교(`VERSION_ID > 36`)에 걸려 **el8(CentOS 8)용 SELinux 패키지를 설치하려 한다**는 점을 찾았다. AL2023은 Fedora 계열이라 대상이 맞지 않는다. 그래서 user-data에서 `INSTALL_K3S_SKIP_SELINUX_RPM=true`로 이 단계를 건너뛰고, SELinux는 AL2023 기본값(permissive)을 유지하기로 했다. 이로 인한 보안상 차이와, Ubuntu로 돌아가는 방법은 [ADR-0002](adr/0002-demo-node-os-and-instance.md)에 남겼다.

### #3 NestJS 12 템플릿의 실제 구성 (P2)

기술 스택 문서에는 back-end 테스트 도구를 "Jest(Nest 12 기본 템플릿)"로 적었다. 이는 AI가 GitHub 저장소의 템플릿 파일을 보고 쓴 것이다. 그런데 실제로 배포된 Nest CLI 12.0.8로 프로젝트를 만들어 보니 템플릿은 **ESM과 Vitest**였다. AI는 이를 발견하고 실제 생성 결과를 기준으로 문서를 고쳤다. 그리고 Vitest 5(Vite 8의 Oxc 변환기)가 NestJS 의존성 주입에 필요한 데코레이터 메타데이터를 지원하는지, 본격 구현 전에 작은 테스트로 먼저 확인했다. 교훈은 "문서와 저장소 파일보다 실제 도구의 출력이 기준"이라는 것이다.

### #4 E2E 테스트가 드러낸 교착 (P2)

첫 E2E 실행에서 교착이 18건 나왔다. AI는 실패를 바로 덮지 않았다.
- **원인 분리:** 먼저 실제 원인(새 예약 ID를 잘못 꺼내 생긴 `NaN`)을 고쳤다. 이어서 교착이 그 부수 효과였는지 확인하려고 동시성 테스트를 5회 반복했고, 교착 0건을 확인했다.
- **메커니즘:** 교착은 InnoDB의 알려진 동작으로 설명된다. 같은 키를 먼저 INSERT한 트랜잭션이 롤백되면, 그 키를 기다리던 트랜잭션들끼리 교착에 빠진다.
- **조치:** 이 상황은 운영에서도 DB 오류로 생길 수 있다. 그래서 MariaDB 권고대로 교착·잠금 대기 시간 초과 시 트랜잭션을 다시 시도하는 장치(`withLockRetry`)와 그 단위 테스트를 추가했다.
- **나머지 발견:** 테스트로 찾은 나머지 문제(테스트 격리, 종료 처리, 테스트의 경쟁 조건 등)는 [테스트 결과 보고서](4-testing/test-report.md)에 정리했다.

### #5 DTO 위치와 응답 DTO 누락 (P2)

사람이 "back-end에 DTO가 없다"고 지적했다. 확인해 보니 요청 DTO 14개는 있었지만 컨트롤러 파일 안에 정의돼 있었고, 응답 DTO는 하나도 없었다. 구현할 때 AI가 "컨트롤러가 작고 DTO를 한 곳에서만 쓴다"는 이유로 사람에게 묻지 않고 정한 구조였다. 그리고 Swagger 플러그인 설정을 넓혀 여기에 맞췄다([테스트 결과](4-testing/test-report.md) #6).
- **문제:**
  - NestJS 관례와 달라서, 리뷰어가 DTO가 없다고 오해하기 쉽다.
  - 응답 DTO가 없어서 Swagger에 응답 형태가 나오지 않는다. 그래서 front-end가 응답 타입을 가져다 쓸 수 없다.
  - 서비스가 반환하는 객체가 바뀌어도 API 응답이 따라 바뀌는 것을 막는 장치가 없었다.
- **조치:** 사람이 전면 수정을 결정했다.
  - 요청 DTO를 모듈별 `dto/*.dto.ts`로 옮겼다.
  - 운영자·채널 API의 응답 DTO를 만들고, 엔티티와 DB 행을 응답 DTO로 명시적으로 옮겨 담게 했다.
  - Swagger 플러그인은 기본 설정으로 되돌렸다.
  - 시뮬레이터 경계 린트 규칙이 하위 `dto/` 폴더에도 적용되도록 넓히고, 금지된 import가 실제로 막히는지 확인했다.
- **검증:**
  - 타입 검사, 린트, 단위 20개, E2E 56개가 모두 통과했다.
  - 빌드 결과물을 띄워 Swagger 문서에서 응답 스키마를 확인했다.
  - 응답이 바뀐 두 곳(객실타입의 내부 컬럼 제거, 시뮬레이션 실행 응답 형태 통일)은 [구현 노트](3-development/back-end.md)에 남겼다.
- **교훈:** 프레임워크 관례에서 벗어나는 구조는 작은 것이라도 사람에게 묻고 결정 기록에 남긴다. DTO 규칙은 [코딩 규칙](3-development/conventions.md)에 추가했다.

### #6 front-end E2E가 드러낸 문제 (P3)

AI는 Next.js 16.4가 학습한 내용과 다를 수 있다고 보고, 코드를 쓰기 전에 `create-next-app@16.4.0` 템플릿과 패키지 안의 문서(`node_modules/next/dist/docs`)를 먼저 확인했다. 그래도 실행하고 나서야 드러난 문제가 있었다.
- **비밀번호가 URL에 실릴 수 있는 문제:** E2E 첫 테스트가 실패한 원인을 추적하다 찾았다. React가 화면을 붙이기 전에 로그인 버튼이 눌리면, 폼이 브라우저 기본 동작(GET)으로 제출되어 비밀번호가 URL 쿼리에 실린다. 테스트 선택자만 고쳤다면 놓쳤을 문제다. 폼을 POST로 바꾸고 BFF가 폼 제출도 받게 했다.
- **Cache Components와 세션:** 화면은 정상으로 보였지만 서버 로그에 오류가 쌓였다. 개발 서버로 스택을 확인해 iron-session이 미리 렌더링 중에 현재 시각을 읽는 것이 원인임을 찾고, 세션을 요청 시점에만 읽도록 고쳤다.
- **로그인 시도 제한:** 테스트를 반복하다 429를 만났다. 원인은 로그인이 BFF를 거쳐 모든 요청이 같은 IP로 보이는 구조였다. 데모에서는 유지하되 알려진 제약으로 문서에 남겼다.
- **"통과했지만 틀린" 테스트:** 스크린샷을 직접 열어 보다가 채널별 재고 화면이 로딩 상태로 찍힌 것을 발견했다. 테스트가 아직 화면에 드러나지 않은 요소까지 세고 있었다. 보이는 요소만 세도록 고쳤다.

자세한 내용은 [테스트 결과 보고서](4-testing/test-report.md)의 F1~F5에 있다.

### #7 잘못된 이유로 통과한 부트스트랩 테스트 (P4)

로컬 k3s에서 부트스트랩을 검증할 때 루트 Application은 GitHub에서 정상으로 동기화됐다. 그런데 demo 첫 배포에서는 스크립트가 55초 만에 끝난 뒤 7분 동안 하위 앱이 하나도 생기지 않았다.
- **원인:** 처음에는 `argocd-bootstrap`(wave -2)이 Argo CD 설치 정의와 함께 루트(`root.yaml`)도 관리했다. 루트는 `argocd-bootstrap`이 Healthy가 되기를, `argocd-bootstrap`은 자기가 관리하는 루트가 Healthy가 되기를 기다렸다.
- **왜 로컬에서 통과했나:** 테스트할 때 GitHub의 `apps/demo`는 아직 비어 있었다(gitops 파일을 push하기 전). 하위 앱이 없으니 루트가 기다릴 wave도 없어 바로 Healthy가 됐다. 테스트는 통과했지만, 검증하려던 "wave 순서대로 하위 앱이 뜬다"는 한 번도 실행되지 않았다.
- **조치:** `argocd-bootstrap`은 `argocd.yaml`만 관리하게 하고(`directory.include`), 루트는 부트스트랩 스크립트만 적용하게 했다. 이유를 두 파일의 주석과 [ADR-0005](adr/0005-cluster-bootstrap.md)에 남겼다.
- **클러스터 복구:** Git만 고쳐서는 이미 멈춘 클러스터가 풀리지 않았다. 새 정의를 반영하는 루트의 동기화가 바로 그 앱을 기다리며 멈춰 있었기 때문이다. 노드에서 새 `argocd-bootstrap` 정의를 직접 적용하고 `root-demo`에 남은 `argocd.argoproj.io/tracking-id` annotation을 지웠다. 진행 중이던 동기화가 annotation을 다시 붙여 한 번 더 지웠다.
- **교훈:** 테스트가 통과하면 "검증하려던 경로를 실제로 지났는가"까지 확인한다. 입력이 비어 있어서 통과한 테스트는 검증이 아니다.

### #8 plan이 통과시킨 두 가지 오류 (P4)

노드를 적용하기 전에 plan JSON을 읽어 보안 그룹과 CI 역할 신뢰 조건이 의도대로인지 확인했다. 그래도 실제 적용과 첫 CI에서 오류 2건이 나왔다.
- **보안 그룹 규칙 설명:** 설명에 한글과 `'`를 썼다. AWS는 영문과 일부 기호만 받는데, `terraform validate`와 plan은 이를 검사하지 않아 apply에서야 실패했다. 설명을 영문으로 바꾸고, 같은 실수가 plan에서 걸리도록 `k3s-node` 모듈 변수에 형식 검사를 넣었다(옛 설명은 거부, 새 설명은 통과 확인).
- **CI 역할 신뢰 조건:** plan에서 "이 저장소의 main만"인 것을 확인했지만, 기준으로 삼은 `repo:<소유자>/<저장소>` 형식 자체가 틀렸다. 이 저장소의 OIDC 토큰 `sub`는 소유자·저장소 ID가 붙는 "변경 불가 subject" 형식이었다. GitHub API로 실제 형식을 읽어 변수를 `github_oidc_subject_prefix`로 바꿨다. 이름이 아닌 ID로 고르므로 같은 이름으로 다시 만든 저장소가 역할을 맡는 것도 막혔다([ADR-0003](adr/0003-delivery-pipeline.md)).
- **교훈:** plan은 "코드가 뜻한 대로 바뀌는가"만 보여준다. 외부 시스템이 그 값을 받아들이는지는 그 시스템의 실제 규칙과 값으로 확인한다.

### #9 시험하지 않은 비상 절차 (P4)

배포 이틀 뒤 상태를 점검하면서 두 가지를 찾았다. 둘 다 문서에는 있었지만 실제로 확인한 적이 없는 내용이었다.
- **"드물게 회수된다":** DEMO.md는 스팟 회수가 드물고 몇 분이면 돌아온다고 안내했다. 점검에서 모든 Pod가 Running이었지만, 재시작 횟수(약 48)와 노드 가동 시간(2시간 반)이 맞지 않았다. 부팅 기록과 CloudTrail로 확인하니 55시간 동안 49번 회수됐고 가동률은 71%였다. "모두 Running"만 봤다면 놓쳤다.
- **`use_spot = false`:** ADR-0002와 infra 설계는 "심사 당일에는 `use_spot = false`로 온디맨드로 바꾼다"고 했다. 실제로 plan을 돌리니 "변경 없음"이었다. provider가 `instance_market_options`를 계산하는 값으로 다뤄 블록이 사라져도 차이로 보지 않았다. 심사 당일에 이 절차를 믿고 apply했다면 아무 일도 일어나지 않은 채 스팟으로 남았을 것이다.
- **조치:** 모듈에 postcondition을 넣어 설정과 실제 구매 방식이 다르면 plan이 멈추게 하는 안을 만들고 plan으로 확인했다. 처음 시도한 `replace_triggered_by`는 참조 대상이 새로 생길 때 교체가 일어나지 않아 첫 전환에서 똑같이 아무 일도 하지 않았다(plan으로 확인 후 버림). 사람은 코드를 되돌리기로 했고, 같은 날 `-replace`로 온디맨드 전환을 실행했다.
- **전환에서 또 나온 문제:** AI는 "인스턴스를 지우면 persistent 요청이 다시 열린다"는 위험만 보고 요청을 먼저 취소하자고 제안했다. 그런데 Terraform은 볼륨을 떼기 전에 인스턴스를 중지하고, 요청이 취소된 스팟 인스턴스는 AWS가 중지를 거부한다. apply가 실패했고, 그 사이 회수로 중지된 인스턴스는 다시 켤 수도 없게 됐다. 한 단계의 위험만 보고 다음 단계(볼륨 분리 방식)와의 상호작용은 확인하지 않은 것이다.
- **교훈:** 비상 절차는 필요할 때가 아니라 미리 plan으로라도 실행해 본다. 상태 점검은 "지금 정상인가"뿐 아니라 "그동안 무슨 일이 있었나"(재시작 횟수, 가동 시간)까지 본다.
