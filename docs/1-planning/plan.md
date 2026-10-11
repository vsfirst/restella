# 진행 계획

문서는 단계별 폴더에 둔다.

| 단계 | 폴더 | 산출물 |
|---|---|---|
| 기획 | `docs/1-planning` | 계획, 문제 정의, 범위, 요구사항(ID와 완료 조건) |
| 디자인 | `docs/2-design` | 아키텍처, 기술 스택, 보안, 도메인 모델·ERD, API 명세, 화면 설계(`ui/`, 레포 안에 보관) |
| 개발 | `docs/3-development` | 코딩 규칙, 구현 노트, 코드 리뷰 기록 |
| 테스트 | `docs/4-testing` | 테스트 전략, 결과 보고서, 요구사항 추적표 |

ADR과 AI 활용 기록은 모든 단계에 걸친 문서라 `docs` 바로 아래에 둔다. 단계가 끝나면 Git 태그(`phase-1-planning` 등)를 붙여 진행 순서를 기록한다(아직 태그를 붙이지 않았다).

## 단계

각 단계가 끝나면 사람이 결과를 확인하고 다음 단계로 넘어간다.

| 단계 | 내용 | 산출물 | 사람 확인 | 상태 |
|---|---|---|---|---|
| P0 | 문제 정의와 뼈대 | 디렉토리 뼈대, README, 문제 정의, 범위, 요구사항, 기술 스택, AI 활용 기록, CLAUDE.md | 문제·범위 확정 | 진행 중 (문제 정의 보강, 범위 확정, CLAUDE.md 남음) |
| P1 | 설계 | 도메인 모델·ERD, API 명세, 화면 설계(HTML 목업), ADR | 설계 확정 | 완료 (2026-10-09 확정) |
| P2 | back-end | 재고·예약·취소·중복 처리·충돌 + 불변식 테스트 | 테스트·리뷰 결과 | 구현·테스트 완료, 코드 리뷰 대기 |
| P3 | front-end | 운영자 콘솔 + 시뮬레이터 | 데모 시나리오 | 구현·테스트 완료, 코드 리뷰 대기 |
| P4 | infra | Terraform, k3s, Helm 차트, Argo CD, Grafana, CI | | 진행 중 (P1보다 먼저 시작). Terraform bootstrap·global(Route 53, GitHub OIDC)·demo 모두 적용. 앱별 CI(테스트 → arm64 빌드 → ECR → 다이제스트 커밋), Helm 차트 5개, Argo CD·ESO·cert-manager로 demo 배포 완료(2026-10-11, HTTPS, Application 9개 Synced/Healthy), Prometheus·Grafana 모니터링과 Restella 대시보드. prod 코드, demo 부하·스팟 복구·되돌리기 검증 남음 |
| P5 | 마무리 | 문서 정리, 데모, 회고와 한계 | 제출 전 최종 점검 | |

## P0 체크리스트

- [x] 문제 선정: 멀티채널 판매 숙소의 오버부킹
- [x] 디렉토리 뼈대
- [x] README: 서비스 소개와 전체 구조
- [x] 기술 스택과 버전 선정 ([기술 스택](../2-design/tech-stack.md))
- [x] 문서 구조: README와 docs의 역할 분리
- [ ] 문제 정의 보강: 페르소나, 시나리오, 손실 추정, 가정 목록 ([문제 정의](problem.md))
- [ ] 범위 확정 ([범위](scope.md))
- [x] 문서 구조: 기획·디자인·개발·테스트 단계별 폴더
- [x] 요구사항 확정: ID, 완료 조건, 수치 목표 ([요구사항](requirements.md))
- [ ] CLAUDE.md: AI 협업 규칙
