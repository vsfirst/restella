# ADR-0003: 앱 배포 파이프라인과 비밀값 전달 방식

- 상태: 채택
- 날짜: 2026-10-09

## 결정

### 1. 배포 흐름

```
GitHub Actions ──(1) 이미지 빌드·푸시──▶ ECR (restella-demo/front-end, restella-demo/back-end)
      │
      └──(2) 이미지 다이제스트(sha256) 커밋──▶ infra/gitops/values/demo ──(3) 변경 감지──▶ Argo CD ──▶ k3s
```

1. GitHub Actions가 이미지를 빌드해 ECR에 푸시한다. 태그는 Git 커밋 SHA다.
2. 푸시한 이미지의 **다이제스트(sha256)**를 `infra/gitops`의 환경별 values에 커밋한다.
3. Argo CD가 커밋을 감지해 클러스터에 반영한다.

| 결정 | 이유 |
|---|---|
| 이미지 저장소는 ECR (사람 결정) | 비공개 저장소라 이미지가 외부에 공개되지 않는다. IAM으로 접근을 제어하고, 푸시할 때 취약점 스캔을 한다 |
| 저장소 이름은 `restella-demo/<앱>` | 사람이 정한 이름 `restella-demo`를 네임스페이스로 쓰고 앱마다 저장소를 나눈다. 앱별로 수명 주기 정책을 적용하고 권한을 나눌 수 있다 |
| 태그 덮어쓰기 금지(IMMUTABLE) | 같은 태그가 다른 이미지를 가리키는 일을 막는다 |
| 배포는 다이제스트로 고정 | Git에 적힌 값과 실제로 실행되는 이미지가 1:1로 대응한다. 롤백은 Git 커밋을 되돌리면 된다 |
| CI는 OIDC로 AWS에 접근 | 장기 액세스 키를 GitHub에 저장하지 않는다. 역할은 지정한 저장소의 `main` 브랜치에서만 맡을 수 있고 ECR 푸시 권한만 있다 |
| 신뢰 조건은 "변경 불가 subject"로 | 이 저장소의 OIDC 토큰 `sub`는 `repo:<owner>@<owner_id>/<name>@<repo_id>:ref:refs/heads/main` 형식이다(GitHub가 새 저장소에 기본으로 켬). 이름이 아닌 ID로 고르므로, 저장소 이름을 바꾸거나 같은 이름으로 다시 만든 저장소가 역할을 맡지 못한다. 처음에는 이름 형식으로 적어 첫 배포가 실패했다(2026-10-11) |
| gitops 커밋은 GitHub 토큰으로 | AWS 권한이 필요 없다. GitHub 기본 토큰으로 만든 커밋은 워크플로를 다시 실행하지 않아 순환이 생기지 않는다 |
| 오래된 이미지 자동 정리 | 앱마다 최근 30개만 보관하고, 태그 없는 이미지는 하루 뒤 삭제한다 |

- GitHub OIDC 공급자는 계정에 하나만 둘 수 있어서 계정 공용 스택인 `global`에 둔다. 처음에는 `bootstrap`에 두었으나, bootstrap의 state는 로컬 파일이라 잃어버리기 쉬워서 S3에 state를 두는 `global`로 옮겼다(2026-10-11, 적용 전).
- 처음 계획은 GHCR이었으나 ECR로 바꿨다.
- 워크플로는 앱별로 나눈다(`demo-front-end.yaml`, `demo-back-end.yaml`, 사람 결정 2026-10-11). 한 저장소에 앱 둘과 infra가 함께 있어서, 바뀐 앱만 테스트·빌드·배포한다. 세부 결정은 [infra 설계](../../infra/README.md#앱-배포-워크플로-githubworkflows)에 있다.
- gitops 값 파일에는 레지스트리 주소를 두지 않는다. 주소에 AWS 계정 ID가 있고 저장소가 공개이기 때문이다. 저장소 이름, 태그, 다이제스트만 적는다.

### 2. 클러스터가 ECR 이미지를 받는 방법

| 후보 | 판단 |
|---|---|
| kubelet용 ECR 자격 증명 도우미(`ecr-credential-provider`) | 기각. k3s는 이 도우미를 지원하지만, 바이너리를 공식 배포 파일로 받을 경로가 없어 직접 빌드해야 한다 |
| 노드에서 주기적으로 `registries.yaml` 갱신 | 기각. ECR 토큰이 12시간마다 만료되는데, k3s는 이 파일을 시작할 때만 읽어서 갱신할 때마다 재시작해야 한다 |
| **External Secrets Operator의 ECR 토큰 생성기** | **채택.** 이미 비밀값 전달에 쓰는 ESO가 노드 역할로 12시간짜리 토큰을 받아 이미지 pull용 Secret을 주기적으로 갱신한다. 노드에 바이너리를 설치할 필요가 없다. demo 노드에서 노드 역할로 `ecr-pull` Secret이 동기화되는 것을 확인했다(2026-10-11) |

### 3. 비밀값: AWS Secrets Manager + External Secrets Operator

- 비밀값 이름은 `restella-demo`(사람 결정)이다. 앱 비밀값을 JSON 하나로 묶어 비용을 줄인다(비밀값 1개당 월 $0.40).
- Terraform은 비밀값의 그릇만 만든다. 값을 Terraform으로 넣으면 state 파일에 평문으로 남기 때문에, **값은 사람이 직접** 넣는다.
- ESO가 비밀값을 읽어 Kubernetes Secret으로 만든다. Git에는 "어떤 비밀값을 가져올지"만 들어간다.

## 결과와 위험

- **노드 권한 노출을 막아야 한다.** ESO는 노드 IAM 역할을 쓴다(k3s에서는 서비스 계정별 IAM 역할을 쓰기 어렵다). 그러려면 Pod가 인스턴스 메타데이터에 닿아야 해서 IMDS 홉 제한을 2로 올렸다. 그 결과 다른 Pod도 노드 권한(ECR 읽기, `restella-demo` 비밀값 읽기, SSM)을 얻을 수 있게 된다.
  - 노드 역할의 권한을 지정한 저장소와 비밀값으로 좁혔다.
  - `cluster-config`가 지정한 네임스페이스(restella, argocd, kube-system, cert-manager)마다 **메타데이터 주소(169.254.169.254)를 막는 NetworkPolicy**를 둔다. 새 네임스페이스는 목록에 직접 추가해야 한다([ADR-0005 결정 3](0005-cluster-bootstrap.md#결정-3-인스턴스-메타데이터는-네임스페이스마다-networkpolicy로-막는다)). k3s는 NetworkPolicy를 기본으로 지원한다. 실제 노드에서 차단되는지는 아직 확인하지 않았다.
- **배포 순서가 정해진다.** bootstrap → global(OIDC 공급자 포함) → demo → 비밀값 → Argo CD 부트스트랩([ADR-0005](0005-cluster-bootstrap.md)) 순으로 적용해야 한다. global은 bootstrap의 버킷에 state를 두고, demo는 global의 OIDC 공급자를 조회하기 때문이다.
- **노드가 ARM(t4g)이다.** 그래서 이미지는 arm64로 빌드한다.
