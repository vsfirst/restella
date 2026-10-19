# infra

Restella를 AWS EC2 위의 k3s 클러스터에 배포하는 인프라 코드다. AWS 리소스는 Terraform으로, 클러스터 안의 구성은 Argo CD 기반 GitOps로 관리한다.

- 기술: Terraform, k3s, Helm, Argo CD, External Secrets Operator, cert-manager, Prometheus·Grafana(kube-prometheus-stack), Loki·Alloy(로그)
- 버전: [기술 스택](../docs/2-design/tech-stack.md)
- 네트워크 구성 결정: [ADR-0001](../docs/adr/0001-network-topology.md)
- demo 노드의 OS와 인스턴스 결정: [ADR-0002](../docs/adr/0002-demo-node-os-and-instance.md)
- 배포 파이프라인과 비밀값 전달: [ADR-0003](../docs/adr/0003-delivery-pipeline.md)
- 클러스터 부트스트랩과 공통 구성: [ADR-0005](../docs/adr/0005-cluster-bootstrap.md)
- 직접 써 보는 방법: [demo 사용 안내](../DEMO.md) (demo는 2026-10-19에 내림. 기록용)
- 비밀값 원칙: [보안](../docs/2-design/security.md)

## 환경

| | demo | prod (실무용) |
|---|---|---|
| 목적 | 과제 심사용 실제 배포 | 실무 기준 설계를 코드로 제시 |
| AWS 반영 | **배포 후 정리함** (2026-10-11 배포, 2026-10-19 전부 삭제. [demo 정리](#demo-정리-2026-10-19)) | **배포하지 않음** (비용 문제로 설계만 둔다. 2026-10-11 현재 코드는 작성하지 않았다) |
| 네트워크 | 퍼블릭 서브넷 1개, EC2에 EIP | 퍼블릭 서브넷 2개(ALB, NAT Gateway), 프라이빗 서브넷 2개(EC2) |
| HTTPS | Traefik + cert-manager + Let's Encrypt | ALB + ACM |
| EC2 노출 | 인터넷에 직접 노출. 보안 그룹으로 80·443만 허용 | 공인 IP 없음. ALB에서 오는 트래픽만 허용 |
| 검증 | 실제 배포와 동작 확인 | (코드 작성 후) `terraform validate`, tflint |

**공통**
- 리전은 서울(`ap-northeast-2`), VPC 대역은 `10.0.0.0/16`이다.
- EC2는 Amazon Linux 2023(arm64, 커널 6.18)이고 k3s 단일 노드로 운영한다. prod는 노드 수를 변수로 둘 계획이다(현재 k3s-node 모듈은 노드 1대만 만든다).
- demo 노드는 t4g.large다. 처음에는 스팟으로 운영했지만 회수가 잦아(2026-10-11~13 약 55시간에 49번, 가동률 71%) 2026-10-13부터 **온디맨드**로 운영한다(사람 결정). 스팟 회수 뒤에는 매번 사람 개입 없이 복구됐다([demo 운영 확인](#demo-운영-확인-2026-10-13)).
- 구매 방식(`use_spot`)은 실행 중에 바꿀 수 없어 노드를 교체해야 한다. `use_spot`만 바꾸면 plan에 아무 변경도 나오지 않는다. 실제로 전환한 절차와 영향은 [노드 교체](#노드-교체)에 있다.
- SSH 포트는 열지 않고 SSM Session Manager로 접속한다.
- Kubernetes API(6443)는 외부에 노출하지 않는다.
- 도메인은 Route 53 호스팅 영역을 쓴다. demo는 Let's Encrypt, prod는 ACM이 도메인 소유를 확인해 인증서를 발급한다.

## 디렉토리 구조

```
infra/
├── terraform/
│   ├── bootstrap/          # 최초 1회: Terraform state용 S3 버킷 (자기 state는 로컬)
│   ├── global/             # 계정 공용: Route 53 호스팅 영역(레코드는 각 환경이 관리), GitHub Actions OIDC 공급자
│   ├── modules/
│   │   ├── network/        # VPC, 서브넷, 라우팅, 인터넷 게이트웨이, (선택) NAT Gateway·S3 엔드포인트
│   │   ├── k3s-node/       # EC2(스팟 선택), SSM용 IAM, 데이터 EBS와 일일 스냅샷(선택), k3s 설치 user-data, (demo) EIP
│   │   ├── ecr/            # 앱별 ECR 저장소, 수명 주기 정책
│   │   └── alb/            # (미작성) prod 전용: ALB, ACM 인증서, 대상 그룹
│   ├── envs/
│   │   ├── demo/           # 실제 배포
│   │   └── prod/           # (미작성) 실무용 설계. 적용하지 않음
│   └── backend.hcl.example # 환경별 backend.hcl 예시 (실제 파일은 커밋 금지)
├── scripts/
│   ├── put-demo-secrets.sh     # Secrets Manager restella-demo에 비밀값 채우기 (값은 출력하지 않음)
│   └── bootstrap-demo-argocd.sh # SSM으로 노드에 Argo CD 설치, 클러스터 Secret, 루트 Application 등록 (최초 1회)
└── gitops/                 # Argo CD가 감시하는 디렉토리
    ├── bootstrap/          # Argo CD 설치 정의(k3s HelmChart)와 환경별 루트 Application (스크립트만 적용)
    ├── apps/
    │   ├── demo/           # argocd-bootstrap, external-secrets, cert-manager, cluster-config, mariadb, back-end·front-end·monitoring(ApplicationSet), loki, alloy
    │   └── prod/           # (미작성)
    ├── charts/             # 자체 Helm 차트: cluster-config, front-end, back-end, mariadb(공식 이미지 기반 StatefulSet), monitoring-config
    └── values/
        ├── demo/           # 환경별 values, CI가 쓰는 <앱>-image.yaml
        └── prod/           # (미작성)
```

## 모듈을 둔 이유

- **같은 부품, 다른 설정:** demo와 prod는 같은 부품(`network`, `k3s-node`)을 다른 입력값으로 조립한다. 복사본 두 벌을 두면 한쪽만 고치는 실수로 환경이 어긋난다.
- **배포하지 않는 prod 코드의 신뢰도:** prod가 쓰는 모듈은 demo에서 실제로 배포되어 동작이 확인된 코드다. prod를 작성하면 고유 코드는 `alb` 모듈(미작성)과 network 모듈의 NAT 설정(코드는 있으나 적용한 적 없음)으로 좁혀진다.
- **공개 레지스트리 모듈(`terraform-aws-modules` 등)은 쓰지 않는다.** 서브넷과 NAT 구성 같은 판단이 코드에 드러나도록 직접 작성했다.

## demo 노드 구성 (`modules/k3s-node`)

| 항목 | 설정 |
|---|---|
| 인스턴스 | t4g.large 온디맨드(2026-10-13부터. `use_spot = true`면 스팟 `persistent` 요청, 회수 시 `stop`), CPU 크레딧 `standard` |
| AMI | SSM 공개 파라미터 `al2023-ami-kernel-6.18-arm64`. 새 AMI가 나와도 운영 중인 노드는 교체하지 않는다(`ignore_changes`) |
| 디스크 | 루트 gp3 20GiB와 데이터 gp3 10GiB, 모두 암호화. 데이터 볼륨은 인스턴스와 수명을 분리해 k3s 로컬 볼륨 경로(`/var/lib/rancher/k3s/storage`)에 마운트한다 |
| 백업 | 모듈 기본값은 Data Lifecycle Manager가 데이터 볼륨을 매일 KST 03:00에 스냅샷하고 7개를 보관한다(`enable_snapshots`). **demo는 끈다:** 데이터가 시드로 다시 만들 수 있는 가짜 값이다(사람 결정, 2026-10-15). 그전에 만든 스냅샷도 지웠다 |
| 접속 | SSM Session Manager만 쓴다. SSH 키와 22번 포트는 없다 |
| IMDS | IMDSv2만 허용한다. 모듈 기본 홉 제한은 1(Pod가 인스턴스 역할에 접근 불가)이고, demo는 External Secrets Operator를 위해 2로 올린다. 대신 cluster-config가 지정한 네임스페이스(restella, argocd, kube-system, cert-manager, monitoring)마다 NetworkPolicy로 메타데이터 주소를 막는다. 새 네임스페이스는 직접 추가해야 한다([ADR-0005 결정 3](../docs/adr/0005-cluster-bootstrap.md#결정-3-인스턴스-메타데이터는-네임스페이스마다-networkpolicy로-막는다). demo 노드에서 back-end Pod의 메타데이터 접근이 막히는 것을 확인했다, 2026-10-13) |
| k3s | 버전 고정(`v1.36.5+k3s1`), Secret 저장 시 암호화(`secrets-encryption`), kubeconfig 권한 0600 |
| 로그 | 루트 볼륨이 넘치지 않게 상한을 두고, 넘으면 오래된 로그부터 지운다. OS·k3s 로그(journald, AL2023은 rsyslog 없음)는 500MB·14일, 컨테이너 로그는 kubelet이 10Mi × 3개, k3s 내장 containerd 로그(`/var/lib/rancher/k3s/agent/containerd/containerd.log`)는 k3s가 50MB × 3개·28일로 로테이션한다(k3s 코드에 고정). 앞의 둘은 노드가 생길 때 user-data로 설정하므로, 바꾸려면 노드를 교체하거나 SSM으로 직접 고친다 |
| DNS | 호스팅 영역 이름과 그 하위 이름 전체(`*.`)를 노드의 EIP로 보낸다. 영역 자체는 `global`이 관리한다 |

k3s 설치 스크립트는 AL2023을 el8로 잘못 판단해 맞지 않는 SELinux 패키지를 설치하려 한다. 그래서 `INSTALL_K3S_SKIP_SELINUX_RPM=true`로 건너뛴다([ADR-0002](../docs/adr/0002-demo-node-os-and-instance.md)).

## demo 적용 방법

적용 순서는 **bootstrap → global → demo → 비밀값 → Argo CD 부트스트랩**이다. 뒤 단계가 앞 단계의 리소스를 조회하기 때문이다.
- global은 bootstrap이 만든 S3 버킷에 state를 둔다.
- demo는 global의 GitHub OIDC 공급자와 호스팅 영역을 조회한다.
- 비밀값 스크립트는 demo가 만든 비밀값 그릇에 값을 넣는다.

```bash
cd infra/terraform

# 1) bootstrap (최초 1회): state 버킷. bootstrap 자신의 state는 로컬에 둔다
terraform -chdir=bootstrap init
terraform -chdir=bootstrap apply
terraform -chdir=bootstrap output -raw backend_hcl > global/backend.hcl
cp global/backend.hcl envs/demo/backend.hcl

# 2) global: Route 53 호스팅 영역, GitHub OIDC 공급자
#    이미 있는 영역이면 terraform.tfvars의 existing_hosted_zone_id로 가져온다(plan에 "import"로 표시된다)
cp global/terraform.tfvars.example global/terraform.tfvars   # hosted_zone_name, (있으면) existing_hosted_zone_id
terraform -chdir=global init -backend-config=backend.hcl
terraform -chdir=global apply
terraform -chdir=global output name_servers                  # 상위 도메인의 NS 위임과 같은지 확인

# 3) demo
cp envs/demo/terraform.tfvars.example envs/demo/terraform.tfvars   # hosted_zone_name, github_oidc_subject_prefix
terraform -chdir=envs/demo init -backend-config=backend.hcl
terraform -chdir=envs/demo apply

# 4) 비밀값 채우기 (값은 모두 무작위로 만들고 출력하지 않는다)
../scripts/put-demo-secrets.sh

# 5) Argo CD 부트스트랩 (gitops 파일이 main에 push된 뒤, 최초 1회)
../scripts/bootstrap-demo-argocd.sh

# 노드 접속
$(terraform -chdir=envs/demo output -raw ssm_session_command)
```

ECR과 비밀값만 먼저 만들 수도 있다. 노드 없이 이미지 푸시(CI)와 비밀값 입력을 먼저 확인할 때 쓴다.

```bash
terraform -chdir=envs/demo apply -target=module.ecr -target=aws_secretsmanager_secret.app -target=aws_iam_role_policy.github_actions_push
```

`terraform destroy` 뒤에는 열려 있는 스팟 요청이 남지 않았는지 확인한다.

```bash
aws ec2 describe-spot-instance-requests --filters Name=state,Values=open,active
```

## 배포 파이프라인과 비밀값 (`envs/demo/delivery.tf`, `secrets.tf`)

| 리소스 | 내용 |
|---|---|
| ECR | `restella-demo/front-end`, `restella-demo/back-end`. 태그 덮어쓰기 금지, 푸시할 때 스캔, 최근 30개 보관 |
| GitHub Actions 역할 | OIDC로만 맡을 수 있다. `github_oidc_subject_prefix`(소유자·저장소 ID가 든 변경 불가 subject)의 `main` 브랜치만 허용하고 ECR 푸시 권한만 있다 |
| Secrets Manager | `restella-demo`. 값은 Terraform 밖에서 넣는다 |
| 노드 역할 추가 권한 | ECR 토큰 발급과 pull, `restella-demo` 비밀값 읽기. External Secrets Operator가 이 권한을 쓴다 |

- ESO가 Pod에서 노드 역할을 쓰려면 IMDS 홉 제한이 2여야 한다. 대신 지정한 네임스페이스마다 NetworkPolicy로 메타데이터 주소를 막는다([ADR-0005 결정 3](../docs/adr/0005-cluster-bootstrap.md#결정-3-인스턴스-메타데이터는-네임스페이스마다-networkpolicy로-막는다)).
- 클러스터는 ESO의 ECR 토큰 생성기로 이미지 pull용 Secret을 받는다. 노드에 ECR용 바이너리를 설치하지 않는다.

### 비밀값 키

비밀값은 1개당 월 $0.40이라 `restella-demo` 하나에 앱별 키 2개(`fe`, `be`)를 둔다(사람 결정). 각 키의 값은 그 앱이 받는 **환경변수 이름 → 값**의 JSON이다. gitops의 ExternalSecret은 `be.DB_PASSWORD`처럼 경로로 값을 꺼내 환경변수로 넣는다. 설정값처럼 비밀이 아닌 값(`JWT_TTL_SECONDS`, `SIMULATOR_TARGET_URL` 등)은 Helm values에 둔다.

```json
{
  "fe": { "SESSION_SECRET": "…" },
  "be": { "DB_PASSWORD": "…", "JWT_SECRET": "…", "OUTBOUND_SIGNING_SECRET": "…",
          "CHANNEL_SECRETS_JSON": "{\"DIRECT\":\"…\", …}", "SEED_OPERATOR_PASSWORD": "…" }
}
```

| 경로 | 쓰는 곳 | 만드는 법 |
|---|---|---|
| `fe.SESSION_SECRET` | front-end: iron-session 쿠키 암호화 | 무작위 64자 |
| `be.DB_PASSWORD` | back-end, MariaDB(`MARIADB_PASSWORD`) | 무작위 64자 |
| `be.JWT_SECRET` | back-end: 운영자 토큰 서명 | 무작위 64자 |
| `be.OUTBOUND_SIGNING_SECRET` | back-end: 채널로 보내는 동기화 요청 서명 | 무작위 64자 |
| `be.CHANNEL_SECRETS_JSON` | back-end: 채널 웹훅 서명 검증과 시뮬레이터 서명 | 채널 5개(`DIRECT`, `APPROVAL`, `OTA_A`, `OTA_B`, `OTA_C`)마다 무작위 64자. 환경변수로 그대로 넘기므로 JSON **문자열**이다 |
| `be.SEED_OPERATOR_PASSWORD` | back-end 시드 Job: 데모 운영자 `demo-operator`의 비밀번호 | 무작위 20자(영문·숫자, 로그인할 때 입력하므로 기호 없음) |

[`scripts/put-demo-secrets.sh`](scripts/put-demo-secrets.sh)가 값을 채운다(2026-10-11 입력 완료).
- **없는 키만 만든다.** 이미 있는 키는 바꾸지 않는다. MariaDB는 처음 초기화할 때의 비밀번호를 계속 쓰므로, `be.DB_PASSWORD`를 바꾸면 back-end가 DB에 접속하지 못한다. 키를 나중에 추가해도 다시 실행하면 된다.
- **구조가 다르면 멈춘다.** 현재 값이 `{"fe":{…},"be":{…}}`가 아니면 덮어쓰지 않고 끝낸다.
- **값을 남기지 않는다.** 화면에는 키 이름만 출력한다. 값은 명령 인자가 아니라 권한 600 임시 파일로 AWS CLI에 넘기고 바로 지운다. 그래서 AI가 실행해도 값은 AI의 대화 기록에 남지 않는다([보안](../docs/2-design/security.md#ai-작업-규칙)).

```bash
infra/scripts/put-demo-secrets.sh
# 키 구조 확인 (값은 보이지 않는다)
aws secretsmanager get-secret-value --secret-id restella-demo --query SecretString --output text | jq 'map_values(keys)'
# 데모 운영자 비밀번호 읽기 (사람이 직접)
aws secretsmanager get-secret-value --secret-id restella-demo --query SecretString --output text | jq -r .be.SEED_OPERATOR_PASSWORD
```

## DNS (`global/`)

| 결정 | 이유 |
|---|---|
| 호스팅 영역은 `global` 스택이 소유 | 영역은 demo와 prod가 함께 쓴다. 한 환경의 `destroy`가 영역을 지우면 네임서버가 바뀌어 상위 도메인의 위임이 끊긴다. 영역에는 `prevent_destroy`를 건다 |
| 레코드는 각 환경이 소유 | 레코드 값(EIP, ALB)은 환경의 리소스다. 환경은 영역을 이름으로 조회해 자기 레코드만 만든다 |
| 이미 있는 영역은 가져온다 | 영역을 새로 만들면 네임서버가 바뀐다. `existing_hosted_zone_id`를 주면 `import` 블록으로 기존 영역을 관리 대상으로 가져온다. 영역 ID는 tfvars(커밋 금지)에만 둔다. 영역 설명(comment)은 덮어쓰지 않는다: 기존 운영 메모(위임 출처)를 지키고, 실제 도메인을 코드에 적지 않기 위해서다 |

## 클러스터 안의 이름 (gitops 차트와 맞출 것)

front-end는 `APP_ENV`가 demo·prod이면 back-end를 아래 주소로 부른다(코드에 고정, [front-end 설계](../front-end/README.md#환경변수)).

| 항목 | 값 |
|---|---|
| 네임스페이스 | `restella` |
| back-end Service | `api`, 포트 3000 → 컨테이너 3000 |
| front-end가 부르는 주소 | `http://api.restella.svc.cluster.local:3000` |
| DB 주소 | `mariadb.restella.svc.cluster.local:3306` (Service `mariadb`), 데이터베이스·사용자 `restella` |
| 외부 주소 | 운영자 콘솔 `fe.<도메인>`(front-end), 채널 API·문서 `api.<도메인>`(back-end). 도메인은 클러스터 Secret annotation에서 주입한다 |
| DB에 접속할 수 있는 Pod | 레이블 `app.kubernetes.io/name: back-end` (API 서버와 마이그레이션·시드 Job 모두 붙여야 한다) |

## gitops: 클러스터 구성 (Argo CD, ESO)

결정과 검증: [ADR-0005](../docs/adr/0005-cluster-bootstrap.md).

| 파일 | 내용 |
|---|---|
| [`bootstrap/demo/argocd.yaml`](gitops/bootstrap/demo/argocd.yaml) | Argo CD 설치 정의(k3s HelmChart, argo-cd 10.10.2). Application 상태 판단 설정, SSO·알림 끔, 노드 한 대용 자원 |
| [`bootstrap/demo/root.yaml`](gitops/bootstrap/demo/root.yaml) | 루트 Application `root-demo`. `apps/demo`를 동기화한다 |
| [`apps/demo/argocd-bootstrap.yaml`](gitops/apps/demo/argocd-bootstrap.yaml) | wave -2. Argo CD가 자기 설치 정의(`argocd.yaml`)만 Git과 맞춘다(지우기는 끔). 루트 Application까지 맡기면 서로의 상태를 기다려 멈춘다(ADR-0005) |
| [`apps/demo/external-secrets.yaml`](gitops/apps/demo/external-secrets.yaml) | wave -1. ESO 2.12.0 공식 차트 + [`values/demo/external-secrets.yaml`](gitops/values/demo/external-secrets.yaml) |
| [`apps/demo/cert-manager.yaml`](gitops/apps/demo/cert-manager.yaml) | wave -1. cert-manager v1.21.2 공식 차트 + [`values/demo/cert-manager.yaml`](gitops/values/demo/cert-manager.yaml) |
| [`apps/demo/cluster-config.yaml`](gitops/apps/demo/cluster-config.yaml) | wave 0. [`charts/cluster-config`](gitops/charts/cluster-config): 네임스페이스 `restella`, ClusterSecretStore `aws-secrets-manager`, ECR pull Secret `ecr-pull`(6시간마다 갱신), 인스턴스 메타데이터 차단, Let's Encrypt 발급자(`letsencrypt`, `letsencrypt-staging`), Traefik HTTPS 리디렉션 |

**최초 설치** (`envs/demo`의 노드를 적용하고, gitops 파일을 `main`에 push한 뒤 1회)

```bash
infra/scripts/bootstrap-demo-argocd.sh                 # SSM으로 노드에서 Argo CD 설치 → 클러스터 Secret(레지스트리·도메인) → 루트 Application 등록
PRINT_ONLY=1 infra/scripts/bootstrap-demo-argocd.sh    # 노드에서 실행할 명령만 미리 보기
```

- 앱 Pod는 이미지 pull Secret으로 `ecr-pull`을 쓴다(`imagePullSecrets`). 레지스트리 주소는 ECR 토큰 응답에서 받으므로 Git에 없다.
- Argo CD 관리자 초기 비밀번호는 `argocd-initial-admin-secret`에 있다. Argo CD 화면은 Ingress로 공개하지 않고 SSM 포트 포워딩으로 접속한다.
- 새 네임스페이스를 만들면 `cluster-config`의 `blockInstanceMetadata.namespaces`에 추가한다.
- 모든 Application은 동기화가 실패하면 5번까지 다시 시도한다. 앞 단계가 막 떠서 생기는 일시적 실패(예: cert-manager webhook의 CA 주입 전) 때문이다. demo 첫 배포에서는 cluster-config가 ESO webhook의 엔드포인트가 생기기 전에 동기화돼 한 번 실패했고, 이 재시도로 저절로 회복했다.

### HTTPS: cert-manager + Let's Encrypt + Traefik

| 결정 | 이유 |
|---|---|
| Ingress에 `cert-manager.io/cluster-issuer: letsencrypt`만 붙이면 인증서가 발급·갱신된다 | 앱 차트가 인증서를 직접 다루지 않는다. Secret 이름은 `<앱>-tls` |
| HTTP-01 인증, ACME 계정 이메일 없음 | 노드가 80번을 받으므로 DNS 권한(Route 53 IAM)이 필요 없다. 이메일은 선택 항목이라 공개 저장소에 개인정보를 넣지 않는다 |
| 80번은 모두 HTTPS로 영구 리디렉션 | 콘솔 세션 쿠키가 Secure라 HTTP로는 로그인할 수 없다. Let's Encrypt와 cert-manager의 사전 점검 모두 리디렉션을 따라가고 HTTPS 인증서를 검증하지 않아 HTTP-01과 함께 쓸 수 있다(cert-manager v1.21.2 소스 확인) |
| 리디렉션은 k3s 내장 Traefik의 HelmChartConfig로 | k3s Traefik(차트 40.1.0, Traefik 3.7.13)의 설정을 Git에서 바꾸고, k3s Helm 컨트롤러가 반영한다 |
| 발급 시험은 `letsencrypt-staging` | 실제 발급자는 같은 도메인에 주당 발급 횟수 제한이 있다 |

**검증** (2026-10-11, Traefik을 켠 k3s v1.36.5 테스트 클러스터)
- **HTTP→HTTPS:** HTTP 요청이 301로 HTTPS에 넘어갔다. Traefik 실행 인자에 리디렉션 설정이 들어갔다.
- **인증서 흐름:** 로컬에서는 Let's Encrypt에 접속할 수 없어서, 같은 이름의 자체 서명 발급자로 대신했다. Ingress 표시만으로 `fe.`·`api.` 인증서가 발급됐고, Traefik이 그 인증서로 응답했다. 실제 Let's Encrypt 발급자 2개는 서버 검증만 했다(계정을 만들지 않으려고).
- **경로:** Traefik → 앱 경로가 NetworkPolicy를 통과했다. `api.` 주소에서는 문서와 채널 API(서명 없으면 401)만 열리고 운영자 API·시뮬레이터 수신 주소·`/metrics`·헬스체크는 404였다.
- **demo 노드 (2026-10-11):** 실제 발급자 `letsencrypt`로 `fe.`·`api.` 인증서가 발급됐다.

## gitops: 모니터링 (`apps/demo/monitoring.yaml`, `loki.yaml`, `alloy.yaml`)

| 파일 | 내용 |
|---|---|
| [`apps/demo/monitoring.yaml`](gitops/apps/demo/monitoring.yaml) | ApplicationSet(wave 1). kube-prometheus-stack 92.3.0 + `monitoring-config`. `grafana.<도메인>`과 root_url을 클러스터 Secret annotation에서 넣는다 |
| [`values/demo/monitoring.yaml`](gitops/values/demo/monitoring.yaml) | Prometheus 3.13.4(LTS) 7일·3GB 보관(PVC 5Gi), Alertmanager와 k3s 내장 컴포넌트 수집 끔, Grafana 익명 Viewer·HTTPS |
| [`charts/monitoring-config`](gitops/charts/monitoring-config) | Grafana 관리자 비밀번호(ESO Password 생성기, 한 번만 생성), Restella 대시보드(ConfigMap), Loki NetworkPolicy |
| [`apps/demo/loki.yaml`](gitops/apps/demo/loki.yaml), [`values/demo/loki.yaml`](gitops/values/demo/loki.yaml) | Application(wave 1). grafana-community/loki 18.15.1(Loki 3.7.8) 단일 바이너리, 파일시스템 저장(PVC 3Gi), 7일 보관(compactor). 게이트웨이·캐시·카나리 끔 |
| [`apps/demo/alloy.yaml`](gitops/apps/demo/alloy.yaml), [`values/demo/alloy.yaml`](gitops/values/demo/alloy.yaml) | Application(wave 1). grafana/alloy 1.13.1(Alloy 1.20.1) Deployment 1개. restella 네임스페이스의 컨테이너 로그를 Kubernetes API로 읽어 색상 코드를 지우고 Loki로 보낸다. 레이블: `namespace`, `pod`, `container`, `app` |
| back-end 차트 `monitoring.serviceMonitor` | Prometheus가 back-end `/metrics`를 30초마다 수집. back-end NetworkPolicy가 monitoring의 Prometheus만 3000 포트를 더 허용 |

| 결정 | 이유 |
|---|---|
| Grafana는 익명 읽기 전용(Viewer), 편집은 관리자만 (사람 결정) | 면접관이 계정 없이 대시보드를 본다. 관리자 비밀번호를 나눠 줄 필요가 없다. 대신 대시보드 쿼리로 클러스터 지표(Pod 이름 등)를 누구나 볼 수 있다 |
| 관리자 비밀번호는 ESO Password 생성기로 클러스터 안에서 한 번만(`CreatedOnce`) | 차트 기본값(`prom-operator`)을 쓰지 않는다. Secrets Manager의 `fe`·`be` 구조를 늘리지 않는다. 읽기: `kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' \| base64 -d`. **화면에서 관리자 비밀번호를 바꾸지 않는다:** 사이드카가 이 Secret 값으로 Grafana에 데이터 소스·대시보드 다시 읽기를 요청하므로, 값이 달라지면 새 데이터 소스가 로드되지 않는다(2026-10-13 실제로 겪음). Grafana Pod를 다시 만들면 Secret 값으로 돌아간다 |
| 대시보드는 코드(ConfigMap)로, Grafana 저장소는 두지 않음 | 화면에서 바꾼 내용은 재시작하면 사라진다. 대시보드 변경도 커밋으로 한다 |
| Alertmanager 끔 | 알림을 받을 곳(메일·슬랙)이 없다 |
| k3s 내장 컴포넌트(컨트롤러 매니저·스케줄러·kube-proxy·etcd) 수집 끔 | k3s는 이들을 한 프로세스에 넣어 따로 수집할 수 없다. 켜 두면 수집 실패 경보만 쌓인다 |
| Prometheus 7일·3GB | 데이터 EBS(10GiB)를 MariaDB와 나눠 쓴다 |
| Loki는 오픈소스용 `grafana-community/loki` 차트 | 2026-03에 오픈소스 차트가 이 저장소로 옮겨졌고, `grafana/loki`는 Enterprise(GEL)용 유지보수만 한다 |
| Loki 단일 바이너리 + 파일시스템 | 노드 한 대, 로그 양이 적다. S3를 쓰면 버킷과 권한이 더 필요하다. 단순 확장(SimpleScalable) 모드는 Loki 4에서 없어진다 |
| 로그는 restella 네임스페이스만 | Grafana는 로그인 없이 읽을 수 있고, Viewer도 데이터 소스에 직접 질의할 수 있다. 접속자 IP가 남는 Traefik 접근 로그 등은 모으지 않는다. 앱 로그에는 오류 스택, 요청 경로, 시작 로그만 있고 개인정보는 없다 |
| Alloy는 API로 로그를 읽는 Deployment, 권한은 restella의 Pod·Pod 로그 읽기만 | 노드 디렉토리(hostPath)를 마운트하지 않아 root가 필요 없다(이미지의 alloy 사용자로 실행). 차트 기본 권한에는 클러스터 전체 Secret 읽기가 들어 있어 Role로 바꿨다. 사용 통계 전송은 끈다 |
| Loki로 들어오는 연결은 Alloy·Grafana·Loki 자신만 (NetworkPolicy) | Loki에는 인증이 없다(`auth_enabled: false`) |

**Restella 대시보드 패널:** 확정·거절·오버부킹 충돌(24시간), 채널 동기화 지연 p50/p95(목표 5초), 채널별 동기화 실패(재시도·최종), 경로별 API 응답 시간 p95(목표 300ms), back-end 경고·오류 로그, restella 전체 로그.

**검증 (로컬 k3s v1.36.5, 2026-10-13):** Loki·Alloy를 같은 values로 설치하고 restella 네임스페이스에 로그를 찍는 Pod를 띄웠다.
- `{namespace="restella", app="back-end"} |~ "(WARN|ERROR)"`로 로그가 조회됐고, 색상 코드는 지워졌다.
- default 네임스페이스에도 로그를 찍었지만 Loki의 `namespace` 값은 `restella` 하나뿐이었다.
- Grafana 레이블 Pod에서는 Loki에 질의됐고, 레이블 없는 Pod는 연결이 거부됐다(NetworkPolicy).
- Alloy는 uid 473(alloy)으로 실행되고 경고·오류 로그가 없었다. 메모리는 Loki 약 60MB, Alloy 약 40MB.
- kube-prometheus-stack 92.3.0을 렌더링해 Grafana 데이터 소스에 Loki(`uid: loki`)가 들어가는 것을 확인했다.

**demo 배포 (2026-10-13):** `loki`·`alloy` Application Synced/Healthy, Alloy uid 473, Loki에 restella의 back-end·front-end·mariadb 로그가 들어왔다. 배포하며 문제 3개가 드러났다.
1. **Grafana OOM:** 평상시 약 350Mi인데 한도가 384Mi라, 데이터 소스가 바뀌어 재시작할 때 메모리 부족으로 종료됐다. 한도를 640Mi로 올렸다.
2. **Argo CD application-controller OOM:** 평상시 약 360Mi인데, Loki·Alloy를 처음 동기화할 때 768Mi 한도를 넘었다. 한도를 1Gi로 올렸다(`bootstrap/demo/argocd.yaml`).
3. **Loki 데이터 소스 미로드:** 사이드카의 다시 읽기 요청이 403이었다. Grafana DB의 관리자 비밀번호가 Secret 값과 달라 basic 인증이 실패하고 익명으로 처리됐다. 위 1의 변경으로 Grafana Pod가 새로 만들어지면 Secret 값으로 다시 초기화된다.

## gitops: front-end (`gitops/charts/front-end`)

| 파일 | 내용 |
|---|---|
| [`charts/front-end`](gitops/charts/front-end) | ExternalSecret(wave -1), Deployment, Service `front-end`, Ingress, NetworkPolicy |
| [`values/demo/front-end.yaml`](gitops/values/demo/front-end.yaml) | `APP_ENV=demo`, ExternalSecret 사용, Ingress 사용 |
| `values/demo/front-end-image.yaml` | CI가 쓴다: 저장소, 태그, 다이제스트 |
| [`apps/demo/front-end.yaml`](gitops/apps/demo/front-end.yaml) | ApplicationSet(wave 3). `image.registry`와 `ingress.host`(`fe.<도메인>`, 사람 결정)를 클러스터 Secret annotation에서 넣는다 |

| 결정 | 이유 |
|---|---|
| 비밀 환경변수는 `fe` 객체(`SESSION_SECRET`) | back-end와 같은 방식이다. back-end 주소는 `APP_ENV`로 코드에서 정하므로 환경변수로 받지 않는다 |
| `APP_ENV=demo` | back-end를 클러스터 주소로 부르고, 세션 쿠키에 Secure를 붙인다. 그래서 콘솔은 HTTPS(Ingress)로만 쓸 수 있다 |
| 들어오는 접속은 Ingress 컨트롤러만 | 콘솔은 사람만 쓰고, 클러스터 안에서 부르는 곳이 없다. back-end는 front-end 레이블로 이 Pod의 API 호출을 받는다 |
| 헬스체크는 `/api/health`(프로세스만) | 세션이나 back-end 상태 때문에 콘솔을 재시작하지 않는다 |
| node 사용자(1000), 루트 파일시스템 읽기 전용 | 쓰기는 Next.js 캐시(`/app/.next/cache`)와 `/tmp`(emptyDir)에만 한다 |

**검증** (2026-10-11, k3s v1.36.5 테스트 클러스터)
- **전체 스택 설치:** 로컬에서 빌드한 두 이미지를 넣고 네임스페이스 정책 → MariaDB → back-end → front-end 순서로 설치했다.
- **브라우저 E2E:** front-end를 port-forward로 연결해 Playwright E2E("마지막 1실" 시연 시나리오)를 돌렸고 2개 모두 통과했다. Chrome은 `localhost`에서 Secure 쿠키를 허용해서 `APP_ENV=demo` 그대로 로그인할 수 있다.
- **스크린샷 확인:** 채널별 재고에서 5개 채널 모두 판매 중지를 받았고, 충돌 처리함에 17건이 새로고침 없이 나타났다.
- **차단:** 레이블 없는 Pod는 콘솔에 접속하지 못했다.
- **서버 검증:** demo 값으로 렌더링한 5개 리소스와 ApplicationSet 2개가 서버 검증을 통과했다.

## gitops: back-end (`gitops/charts/back-end`)

| 파일 | 내용 |
|---|---|
| [`charts/back-end`](gitops/charts/back-end) | ExternalSecret(wave -1) → 마이그레이션·시드 Job(Sync 훅, wave 0) → API Deployment(wave 1), Service `api`, Ingress, NetworkPolicy |
| [`values/demo/back-end.yaml`](gitops/values/demo/back-end.yaml) | ExternalSecret 사용, Ingress 사용(cert-manager 발급 표시) |
| `values/demo/back-end-image.yaml` | CI가 쓴다: 저장소, 태그, 다이제스트 |
| [`apps/demo/back-end.yaml`](gitops/apps/demo/back-end.yaml) | ApplicationSet(wave 2). 클러스터 Secret annotation에서 `image.registry`와 `ingress.host`(`api.<도메인>`)를 넣는다 |

| 결정 | 이유 |
|---|---|
| 비밀 환경변수는 `be` 객체를 통째로 Secret으로(`dataFrom.extract`) | 키 이름이 곧 환경변수 이름이다. API는 4개만, 시드 Job만 `SEED_OPERATOR_PASSWORD`를 받는다 |
| 배포마다 마이그레이션 → 시드를 API보다 먼저 | Argo CD Sync 훅(wave 0)이 끝나야 새 API(wave 1)가 뜬다. 시드는 다시 실행해도 안전하다. 실패하면 `backoffLimit`(6)만큼 다시 실행한다(새 Pod의 첫 DB 연결이 네트워크 정책 반영 전에 막힐 수 있다) |
| replicas 1 고정 | 시뮬레이터가 가짜 채널이 받은 재고를 Pod 메모리에 두고, 시드가 가짜 채널 주소를 자기 자신(`http://localhost:3000`)으로 만든다 |
| 밖에는 채널 API와 문서만 연다 | Ingress 경로는 `/api/v1/channel`, `/api/docs`, `/api/docs-json`뿐이다. 운영자 API는 front-end 서버(BFF)만 부르고, 시뮬레이터 수신 주소(`/internal/simulator`)와 `/metrics`는 열지 않는다 |
| 들어오는 접속은 front-end와 Ingress 컨트롤러(Traefik)만 | 나가는 트래픽은 네임스페이스 공통 정책(메타데이터 차단)을 따른다. DB는 MariaDB 정책이 back-end 레이블만 받는다 |
| 준비 상태(readiness)는 DB까지, 생존(liveness)은 프로세스만 | DB 장애로 API를 재시작하지 않는다. 트래픽만 끊는다 |
| node 사용자(1000), 루트 파일시스템 읽기 전용, 권한 제거 | 쓰기는 `/tmp`(emptyDir)에만 한다 |

**검증** (2026-10-11, k3s v1.36.5 테스트 클러스터)
- **설치:** 로컬에서 빌드한 back-end 이미지를 넣고, 네임스페이스 정책 → MariaDB → back-end 순서로 설치했다. 마이그레이션 1개와 시드가 3초에 끝났고 API가 Ready가 됐다.
- **동작:** front-end 레이블 Pod에서 로그인한 뒤 "마지막 1실" 50건 시뮬레이션을 돌렸다. 확정 1, 거절 27, 충돌 17, 중복 5, 초과 판매 0건으로 불변식 검사를 통과했다.
- **차단:** 레이블 없는 Pod는 API에 접속하지 못했다.
- **서버 검증:** demo 값(ExternalSecret·Ingress 켬, 다이제스트)으로 렌더링한 6개 리소스가 서버 검증을 통과했다. 이미지 값 파일이 없으면 차트가 "image.digest나 image.tag가 필요하다"로 멈춘다.

## gitops: MariaDB (`gitops/charts/mariadb`)

공식 이미지 `mariadb:12.3.3`을 그대로 쓰는 단일 인스턴스 StatefulSet이다. 따로 빌드할 이미지가 없어 Dockerfile과 CI가 없다. 스키마는 back-end 이미지의 마이그레이션 Job이 만든다.

| 파일 | 내용 |
|---|---|
| [`charts/mariadb`](gitops/charts/mariadb) | StatefulSet, Service(`mariadb`, 헤드리스), 설정 ConfigMap, ExternalSecret, NetworkPolicy |
| [`values/demo/mariadb.yaml`](gitops/values/demo/mariadb.yaml) | ExternalSecret 사용, 볼륨 2GiB, 메모리 256Mi~512Mi |
| [`apps/demo/mariadb.yaml`](gitops/apps/demo/mariadb.yaml) | Argo CD Application. 네임스페이스 `restella`, sync wave 1 |

| 결정 | 이유 |
|---|---|
| 이미지를 다이제스트로 고정 | 같은 태그가 다른 이미지를 가리키지 않게 한다. 멀티 아키텍처 인덱스 다이제스트라 arm64 노드에서도 맞는 이미지를 받는다 |
| 비밀번호는 `be.DB_PASSWORD`를 ExternalSecret으로 | back-end와 같은 값을 써서 둘이 자동으로 맞는다. ESO 2.12는 `property`를 JSON 경로(gjson)로 읽는다(소스 확인) |
| root는 무작위 비밀번호, Pod 안(localhost)에서만 | root는 쓰지 않는다. 공식 이미지가 첫 초기화 때 생성한 root 비밀번호를 로그에 한 번 찍지만, 원격 접속이 막혀 있어 Pod 안에 들어갈 권한이 없으면 쓸 수 없다 |
| mysql 사용자(999)로 실행, 루트 파일시스템 읽기 전용, 권한(capability) 모두 제거 | 쓰기는 데이터 볼륨과 `/run/mysqld`·`/tmp`(emptyDir)에만 한다 |
| NetworkPolicy: 들어오는 3306은 back-end 레이블 Pod만, 나가는 트래픽은 전부 차단 | DB는 밖으로 나갈 일이 없다. 인스턴스 메타데이터 주소도 함께 막힌다 |
| 볼륨(PVC)은 StatefulSet을 지워도 남김, Application에 삭제 연쇄(finalizer) 없음 | 실수로 Application이나 StatefulSet을 지워도 데이터가 지워지지 않는다. 데이터 볼륨은 매일 EBS 스냅샷된다 |
| 서버 옵션은 로컬 compose와 같게 | utf8mb4, 시간대 UTC(`+00:00`), DNS 역조회 끔 |

**검증** (2026-10-11): 대상과 같은 k3s v1.36.5를 Docker 컨테이너로 띄워 확인했다.
- **설치와 서버 검증:** ESO·Argo CD CRD를 넣고 렌더링 결과와 Application을 서버 검증(dry-run)으로 통과시켰다. 설치 후 22초 만에 Ready가 됐다.
- **접속과 차단:** back-end 레이블 Pod는 접속되고 서버 옵션이 적용됐다. 레이블 없는 Pod는 NetworkPolicy가 연결을 막았고, root 원격 접속은 MariaDB가 거부했다. DB Pod에서 외부로 나가는 연결도 막혔다.
- **보안 설정:** 루트 파일시스템 쓰기가 막히고, 실행 사용자가 999인 것을 확인했다.
- **데이터 유지:** Pod를 지웠다 다시 띄워도 데이터가 남았다.

**back-end 차트에 반영함**
- k3s의 네트워크 정책 컨트롤러는 새 Pod의 IP를 허용 목록에 넣기까지 시간차가 있어, **막 뜬 Pod의 첫 DB 연결이 실패할 수 있다**(테스트에서 재현).
- API 서버는 NestJS TypeORM 모듈의 기본 재시도(3초 간격 9번)로 버틴다.
- 마이그레이션·시드 Job은 재시도가 없어 Job의 `backoffLimit`(6)으로 다시 실행되게 했다.

**Argo CD 설정에 반영함:** 하위 Application 사이의 sync wave 순서는 Argo CD가 Application의 상태(health)를 판단해야 지켜진다. Argo CD 설치 정의(`bootstrap/demo/argocd.yaml`)에 Application 상태 판단 설정을 넣었다.

## Terraform state

- `bootstrap/`이 state용 S3 버킷을 만든다. 버킷 설정은 다음과 같다.
  - 버전 관리, 암호화, 공개 접근 차단
  - HTTPS가 아닌 요청 거부
  - 삭제 방지
  - 이전 버전 90일 후 정리
- 잠금은 S3 네이티브 잠금(`use_lockfile`)을 써서 DynamoDB가 필요 없다.
- bootstrap 자신의 state는 로컬에 둔다. `*.tfstate`는 Git에서 제외된다.
- 버킷 이름에 AWS 계정 ID가 들어가므로 각 환경의 `backend.hcl`은 커밋하지 않는다. 대신 `backend.hcl.example`을 둔다.

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
terraform output -raw backend_hcl > ../global/backend.hcl
cp ../global/backend.hcl ../envs/demo/backend.hcl
```

state 파일 경로(`key`)는 스택마다 다르다: `global/terraform.tfstate`, `demo/terraform.tfstate`.

## 배포 흐름 (demo)

1. `infra/terraform/envs/demo`에서 `terraform apply`를 실행한다. VPC, 퍼블릭 서브넷, EC2, EIP, 데이터 EBS, Route 53 레코드(영역 이름, `*.`)가 생기고, user-data가 k3s를 설치한다.
2. 최초 1회 `infra/scripts/bootstrap-demo-argocd.sh`가 SSM으로 노드에 Argo CD(k3s HelmChart)를 설치하고, 클러스터 Secret(레지스트리·도메인)과 demo 루트 Application을 등록한다. 루트는 이 스크립트만 적용한다.
3. 이후 배포는 모두 Git으로 한다. Argo CD가 `gitops/apps/demo`를 감시해서 Argo CD 자신의 설치 정의, ESO, cert-manager, 클러스터 공통 설정, DB, 서비스를 sync wave 순서로 동기화한다.
4. 코드가 바뀌면 GitHub Actions가 테스트와 이미지 빌드를 하고 ECR에 푸시한다. 그다음 `gitops/values/demo`에 이미지 다이제스트(sha256)를 커밋하고, Argo CD가 이 커밋을 반영한다.

## 앱 배포 워크플로 (`.github/workflows`)

한 저장소에 front-end, back-end, infra가 함께 있어서 워크플로를 앱별로 나눈다. 각 워크플로는 자기 앱 폴더가 바뀔 때만 돈다.

| 워크플로 | 실행 조건 | 테스트 |
|---|---|---|
| [`demo-back-end.yaml`](../.github/workflows/demo-back-end.yaml) | `main`에 `back-end/**` 변경이 들어올 때(push, PR 머지). `*.md`만 바뀌면 제외. 수동 실행 가능 | lint, typecheck, 단위, 통합·E2E(Testcontainers로 실제 MariaDB) |
| [`demo-front-end.yaml`](../.github/workflows/demo-front-end.yaml) | `front-end/**`, 나머지는 위와 같다 | lint, typecheck, 단위. Playwright E2E는 전체 스택이 필요해 로컬에서 돌린다 |

```
test (ubuntu-24.04) → build (ubuntu-24.04-arm): ECR 푸시 → deploy (ubuntu-24.04): infra/gitops/values/demo/<앱>-image.yaml 커밋 → Argo CD
```

| 결정 | 이유 |
|---|---|
| 테스트를 통과해야 빌드한다 | 동시성 불변식(초과 판매 0건)이 깨진 이미지가 배포되지 않게 한다 |
| arm64 러너에서 네이티브 빌드 | demo 노드(t4g)가 arm64다. QEMU 에뮬레이션보다 빠르고, 공개 저장소는 arm64 러너가 무료다 |
| 태그는 커밋 SHA, 배포는 다이제스트 | ECR이 태그 덮어쓰기를 막는다. 같은 커밋을 다시 실행하면 새로 빌드하지 않고 이미 올린 이미지의 다이제스트를 쓴다 |
| 증명(provenance, SBOM)을 붙이지 않는다 | 붙이면 이미지 인덱스와 태그 없는 하위 매니페스트가 생겨 ECR 수명 주기 규칙("태그 없는 이미지 하루 뒤 삭제")과 섞일 수 있다. 단일 매니페스트로 올린다 |
| CI가 고치는 파일을 따로 둔다 | `<앱>-image.yaml`은 CI만 쓰고, 사람이 고치는 values와 섞지 않는다. 앱마다 파일이 달라 두 워크플로가 동시에 커밋해도 충돌하지 않는다(push가 밀리면 rebase 후 최대 5번 다시 시도) |
| 앱별 배포는 한 번에 하나씩, 취소하지 않는다 | 늦게 끝난 오래된 실행이 새 다이제스트를 덮어쓰지 않게 한다(`concurrency`) |
| gitops 커밋은 `GITHUB_TOKEN`으로 | 이 토큰의 커밋은 워크플로를 다시 실행하지 않아 순환이 없다. 쓰기 권한은 deploy job에만 연다 |
| 액션은 커밋 SHA로 고정 | 공개 저장소에서 태그를 바꿔치기하는 공급망 공격을 막는다. 버전은 주석으로 적는다 |

**계정 ID를 공개하지 않는 장치**
- **역할 ARN:** 저장소 Secret `AWS_ROLE_ARN_DEMO`로 받는다. 값은 `terraform output -raw github_actions_role_arn`이다.
- **Actions 로그:** `mask-aws-account-id: true`로 로그에서 계정 ID를 가린다. 공개 저장소의 Actions 로그는 누구나 볼 수 있고, 이 옵션의 기본값은 "가리지 않음"이다.
- **job 사이 값:** 다이제스트만 넘긴다. 레지스트리 주소(`<계정 ID>.dkr.ecr...`)는 넘기지 않는다.
- **gitops 값 파일:** 저장소 이름, 태그, 다이제스트만 적는다. **레지스트리 주소는 Git에 두지 않는다.** 클러스터에서는 부트스트랩이 넣은 클러스터 Secret annotation을 ApplicationSet이 앞에 붙인다([ADR-0005 결정 4](../docs/adr/0005-cluster-bootstrap.md#결정-4-git에-둘-수-없는-값은-클러스터-secret-annotation으로-주입한다)).

```bash
# 역할 ARN을 Secret으로 등록 (값을 화면에 출력하지 않는다)
terraform -chdir=infra/terraform/envs/demo output -raw github_actions_role_arn | gh secret set AWS_ROLE_ARN_DEMO --repo vsfirst/restella
```

## demo 배포 결과 (2026-10-11)

| 항목 | 결과 |
|---|---|
| Terraform | bootstrap·global·envs/demo 적용. 노드(t4g.large 스팟, AL2023 arm64)에서 k3s v1.36.5 Ready, 데이터 볼륨 마운트, 로그 상한 적용 |
| Argo CD | 모든 Application이 Synced/Healthy |
| ESO | 노드 역할로 동작: ClusterSecretStore `aws-secrets-manager` Valid, ECR pull Secret `ecr-pull` 동기화 |
| HTTPS | Let's Encrypt 실제 발급자로 `fe.`·`api.` 인증서 발급. HTTP는 301로 HTTPS 이동 |
| CI | 두 앱 워크플로가 ECR 푸시와 gitops 다이제스트 커밋까지 성공. 공개 로그에 계정 ID 노출 없음 |
| 모니터링 | `grafana.` 도메인에 Let's Encrypt 인증서 발급. 로그인 없이 Restella 대시보드 조회, 익명 편집 시도는 403. Prometheus가 back-end `/metrics` 수집(`up=1`), 예약 결과 지표 확인 |

**배포 중 생긴 문제**
1. **보안 그룹 규칙 설명:** 한글 설명을 AWS가 거부했다. 영문으로 바꾸고 `k3s-node` 모듈 변수에 형식 검사를 넣었다.
2. **첫 CI의 AWS 역할:** OIDC `sub` 형식이 신뢰 조건과 달라 역할을 맡지 못했다. 신뢰 조건을 변경 불가 subject(`github_oidc_subject_prefix`)로 바꿨다.
3. **Argo CD 순환 대기:** `argocd-bootstrap`과 루트가 서로를 기다려 멈췄다([ADR-0005 결정 1](../docs/adr/0005-cluster-bootstrap.md#결정-1-argo-cd는-k3s-내장-helmchart로-설치하고-그-뒤로는-argo-cd가-스스로-관리한다)). Git을 고친 뒤, 노드에서 새 `argocd-bootstrap` 정의를 직접 적용하고 `root-demo`의 `argocd.argoproj.io/tracking-id` annotation을 지워 풀었다.
4. **cluster-config 첫 동기화:** ESO webhook이 준비되기 전이라 실패했고, 재시도로 저절로 회복했다.

**아직 하지 않은 것:** prod 코드, p95 부하 테스트, 이전 커밋으로 되돌리기.

## demo 운영 확인 (2026-10-13)

배포 이틀 뒤 읽기 전용으로 점검했다(`terraform plan`, AWS CLI, SSM으로 노드에서 `kubectl` 조회, 외부 HTTPS 요청).

| 항목 | 결과 |
|---|---|
| Terraform | bootstrap·global·envs/demo 모두 plan "변경 없음". 실제 리소스가 코드와 같다 |
| Argo CD | Application 9개(루트 포함) 모두 Synced/Healthy, 최신 커밋 반영 |
| Pod | 실패한 Pod 없음. ExternalSecret 5개 동기화, 인증서 3개(`fe.`·`api.`·`grafana.`) Ready |
| 외부 접속 | `fe.`는 로그인으로 이동, `/api/health` 정상. `api.`는 채널 API와 API 문서만 공개하고 `/metrics`·운영자 API는 404. HTTP는 301로 HTTPS 이동 |
| 메타데이터 차단 | back-end Pod에서 `169.254.169.254` 접근이 막힌다 |
| 스냅샷 | 데이터 볼륨 스냅샷이 매일 KST 03시 무렵 만들어졌다(10-12, 10-13). 이후 demo에서는 스냅샷을 끄고 지웠다(2026-10-15) |
| 리소스 | 메모리 7.6GiB 중 3.4GiB 사용, 루트 디스크 43%, 데이터 디스크 12% |

**스팟 회수가 잦다.** 모든 Pod의 재시작 횟수가 약 48인데 노드 가동 시간은 2시간 반이었다. 부팅 기록과 CloudTrail(`StopInstances`, 호출자 `InstanceTermination`)로 AWS의 스팟 회수임을 확인했다.
- 약 55시간 동안 49번 회수됐다. 한 번에 평균 45분 켜져 있다가 평균 20분(최대 91분) 꺼졌다. 가동률 71%다.
- 매번 사람 개입 없이 k3s, Argo CD, 앱이 다시 올라왔고 DB 볼륨(PVC)도 그대로다(AC-N07-1).
- 노드가 있는 `ap-northeast-2d`는 조회 시점에 t4g.large 스팟 가격이 가장 낮은 곳이다. 가격이 낮다고 회수가 적은 것은 아니다.

**`use_spot = false`만으로는 아무것도 바뀌지 않는다.** plan이 "변경 없음"이었다. provider가 `instance_market_options`를 계산하는 값으로 다뤄, 블록이 사라져도 차이로 보지 않는다. 실행 중인 인스턴스의 구매 방식은 바꿀 수 없으므로 전환하려면 노드를 교체해야 한다. 모듈에 이를 막는 검사(postcondition)를 넣는 안도 plan으로 확인했지만 코드는 바꾸지 않았다(사람 결정).

### 노드 교체

2026-10-13에 스팟에서 온디맨드로 바꾸며 노드를 교체했다. 실제로 거친 순서는 다음과 같다.
1. persistent 스팟 요청을 먼저 취소했다. 인스턴스만 지우면 요청이 다시 열려 스팟 인스턴스가 또 뜰 수 있어서다.
2. `terraform apply -var use_spot=false -replace=module.k3s_node.aws_instance.node`는 실패했다. 데이터 볼륨을 떼기 전에 인스턴스를 중지하는데(`stop_instance_before_detaching`), 요청이 취소된 스팟 인스턴스는 AWS가 중지를 거부한다(`IncorrectSpotRequestState`). 그 사이 인스턴스는 스팟 회수로 이미 중지돼 있었고, 요청이 취소돼 다시 켤 수도 없었다.
3. 중지된 인스턴스를 직접 종료했다(데이터 볼륨은 `DeleteOnTermination = false`라 남는다). 그 뒤 `use_spot = false`로 `terraform apply`하니 인스턴스 생성, 볼륨 연결, EIP 연결만 하고 삭제는 없었다.
4. `scripts/bootstrap-demo-argocd.sh`를 다시 실행했다. 약 25분 뒤 Application 9개 Synced/Healthy, 인증서 3개 발급, 외부 접속 정상.

다음에 같은 전환을 한다면 스팟 요청을 취소하기 전에 인스턴스를 먼저 중지하거나, 1~3 대신 처음부터 종료 → apply 순서로 한다(시험하지 않음). 교체하면 다음이 일어난다.
- k3s의 클러스터 상태는 루트 볼륨에 있어 **새 클러스터**가 된다. `scripts/bootstrap-demo-argocd.sh`를 다시 실행해야 Argo CD가 나머지를 배포한다.
- 데이터 볼륨과 EIP(공인 IP)는 남는다. 다만 새 클러스터는 PVC를 새로 만들므로 DB는 빈 상태에서 마이그레이션·시드로 다시 시작한다(이전 데이터 디렉토리는 볼륨에 남는다).
- Grafana 관리자 비밀번호처럼 클러스터 안에서 만든 값도 새로 생긴다.
- 인증서는 cert-manager가 다시 발급받는다.

## demo 정리 (2026-10-19)

면접이 끝나 비용이 나오지 않도록 모든 AWS 리소스를 지웠다(사람 결정). 코드는 그대로 남아 [demo 적용 방법](#demo-적용-방법)대로 다시 만들 수 있다.

| 순서 | 대상 | 결과 |
|---|---|---|
| 1 | 인스턴스 중지 (2026-10-15), demo 스냅샷 끄기와 기존 스냅샷 삭제 | `enable_snapshots = false`, 스냅샷 0개 |
| 2 | `envs/demo` destroy | 28개 삭제: EC2·볼륨·EIP, VPC, ECR(이미지 포함), Secrets Manager, IAM 역할, DNS 레코드 |
| 3 | GitHub Actions `demo-back-end`·`demo-front-end` 비활성화 | 역할이 없어 push마다 실패하지 않게 |
| 4 | `global` destroy → 상위 DNS(Cloudflare)의 NS 위임 삭제 | Route 53 영역, GitHub OIDC 공급자 삭제. 영역을 먼저 지워 위임이 지워진 영역을 가리키는 상태가 잠시 생겼다(서브도메인 탈취 위험). 확인 후 Cloudflare API로 NS 레코드 4개를 지우고, Cloudflare 네임서버에서 위임이 사라진 것을 확인했다. **다음에는 위임을 먼저 지운다** |
| 5 | `bootstrap` destroy | state 버킷 삭제 |

- **확인:** 인스턴스·볼륨·EIP·스냅샷·NAT·로드 밸런서·ECR·VPC·Route 53 영역·OIDC 공급자·restella IAM 역할·state 버킷 모두 0개.
- **남은 것:** Secrets Manager `restella-demo`는 7일 복구 기간 뒤(2026-10-26) 자동으로 지워진다.
- **삭제 보호:** `global`의 호스팅 영역과 `bootstrap`의 state 버킷에는 `prevent_destroy`가 있다. 정리할 때만 잠시 끄고 지운 뒤 코드를 되돌렸다.
- **state 버킷:** 버전 관리가 켜져 있어 `force_destroy`가 없으면 `BucketNotEmpty`로 실패한다. 설정 리소스 6개가 먼저 지워진 뒤 실패했다. 그래서 `force_destroy = true`를 버킷에만 `-target`으로 반영하고 다시 destroy했다.
- **다시 만들 때:** bootstrap → global → demo 순서로 적용한 뒤, 상위 DNS에 새 NS를 위임하고, 비밀값을 채우고, Argo CD를 부트스트랩하고, 워크플로를 다시 켠다.

## 운영 원칙

- 저장소가 public이므로 비밀값·민감 정보·개인정보는 Git에 절대 두지 않는다. 계정 ID와 state 버킷 이름도 코드에 적지 않고 실행 시점에 읽거나 커밋하지 않는 파일에 둔다.
- 운영 비밀값은 Secrets Manager의 `restella-demo`에 JSON으로 둔다. Terraform은 그릇만 만들고 값은 사람이 직접 넣는다. 클러스터에는 External Secrets Operator가 전달한다.
- 운영 데이터는 EBS 스냅샷으로 보호한다(모듈 기본값). demo는 가짜 데이터라 스냅샷을 두지 않는다.

## 참고

Grafana와 Loki의 Helm 차트는 `grafana-community` 저장소로 옮겨졌다(Alloy는 `grafana` 저장소에 남아 있다). kube-prometheus-stack 92.3.0도 `oci://ghcr.io/grafana-community/helm-charts`를 참조한다.
