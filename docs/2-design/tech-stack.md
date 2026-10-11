# 기술 스택과 버전

## 버전 선정 원칙

위에 있을수록 우선한다.

1. **호환성**: 함께 쓰는 구성 요소의 peer 범위, engine 범위, 공식 지원 매트릭스 안에 있어야 한다.
2. **최신 LTS**: LTS 라인이 있으면 최신 LTS를 쓴다.
3. **최신 안정(GA)**: LTS가 없으면 최신 안정 버전을 쓴다.

어느 라인을 고르든 그 라인의 최신 패치를 쓴다. 아래 버전은 2026-10-09에 npm 레지스트리, 공식 릴리스, 지원 매트릭스에서 확인했고, 고른 조합이 서로의 peer·engine 범위를 만족하는지 semver로 검사했다. 설치할 때 다시 확인한 뒤 lockfile로 고정한다.

## 버전표

| 영역 | 구성 | 버전 | 선정 근거 |
|---|---|---|---|
| 런타임 | Node.js | 24.21.0 | LTS (Krypton) |
| 컨테이너 베이스 | node:24.21.0-trixie-slim | Debian 13 (trixie) | 최신 안정. bookworm(Debian 12)도 있지만 trixie가 현재 Debian stable이다 |
| 패키지 매니저 | pnpm | 12.10.1 | 최신 |
| front-end | Next.js | 16.4.0 | LTS (Active LTS) |
| | React | 19.3.0 | 최신 |
| | iron-session | 9.0.1 | 최신 |
| | TanStack Query | 5.104.1 | 최신 |
| | Tailwind CSS | 4.3.3 | 최신 |
| | 구조 | FSD (Feature-Sliced Design) | |
| back-end | NestJS (core / CLI) | 12.1.2 / 12.0.8 | 최신 |
| | TypeORM / @nestjs/typeorm | 1.1.2 / 12.0.2 | 최신 |
| | MariaDB 드라이버 (mysql2) | 3.24.5 | 최신 (TypeORM peer `^3.15.3`) |
| | @nestjs/swagger | 12.0.2 | 최신 |
| 언어 | TypeScript | 6.0.3 | 호환 |
| 린트 | front-end: ESLint / eslint-config-next | 10.12.0 / 16.4.0 | 최신 |
| | back-end: oxlint | 1.87.0 | 최신 (Nest 12 기본 템플릿의 린터) |
| 테스트 | front-end: Vitest / Vite | 5.0.3 / 8.3.4 | 최신 |
| | back-end: Vitest | 5.0.3 | 최신. NestJS 12 CLI가 만든 템플릿의 테스트 도구다. 템플릿은 4를 쓰지만 5로 올렸다 |
| | E2E: Playwright | 1.64.0 | 최신. 로컬에 설치된 Chrome으로 실행한다 |
| API 타입 생성 | @hey-api/openapi-ts | 0.99.0 | 호환. 후보였던 openapi-typescript 7.13은 TypeScript 5만 지원한다 |
| | Testcontainers (MariaDB 모듈) | 12.2.0 | 최신 |
| back-end 라이브러리 | @nestjs/jwt, @nestjs/schedule, @nestjs/terminus, @nestjs/config / @nestjs/throttler | 12.0.2, 12.0.2, 12.1.0, 12.0.1 / 6.7.1 | 최신 |
| | argon2 / prom-client / class-validator / class-transformer | 0.45.1 / 15.1.3 / 0.15.1 / 0.5.1 | 최신 |
| | @types/node | 24.19.1 | 호환. 최신은 26이지만 런타임 Node 24 LTS에 맞춘다 |
| DB | MariaDB | 12.3.3 | LTS (2029-06 지원 종료) |
| OS | Amazon Linux 2023 (arm64, 커널 6.18) | AMI는 SSM 공개 파라미터로 최신 사용 | 사람 결정 ([ADR-0002](../adr/0002-demo-node-os-and-instance.md)). 커널은 최신 LTS |
| IaC | Terraform / AWS provider | 1.16.5 / 6.68.0 | 최신 |
| 클러스터 | k3s | v1.36.5+k3s1 | 호환 |
| 배포 | Argo CD (Helm 차트) | 3.5.4 (argo-cd 10.10.1) | 최신 |
| | Helm CLI | 4.2.1 | 호환 |
| TLS | demo: cert-manager + Let's Encrypt | v1.21.2 | 최신 (Kubernetes 1.33~1.36 지원) |
| | prod: ALB + ACM | AWS 관리형 | |
| 관측 | kube-prometheus-stack | 92.2.0 | 최신 |
| | Prometheus | 3.13.4 | LTS (2027-07 지원 종료) |
| | Grafana | 13.2.3 (grafana 차트 13.4.0) | 최신 (차트 기본값) |
| 보안 | gitleaks (커밋 전 비밀값 검사) | 8.30.1 | 최신 |
| CI / 이미지 저장소 | GitHub Actions / Amazon ECR | — | 사람 결정 ([ADR-0003](../adr/0003-delivery-pipeline.md)) |
| 비밀값 | AWS Secrets Manager + External Secrets Operator | ESO 2.12 (helm-chart-2.12.0) | 최신 (Kubernetes 1.36 지원) |
| AWS | demo: 퍼블릭 EC2 1대 + EIP | t4g.large 스팟 (`use_spot`으로 온디맨드 전환) | 비용 ([ADR-0002](../adr/0002-demo-node-os-and-instance.md)) |
| | prod: ALB + NAT Gateway + 프라이빗 EC2 (코드만, 배포 안 함) | | |

