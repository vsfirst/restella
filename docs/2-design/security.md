# 보안: 공개 저장소 원칙

이 저장소는 GitHub에 **public**으로 공개한다. 비밀값, 민감 정보, 개인정보는 **절대** 커밋하지 않는다. 한 번 공개된 값은 커밋을 지워도 이미 복제됐을 수 있으므로, 사후 처리보다 사전 차단을 우선한다.

## 커밋하면 안 되는 것

| 분류 | 예 | 대신 둘 곳 |
|---|---|---|
| 비밀값 | DB 비밀번호, iron-session 키, JWT 서명 키, 채널 API 키·HMAC 키, AWS 자격 증명, kubeconfig, SSH 키, 인증서 개인키 | 운영: AWS Secrets Manager의 `restella-demo` 비밀값([ADR-0003](../adr/0003-delivery-pipeline.md)) / 로컬: `.env` (gitignore) |
| 인프라 식별 정보 | AWS 계정 ID, 실제 IP, 도메인(공개 결정 전), Terraform state 버킷 이름, `*.tfvars` | `*.tfvars`·`backend.hcl`은 gitignore하고 `*.example`만 커밋. state는 S3에만 둔다 |
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
3. **GitHub secret scanning과 push protection**: 저장소를 만들 때 켠다. 공개 저장소는 무료다.
4. **런타임 주입**: 운영 비밀값은 실행할 때만 주입한다. Git, 컨테이너 이미지, Helm values에는 값을 넣지 않는다.
5. **front-end 번들 노출 주의**: Next.js의 `NEXT_PUBLIC_*` 환경변수는 브라우저 번들에 그대로 들어간다. 비밀값을 절대 넣지 않는다.
6. **이미지**: 이미지 저장소(ECR)는 비공개지만, 이미지는 여러 곳에 복제될 수 있다. 빌드 인자와 레이어에 비밀값을 넣지 않는다.
7. **CI 자격 증명**: GitHub Actions는 OIDC로 AWS 역할을 맡는다. 장기 액세스 키를 GitHub Secrets에 저장하지 않는다.

## 실수로 커밋했을 때

1. **먼저 그 값을 폐기하고 새 값으로 교체한다.** 히스토리에서 지우는 것만으로는 부족하다.
2. 그다음 히스토리에서 제거하고, 원인과 재발 방지책을 [AI 활용 기록](../ai-log.md)에 남긴다.

## AI 작업 규칙

- AI는 커밋 전에 diff에서 위 항목이 있는지 확인한다.
- 실제 비밀값이 필요한 작업(키 생성, Secrets Manager 값 입력 등)은 AI가 값을 다루지 않고 사람이 직접 한다.
