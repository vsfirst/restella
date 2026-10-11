# infra

Restella를 AWS EC2 위의 k3s 클러스터에 배포하는 인프라 코드다. AWS 리소스는 Terraform으로, 클러스터 안의 구성은 Argo CD 기반 GitOps로 관리한다.

- 기술: Terraform, k3s, Helm, Argo CD, Prometheus, Grafana
- 버전: [기술 스택](../docs/2-design/tech-stack.md)
- 네트워크 구성 결정: [ADR-0001](../docs/adr/0001-network-topology.md)
- demo 노드의 OS와 인스턴스 결정: [ADR-0002](../docs/adr/0002-demo-node-os-and-instance.md)
- 배포 파이프라인과 비밀값 전달: [ADR-0003](../docs/adr/0003-delivery-pipeline.md)
- 비밀값 원칙: [보안](../docs/2-design/security.md)

## 환경

| | demo | prod (실무용) |
|---|---|---|
| 목적 | 과제 심사용 실제 배포 | 실무 기준 설계를 코드로 제시 |
| AWS 반영 | **배포함** | **배포하지 않음** (비용 문제로 소스 코드로만 남김) |
| 네트워크 | 퍼블릭 서브넷 1개, EC2에 EIP | 퍼블릭 서브넷 2개(ALB, NAT Gateway), 프라이빗 서브넷 2개(EC2) |
| HTTPS | Traefik + cert-manager + Let's Encrypt | ALB + ACM |
| EC2 노출 | 인터넷에 직접 노출. 보안 그룹으로 80·443만 허용 | 공인 IP 없음. ALB에서 오는 트래픽만 허용 |
| 검증 | 실제 배포와 동작 확인 | `terraform validate`, tflint |

**공통**
- 리전은 서울(`ap-northeast-2`), VPC 대역은 `10.0.0.0/16`이다.
- EC2는 Amazon Linux 2023(arm64, 커널 6.18)이고 k3s 단일 노드로 운영한다. prod는 노드 수를 변수로 둔다.
- demo 노드는 t4g.large 스팟이다. 회수되면 중지되고 다시 켜진다. 꺼지면 안 되는 기간에는 `use_spot = false`로 온디맨드로 바꾼다.
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
│   │   ├── k3s-node/       # EC2(스팟 선택), SSM용 IAM, 데이터 EBS와 일일 스냅샷, k3s 설치 user-data, (demo) EIP
│   │   ├── ecr/            # 앱별 ECR 저장소, 수명 주기 정책
│   │   └── alb/            # ALB, ACM 인증서, 대상 그룹 (prod 전용)
│   ├── envs/
│   │   ├── demo/           # 실제 배포
│   │   └── prod/           # 실무용 설계. 적용하지 않음
│   └── backend.hcl.example # 환경별 backend.hcl 예시 (실제 파일은 커밋 금지)
├── scripts/
│   └── put-demo-secrets.sh # Secrets Manager restella-demo에 비밀값 채우기 (사람이 실행)
└── gitops/                 # Argo CD가 감시하는 디렉토리
    ├── bootstrap/          # Argo CD 설치 values와 환경별 루트 Application (App of Apps)
    ├── apps/
    │   ├── demo/           # 서비스, MariaDB, 모니터링, cert-manager
    │   └── prod/           # 서비스, MariaDB, 모니터링
    ├── charts/             # 자체 Helm 차트: front-end, back-end, mariadb(공식 이미지 기반 StatefulSet)
    └── values/
        ├── demo/           # 환경별 values (kube-prometheus-stack은 단일 노드용으로 경량화)
        └── prod/
