# ADR-0005: 클러스터 부트스트랩과 공통 구성

- 상태: 채택
- 날짜: 2026-10-11

## 맥락

- 배포는 Git 커밋으로만 한다(NFR-06). 그런데 Git을 보고 배포하는 Argo CD 자신은 누군가 처음 한 번 설치해야 한다.
- Kubernetes API(6443)는 밖에 열지 않았다. 노드 접속은 SSM으로만 한다([ADR-0001](0001-network-topology.md)).
- External Secrets Operator(ESO)는 노드 IAM 역할을 쓴다. 그래서 IMDS 홉 제한을 2로 올렸고, 다른 Pod가 노드 역할 자격 증명에 닿지 못하게 막아야 한다([ADR-0003](0003-delivery-pipeline.md)).
- 앱들은 MariaDB → back-end(마이그레이션) → front-end 순서로 떠야 한다.

## 결정 1: Argo CD는 k3s 내장 HelmChart로 설치하고, 그 뒤로는 Argo CD가 스스로 관리한다

| 후보 | 판단 |
|---|---|
| 노드에서 `helm install`을 직접 실행 | 노드에 Helm CLI를 따로 설치해야 하고, 설치 설정이 Git 밖(명령 인자)에 남는다 |
| user-data에 Argo CD 설치를 넣기 | 노드가 생길 때 자동으로 끝난다. 하지만 user-data는 처음 부팅 때만 돌고 Terraform이 변경을 무시하므로(`ignore_changes`), Argo CD 설정을 바꿀 길이 없다 |
| **k3s HelmChart 리소스 + 최초 1회 SSM 적용 + 이후 자기 관리** | **채택.** k3s에 이미 있는 Helm 컨트롤러가 설치·업그레이드를 맡아 노드에 도구를 더 설치하지 않는다. 설치 정의(`bootstrap/demo/argocd.yaml`)가 Git에 있고, 등록 후에는 `argocd-bootstrap` Application이 이 파일을 Git과 맞추므로 Argo CD 설정 변경도 커밋으로 한다 |

- 최초 적용은 [`bootstrap-demo-argocd.sh`](../../infra/scripts/bootstrap-demo-argocd.sh)가 한다. SSM Run Command로 노드에서 공개 저장소의 파일을 받아 적용한다.
- `argocd-bootstrap`은 지우기(prune)를 끈다. 파일을 실수로 지워도 Argo CD 자신이 사라지지 않는다.
- **루트 Application은 Argo CD가 관리하지 않는다.** 처음에는 `argocd-bootstrap`이 루트(`root.yaml`)도 관리했다. 그러자 demo 첫 배포에서 sync wave가 멈췄다. 루트는 wave -2인 `argocd-bootstrap`이 Healthy가 되기를 기다리고, `argocd-bootstrap`은 자기가 관리하는 루트가 Healthy가 되기를 기다렸기 때문이다. 로컬 테스트에서는 GitHub의 `apps/demo`가 비어 있어 루트가 바로 Healthy가 돼 드러나지 않았다. 이제 `argocd-bootstrap`은 `argocd.yaml`만 관리하고, 루트는 부트스트랩 스크립트만 적용한다.
- 설정이 잘못돼 Argo CD가 망가지면 스스로 고칠 수 없다. 이때는 스크립트를 다시 실행해 Git의 정의로 되돌린다.

## 결정 2: App of Apps와 sync wave로 순서를 정한다

루트 Application(`root-demo`)이 `apps/demo`의 하위 Application을 만들고, 하위 Application은 아래 순서로 뜬다.

