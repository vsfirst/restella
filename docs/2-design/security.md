# 보안: 공개 저장소 원칙

이 저장소는 GitHub에 **public**으로 공개한다. 비밀값, 민감 정보, 개인정보는 **절대** 커밋하지 않는다. 한 번 공개된 값은 커밋을 지워도 이미 복제됐을 수 있으므로, 사후 처리보다 사전 차단을 우선한다.

## 커밋하면 안 되는 것

| 분류 | 예 | 대신 둘 곳 |
|---|---|---|
| 비밀값 | DB 비밀번호, iron-session 키, JWT 서명 키, 채널 API 키·HMAC 키, AWS 자격 증명, kubeconfig, SSH 키, 인증서 개인키 | 운영: AWS Secrets Manager의 `restella-demo` 비밀값([ADR-0003](../adr/0003-delivery-pipeline.md)) / 로컬: `.env` (gitignore) |
| 인프라 식별 정보 | AWS 계정 ID(ECR 레지스트리 주소, IAM ARN 포함), 실제 IP, 도메인, Terraform state 버킷 이름, `*.tfvars` | `*.tfvars`·`backend.hcl`은 gitignore하고 `*.example`만 커밋. state는 S3에만 둔다. 클러스터에 필요한 레지스트리 주소와 도메인은 부트스트랩이 클러스터 Secret annotation으로 넣는다([ADR-0005 결정 4](../adr/0005-cluster-bootstrap.md)). Terraform 출력은 `sensitive`, CI 로그는 계정 ID를 가린다 |
| 개인정보 | 실명, 전화번호, 이메일, 주소, 실제 예약자 정보 | 시드·테스트 데이터는 누가 봐도 가짜인 값만 쓴다 (예: `테스트 손님 1`, `guest1@example.com`, `010-0000-0000`) |
| 작업 환경 정보 | 개인 이메일, 로컬 경로, AI 세션 대화 원문 | 커밋 작성자 이메일은 GitHub noreply 주소를 쓴다. 세션 기록은 정리한 요약만 커밋한다 |

## 차단 장치

1. **`.gitignore`**: `.env*`, `*.tfvars`, `*.tfstate`, `backend.hcl`, kubeconfig, 키·인증서 파일을 제외한다. 예시 파일(`*.example`)만 커밋한다.
2. **커밋 전 검사**: [gitleaks](https://github.com/gitleaks/gitleaks) 8.30.1을 git pre-commit 훅으로 실행한다. 스테이징된 변경에서 비밀값을 찾으면 커밋을 막는다. `.git/hooks`는 Git에 올라가지 않으므로 저장소를 새로 받으면 아래처럼 직접 설치한다.

   ```bash
   brew install gitleaks
   printf '#!/bin/sh\nexec gitleaks git --pre-commit --staged --redact --no-banner\n' > .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```

   작업 트리 전체 검사는 `gitleaks dir . --redact`로 한다.
3. **GitHub secret scanning과 push protection**: 저장소를 만들 때 켰다(2026-10-11). 공개 저장소는 무료다.
4. **런타임 주입**: 운영 비밀값은 실행할 때만 주입한다. Git, 컨테이너 이미지, Helm values에는 값을 넣지 않는다.
5. **front-end 번들 노출 주의**: Next.js의 `NEXT_PUBLIC_*` 환경변수는 브라우저 번들에 그대로 들어간다. 비밀값을 절대 넣지 않는다.
6. **이미지**: 이미지 저장소(ECR)는 비공개지만, 이미지는 여러 곳에 복제될 수 있다. 빌드 인자와 레이어에 비밀값을 넣지 않는다.
7. **CI 자격 증명**: GitHub Actions는 OIDC로 AWS 역할을 맡는다. 장기 액세스 키를 GitHub Secrets에 저장하지 않는다.

## 저장소 쓰기 권한

공개 저장소지만 **소유자 외에는 아무도 쓰거나 고칠 수 없게** 했다(사람 결정, 2026-10-11).

| 설정 | 값 | 막는 것 |
|---|---|---|
| 협업자 | 소유자 1명뿐 | 코드 푸시, 설정 변경 |
| 이슈, 위키, 프로젝트, 토론 | 끔 | 외부 사용자의 글쓰기. 공개 저장소의 위키는 설정에 따라 누구나 고칠 수 있다 |
| 상호작용 제한 | 협업자만, 6개월(2027-04-11 만료) | 외부 사용자의 PR, 댓글, 리뷰. 만료 전에 다시 건다 |
| Actions 기본 토큰 | 읽기 전용, PR 승인 금지 | 워크플로가 의도치 않게 저장소를 고치는 것. 쓰기가 필요한 작업만 워크플로에서 `permissions`로 연다 |
| 외부 기여자 워크플로 | 매번 승인 필요 | 포크 PR이 승인 없이 워크플로를 실행하는 것 |

- **포크는 막을 수 없다.** 공개 저장소는 누구나 포크할 수 있지만, 포크는 원본 저장소를 바꾸지 못한다.
- **라이선스 파일을 두지 않는다.** 라이선스가 없으면 저작권법상 다른 사람에게 수정·재배포 권한이 없다.

```bash
# 상호작용 제한 다시 걸기 (만료 전)
gh api -X PUT repos/vsfirst/restella/interaction-limits -f limit=collaborators_only -f expiry=six_months
```

## 실수로 커밋했을 때

1. **먼저 그 값을 폐기하고 새 값으로 교체한다.** 히스토리에서 지우는 것만으로는 부족하다.
2. 그다음 히스토리에서 제거하고, 원인과 재발 방지책을 [AI 활용 기록](../ai-log.md)에 남긴다.

## AI 작업 규칙

- AI는 커밋 전에 diff에서 위 항목이 있는지 확인한다.
- **AI는 비밀값을 보지 않는다.** 비밀값을 만들고 넣는 작업은 값을 출력하지 않는 스크립트로만 한다([`put-demo-secrets.sh`](../../infra/scripts/put-demo-secrets.sh)). 사람이 요청하면 AI가 스크립트를 실행할 수 있지만, 값은 화면·명령 인자·AI 대화 기록에 남지 않는다. AI의 확인은 키 이름과 길이까지만 한다.
- 사람이 기억해야 하는 값(데모 운영자 비밀번호)은 사람이 AWS CLI로 직접 읽는다.
