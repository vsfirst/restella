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

# 4) 비밀값 채우기 (사람이 실행. 데모 운영자 비밀번호만 입력받는다)
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

`restella-demo`는 아래 키를 가진 JSON 하나다. gitops의 ExternalSecret은 이 키 이름으로 값을 꺼내 각 앱의 환경변수로 넣는다. 설정값처럼 비밀이 아닌 값(`JWT_TTL_SECONDS`, `SIMULATOR_TARGET_URL` 등)은 Helm values에 둔다.

| 키 | 쓰는 곳 | 만드는 법 |
|---|---|---|
| `DB_PASSWORD` | back-end, MariaDB(`MARIADB_PASSWORD`) | 무작위 64자 |
| `JWT_SECRET` | back-end: 운영자 토큰 서명 | 무작위 64자 |
| `OUTBOUND_SIGNING_SECRET` | back-end: 채널로 보내는 동기화 요청 서명 | 무작위 64자 |
| `CHANNEL_SECRETS_JSON` | back-end: 채널 웹훅 서명 검증과 시뮬레이터 서명 | 채널 5개(`DIRECT`, `APPROVAL`, `OTA_A`, `OTA_B`, `OTA_C`)마다 무작위 64자. JSON 문자열 |
| `SEED_OPERATOR_PASSWORD` | back-end 시드 Job: 데모 운영자 `demo-operator`의 비밀번호 | 사람이 입력(12자 이상) |
| `SESSION_SECRET` | front-end: iron-session 쿠키 암호화 | 무작위 64자 |
| `GRAFANA_ADMIN_PASSWORD` | Grafana 관리자 | 무작위 64자 |

[`scripts/put-demo-secrets.sh`](scripts/put-demo-secrets.sh)가 값을 채운다.
- **없는 키만 만든다.** 이미 있는 키는 바꾸지 않는다. MariaDB는 처음 초기화할 때의 비밀번호를 계속 쓰므로, `DB_PASSWORD`를 바꾸면 back-end가 DB에 접속하지 못한다. 키를 나중에 추가해도 다시 실행하면 된다.
- **값을 남기지 않는다.** 화면에는 키 이름만 출력한다. 값은 명령 인자가 아니라 권한 600 임시 파일로 AWS CLI에 넘기고 바로 지운다.
- **AI는 값을 다루지 않는다.** 스크립트는 사람이 실행한다([보안](../docs/2-design/security.md)).

```bash
infra/scripts/put-demo-secrets.sh
aws secretsmanager get-secret-value --secret-id restella-demo --query SecretString --output text | jq 'keys'   # 키 확인
```

## DNS (`global/`)

| 결정 | 이유 |
|---|---|
| 호스팅 영역은 `global` 스택이 소유 | 영역은 demo와 prod가 함께 쓴다. 한 환경의 `destroy`가 영역을 지우면 네임서버가 바뀌어 상위 도메인의 위임이 끊긴다. 영역에는 `prevent_destroy`를 건다 |
| 레코드는 각 환경이 소유 | 레코드 값(EIP, ALB)은 환경의 리소스다. 환경은 영역을 이름으로 조회해 자기 레코드만 만든다 |
| 이미 있는 영역은 가져온다 | 영역을 새로 만들면 네임서버가 바뀐다. `existing_hosted_zone_id`를 주면 `import` 블록으로 기존 영역을 관리 대상으로 가져온다. 영역 ID는 tfvars(커밋 금지)에만 둔다 |

## 클러스터 안의 이름 (gitops 차트와 맞출 것)

front-end는 `APP_ENV`가 demo·prod이면 back-end를 아래 주소로 부른다(코드에 고정, [front-end 설계](../front-end/README.md#환경변수)).

| 항목 | 값 |
|---|---|
| 네임스페이스 | `restella` |
| back-end Service | `api`, 포트 3000 → 컨테이너 3000 |
| front-end가 부르는 주소 | `http://api.restella.svc.cluster.local:3000` |

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

## 운영 원칙

- 저장소가 public이므로 비밀값·민감 정보·개인정보는 Git에 절대 두지 않는다. 계정 ID와 state 버킷 이름도 코드에 적지 않고 실행 시점에 읽거나 커밋하지 않는 파일에 둔다.
- 운영 비밀값은 Secrets Manager의 `restella-demo`에 JSON으로 둔다. Terraform은 그릇만 만들고 값은 사람이 직접 넣는다. 클러스터에는 External Secrets Operator가 전달한다.
- 데이터는 EBS 스냅샷으로 보호한다.

## 참고

Grafana Helm 차트는 `grafana-community` 저장소로 옮겨졌다. kube-prometheus-stack 92.2.0도 `oci://ghcr.io/grafana-community/helm-charts`를 참조한다.