| wave | Application | 내용 |
|---|---|---|
| -2 | `argocd-bootstrap` | Argo CD 자신의 설치 정의 (루트 Application은 제외) |
| -1 | `external-secrets` | ESO 2.12.0 (CRD 포함) |
| -1 | `cert-manager` | cert-manager v1.21.2 (CRD 포함) |
| 0 | `cluster-config` | 네임스페이스, ClusterSecretStore, ECR pull Secret, 인스턴스 메타데이터 차단, Let's Encrypt 발급자, Traefik HTTPS 리디렉션 |
| 1 | `mariadb` | DB |
| 2 | `back-end` (ApplicationSet) | 마이그레이션·시드 Job, API ([결정 4](#결정-4-git에-둘-수-없는-값은-클러스터-secret-annotation으로-주입한다)) |
| 3 | front-end (ApplicationSet) | 운영자 콘솔 |

- Argo CD 1.8부터 Application의 상태 판단이 기본에서 빠져서, 그대로는 wave를 기다리지 않는다. 공식 문서의 상태 판단 설정을 `argocd-cm`에 넣었다.
- 앞 단계가 Ready가 돼도 바로는 받지 못하는 경우가 있다. 예를 들어 cert-manager webhook은 CA가 주입되기 전 몇 초 동안 요청을 거부한다(테스트에서 재현). 자동 동기화는 기본값으로 실패를 다시 시도하지 않으므로, 모든 Application에 재시도(5회, 10초부터 두 배씩 최대 3분)를 둔다.

## 결정 3: 인스턴스 메타데이터는 네임스페이스마다 NetworkPolicy로 막는다

- Kubernetes NetworkPolicy에는 클러스터 전체 정책이 없다. 그래서 `cluster-config`가 지정한 네임스페이스(`restella`, `argocd`, `kube-system`, `cert-manager`)마다 "169.254.169.254만 빼고 나가는 트래픽 허용" 정책을 둔다. `external-secrets` 네임스페이스는 넣지 않는다.
- 자체 정책이 더 엄격한 Pod(MariaDB: 나가는 트래픽 전부 차단)는 고르지 않는다. NetworkPolicy는 허용 규칙이 합쳐지므로, 고르면 오히려 느슨해진다.
- **한계:** 새 네임스페이스를 만들면 목록에 직접 추가해야 한다. 빠뜨리면 그 네임스페이스의 Pod는 노드 역할(ECR 읽기, `restella-demo` 비밀값 읽기)을 얻을 수 있다.

## 결정 4: Git에 둘 수 없는 값은 클러스터 Secret annotation으로 주입한다

이미지 주소의 ECR 레지스트리(`<계정 ID>.dkr.ecr...`)와 서비스 도메인은 공개 저장소에 두지 않는다([보안](../2-design/security.md)). 그런데 앱 차트는 이 값이 있어야 이미지 주소와 Ingress 호스트를 만들 수 있다.

| 후보 | 판단 |
|---|---|
| Git에 그대로 적기 | 가장 단순하지만 계정 ID와 도메인이 공개된다 |
| k3s 레지스트리 미러로 가짜 주소를 ECR로 돌리기 | 이미지 pull 자격 증명이 미러 주소와 실제 주소 중 어디에 붙는지 containerd 동작에 기대야 해서 불확실하다. 도메인 문제는 풀지 못한다 |
| 정책 엔진(Kyverno 등)으로 이미지 주소를 바꾸기 | 이 문제 하나 때문에 구성 요소가 늘어난다 |
| **클러스터 Secret의 annotation + ApplicationSet 클러스터 생성기** | **채택(사람 결정).** Argo CD 기본 기능만 쓴다. 부트스트랩 스크립트가 Terraform 출력에서 값을 읽어 in-cluster 클러스터 Secret(`cluster-in-cluster`)의 annotation `restella.io/ecr-registry`, `restella.io/domain`에 넣는다. 이 값이 필요한 앱은 Application 대신 ApplicationSet으로 만들어, 템플릿에서 annotation을 Helm 파라미터로 넘긴다 |

- **Git에 남는 것:** 저장소 이름, 태그, 다이제스트, 그리고 "어느 annotation을 쓸지"만 남는다.
- **값이 없을 때:** ApplicationSet은 `missingkey=error`라 annotation이 없으면 Application을 만들지 않는다. 차트도 값이 비면 `required`로 멈춘다.
- **출력에 남지 않게:** Terraform 출력(`ecr_registry`, `domain`, 계정 ID가 든 다른 출력)은 `sensitive`로 둔다. 스크립트 미리 보기에서는 자리표시자로 보인다.
- **순서:** ApplicationSet의 상태는 생성한 Application의 상태를 기다리지 않는다. wave 2(back-end)와 3(front-end) 사이는 순서를 보장하지 않지만, front-end는 back-end가 없어도 뜨고 요청 때 다시 시도하므로 문제없다. DB(1)는 일반 Application이라 back-end보다 먼저 준비된다.

## 검증 (2026-10-11)

대상과 같은 k3s v1.36.5를 Docker 컨테이너로 띄워 확인했다.

- **부트스트랩:** 메타데이터 차단 정책을 먼저 건 상태에서 스크립트가 노드에서 실행할 명령을 그대로 돌렸다. Argo CD 컴포넌트 5개가 32초 만에 떴고, 루트 Application이 GitHub에서 동기화됐다. `argocd-cm`에 상태 판단 설정이 들어갔다.
- **Application 정의:** 5개 모두 서버 검증을 통과했다.
- **ESO:** 2.12.0이 정상 기동했다. AWS 자격 증명이 없는 로컬에서 ClusterSecretStore와 ECR 토큰 생성기는 "EC2 인스턴스 메타데이터에서 역할을 찾지 못함"으로 실패했다. 설정은 맞고 노드 역할을 찾으러 간다는 뜻이다.
- **ECR pull Secret 템플릿:** ESO의 Fake 생성기로 확인했다. `kubernetes.io/dockerconfigjson` 타입이 되고, 레지스트리 주소와 인증값이 올바르게 만들어졌다.
- **메타데이터 차단:** 로컬에는 메타데이터 주소가 없어 테스트 주소 `1.1.1.1/32`로 대신 확인했다. 세 네임스페이스에서 그 주소만 막히고 다른 외부 주소, DNS, 다른 네임스페이스 서비스는 열려 있었다. 제외한 mariadb 레이블 Pod에는 적용되지 않았다.
- **테스트 중 고친 것:**
  - HelmChart 이름이 리소스 이름 앞에 붙어(`argo-cd-argocd-server`) `fullnameOverride: argocd`를 넣었다.
  - 테스트 이미지에서 `k3s kubectl`이 동작하지 않아, 스크립트는 k3s 설치 스크립트가 만드는 `kubectl` 링크를 쓰도록 바꿨다.
- **결정 4:** 가짜 레지스트리·도메인으로 부트스트랩을 다시 돌려 클러스터 Secret을 만들었다. back-end ApplicationSet이 그 값을 파라미터로 넣은 Application을 만들었고, 클러스터 Secret을 만든 뒤에도 Argo CD와 클러스터의 통신은 정상이었다.
- **실제 노드에서 남은 확인:** 노드 역할로 Secrets Manager와 ECR 토큰을 받는지, 실제 169.254.169.254가 막히는지.