```

## 모듈을 둔 이유

- **같은 부품, 다른 설정:** demo와 prod는 같은 부품(`network`, `k3s-node`)을 다른 입력값으로 조립한다. 복사본 두 벌을 두면 한쪽만 고치는 실수로 환경이 어긋난다.
- **배포하지 않는 prod 코드의 신뢰도:** prod가 쓰는 모듈은 demo에서 실제로 배포되어 동작이 확인된 코드다. prod만의 고유 코드는 `alb` 모듈과 NAT 설정으로 좁혀진다.
- **공개 레지스트리 모듈(`terraform-aws-modules` 등)은 쓰지 않는다.** 서브넷과 NAT 구성 같은 판단이 코드에 드러나도록 직접 작성했다.

## demo 노드 구성 (`modules/k3s-node`)

| 항목 | 설정 |
|---|---|
| 인스턴스 | t4g.large, 스팟(`persistent` 요청, 회수 시 `stop`), CPU 크레딧 `standard` |
| AMI | SSM 공개 파라미터 `al2023-ami-kernel-6.18-arm64`. 새 AMI가 나와도 운영 중인 노드는 교체하지 않는다(`ignore_changes`) |
| 디스크 | 루트 gp3 20GiB와 데이터 gp3 10GiB, 모두 암호화. 데이터 볼륨은 인스턴스와 수명을 분리해 k3s 로컬 볼륨 경로(`/var/lib/rancher/k3s/storage`)에 마운트한다 |
| 백업 | Data Lifecycle Manager가 데이터 볼륨을 매일 KST 03:00에 스냅샷하고 7개를 보관한다 |
| 접속 | SSM Session Manager만 쓴다. SSH 키와 22번 포트는 없다 |
| IMDS | IMDSv2만 허용한다. 모듈 기본 홉 제한은 1(Pod가 인스턴스 역할에 접근 불가)이고, demo는 External Secrets Operator를 위해 2로 올린다. 대신 ESO 외 네임스페이스는 NetworkPolicy로 메타데이터 주소를 막는다([아래](#배포-파이프라인과-비밀값-envsdemodeliverytf-secretstf)) |
| k3s | 버전 고정(`v1.36.5+k3s1`), Secret 저장 시 암호화(`secrets-encryption`), kubeconfig 권한 0600 |
| 로그 | 루트 볼륨이 넘치지 않게 상한을 두고, 넘으면 오래된 로그부터 지운다. OS·k3s 로그(journald, AL2023은 rsyslog 없음)는 500MB·14일, 컨테이너 로그는 kubelet이 10Mi × 3개, k3s 내장 containerd 로그(`/var/lib/rancher/k3s/agent/containerd/containerd.log`)는 k3s가 50MB × 3개·28일로 로테이션한다(k3s 코드에 고정). 앞의 둘은 노드가 생길 때 user-data로 설정하므로, 바꾸려면 노드를 교체하거나 SSM으로 직접 고친다 |
| DNS | 호스팅 영역 이름과 그 하위 이름 전체(`*.`)를 노드의 EIP로 보낸다. 영역 자체는 `global`이 관리한다 |

k3s 설치 스크립트는 AL2023을 el8로 잘못 판단해 맞지 않는 SELinux 패키지를 설치하려 한다. 그래서 `INSTALL_K3S_SKIP_SELINUX_RPM=true`로 건너뛴다([ADR-0002](../docs/adr/0002-demo-node-os-and-instance.md)).

## demo 적용 방법

적용 순서는 **bootstrap → global → demo → 비밀값**이다. 뒤 단계가 앞 단계의 리소스를 조회하기 때문이다.
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
cp envs/demo/terraform.tfvars.example envs/demo/terraform.tfvars   # hosted_zone_name, github_repository
terraform -chdir=envs/demo init -backend-config=backend.hcl
terraform -chdir=envs/demo apply

# 4) 비밀값 채우기 (값은 모두 무작위로 만들고 출력하지 않는다)
../scripts/put-demo-secrets.sh

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
| GitHub Actions 역할 | OIDC로만 맡을 수 있다. `github_repository`의 `main` 브랜치만 허용하고 ECR 푸시 권한만 있다 |
| Secrets Manager | `restella-demo`. 값은 Terraform 밖에서 넣는다 |
| 노드 역할 추가 권한 | ECR 토큰 발급과 pull, `restella-demo` 비밀값 읽기. External Secrets Operator가 이 권한을 쓴다 |

- ESO가 Pod에서 노드 역할을 쓰려면 IMDS 홉 제한이 2여야 한다. 대신 ESO를 뺀 모든 네임스페이스는 NetworkPolicy로 메타데이터 주소를 막는다([ADR-0003](../docs/adr/0003-delivery-pipeline.md)).
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
| [`apps/demo/argocd-bootstrap.yaml`](gitops/apps/demo/argocd-bootstrap.yaml) | wave -2. Argo CD가 위 두 파일을 Git과 맞춘다(지우기는 끔) |
| [`apps/demo/external-secrets.yaml`](gitops/apps/demo/external-secrets.yaml) | wave -1. ESO 2.12.0 공식 차트 + [`values/demo/external-secrets.yaml`](gitops/values/demo/external-secrets.yaml) |
| [`apps/demo/cert-manager.yaml`](gitops/apps/demo/cert-manager.yaml) | wave -1. cert-manager v1.21.2 공식 차트 + [`values/demo/cert-manager.yaml`](gitops/values/demo/cert-manager.yaml) |
| [`apps/demo/cluster-config.yaml`](gitops/apps/demo/cluster-config.yaml) | wave 0. [`charts/cluster-config`](gitops/charts/cluster-config): 네임스페이스 `restella`, ClusterSecretStore `aws-secrets-manager`, ECR pull Secret `ecr-pull`(6시간마다 갱신), 인스턴스 메타데이터 차단, Let's Encrypt 발급자(`letsencrypt`, `letsencrypt-staging`), Traefik HTTPS 리디렉션 |

**최초 설치** (`envs/demo`의 노드를 적용하고, gitops 파일을 `main`에 push한 뒤 1회)

```bash
infra/scripts/bootstrap-demo-argocd.sh                 # SSM으로 노드에서 Argo CD 설치 → 클러스터 Secret(레지스트리·도메인) → 루트 Application 등록
PRINT_ONLY=1 infra/scripts/bootstrap-demo-argocd.sh    # 노드에서 실행할 명령만 미리 보기
```

- 앱 Pod는 이미지 pull Secret으로 `ecr-pull`을 쓴다(`imagePullSecrets`). 레지스트리 주소는 ECR 토큰 응답에서 받으므로 Git에 없다.
- Argo CD 관리자 초기 비밀번호는 `argocd-initial-admin-secret`에 있다. 화면 접속 경로(Ingress)는 cert-manager를 구성할 때 정한다.
- 새 네임스페이스를 만들면 `cluster-config`의 `blockInstanceMetadata.namespaces`에 추가한다.
- 모든 Application은 동기화가 실패하면 5번까지 다시 시도한다. 앞 단계가 막 떠서 생기는 일시적 실패(예: cert-manager webhook의 CA 주입 전) 때문이다.

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
- **실제 노드에서 남은 확인:** Let's Encrypt 실제 발급

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

**back-end 차트에 반영할 것**
- k3s의 네트워크 정책 컨트롤러는 새 Pod의 IP를 허용 목록에 넣기까지 시간차가 있어, **막 뜬 Pod의 첫 DB 연결이 실패할 수 있다**(테스트에서 재현).
- API 서버는 NestJS TypeORM 모듈의 기본 재시도(3초 간격 9번)로 버틴다.
- 마이그레이션·시드 Job은 재시도가 없으니 Job의 `backoffLimit`으로 다시 실행되게 한다.

**Argo CD 설정에 반영할 것:** 하위 Application 사이의 sync wave 순서는 Argo CD가 Application의 상태(health)를 판단해야 지켜진다. Argo CD 설치 values(`gitops/bootstrap`)에 Application 상태 판단 설정을 넣는다.

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

1. `infra/terraform/envs/demo`에서 `terraform apply`를 실행한다. VPC, 퍼블릭 서브넷, EC2, EIP, 데이터 EBS가 생기고, user-data가 k3s를 설치한다.
2. 최초 1회만 Helm으로 Argo CD를 설치하고 demo 루트 Application을 등록한다(`gitops/bootstrap`).
3. 이후 배포는 모두 Git으로 한다. Argo CD가 `gitops/apps/demo`를 감시해서 서비스, DB, 모니터링, cert-manager를 동기화한다.
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

## 운영 원칙

- 저장소가 public이므로 비밀값·민감 정보·개인정보는 Git에 절대 두지 않는다. 계정 ID와 state 버킷 이름도 코드에 적지 않고 실행 시점에 읽거나 커밋하지 않는 파일에 둔다.
- 운영 비밀값은 Secrets Manager의 `restella-demo`에 JSON으로 둔다. Terraform은 그릇만 만들고 값은 사람이 직접 넣는다. 클러스터에는 External Secrets Operator가 전달한다.
- 데이터는 EBS 스냅샷으로 보호한다.

## 참고

Grafana Helm 차트는 `grafana-community` 저장소로 옮겨졌다. kube-prometheus-stack 92.2.0도 `oci://ghcr.io/grafana-community/helm-charts`를 참조한다.