## 최신 버전을 쓰지 않은 항목

| 항목 | 최신 | 채택 | 근거 |
|---|---|---|---|
| Node.js | 26.11.1 (Current) | 24.21.0 | LTS 우선. 26은 2026-10-28에 LTS가 된다 |
| TypeScript | 7.0.2 | 6.0.3 | 호환 우선. `@nestjs/swagger`는 `^5.5 \|\| ^6.0`, `typescript-eslint`는 `<6.1.0`, Nest CLI도 TS `~6.0.2`를 내장한다. Next.js의 TS 7 지원은 실험 플래그(`experimental.useTypeScriptCli`)이고 운영 환경에는 권장되지 않는다 |
| MariaDB | 13.0 (rolling) | 12.3.3 | LTS 우선. rolling은 다음 릴리스로 계속 교체되는 단기 지원 라인이다 |
| k3s | v1.37.1 | v1.36.5 | 호환 우선. Argo CD 3.5가 테스트한 Kubernetes는 v1.33~v1.36이고, k3s stable 채널도 v1.36.5다 |
| Helm CLI | 4.3.0 | 4.2.1 | 호환 우선. Argo CD 3.5.4에 내장된 Helm이 4.2.1이라, 로컬 `helm template` 결과를 Argo CD 렌더링 결과와 맞춘다 |
| openapi-typescript | 7.13.0 | 쓰지 않음 (@hey-api/openapi-ts 0.99.0) | 호환 우선. peerDependencies가 `typescript ^5.x`라 TypeScript 6과 맞지 않는다 |
| Prometheus | 3.15.0 (차트 기본값 3.14.0) | 3.13.4 | LTS 우선. prometheus-operator 0.94.1의 호환 목록에 3.13 라인이 들어 있다. 차트 values에서 이미지 태그를 고정한다 |

## 재검토 일정

2026-10-28에 Node.js 26이 LTS가 되면 전체 의존성의 engine 범위를 다시 확인하고 전환 여부를 정한다. 지금 확인한 주요 의존성(TypeORM, Vitest, Testcontainers, ESLint)은 이미 26을 허용한다.

## 로컬 개발 도구

Node.js 24 LTS, pnpm 12, Docker, Terraform 1.16, Helm 4.2, kubectl, AWS CLI, gitleaks 8.30. 설치·실행 방법은 구현 문서에 정리한다.
