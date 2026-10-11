#!/usr/bin/env bash
# demo 클러스터에 Argo CD를 처음 한 번 설치하고 루트 Application을 등록한다 (docs/adr/0005-cluster-bootstrap.md).
# 그 뒤의 변경은 모두 Git으로 한다. Argo CD가 자기 설치 정의(bootstrap/demo/argocd.yaml)까지 Git과 맞춘다.
# 루트 Application(root.yaml)은 이 스크립트만 적용한다 (docs/adr/0005-cluster-bootstrap.md 결정 1).
#
# - Kubernetes API는 밖에 열지 않았다. SSM Run Command로 노드에서 k3s kubectl을 실행한다
# - 노드는 공개 저장소의 main 브랜치에서 bootstrap/demo의 파일을 받아 적용한다. 먼저 main에 push돼 있어야 한다
# - 다시 실행해도 안전하다 (kubectl apply)
#
# - Git에 둘 수 없는 값(ECR 레지스트리 주소, 도메인)은 Terraform 출력에서 읽어 Argo CD의 클러스터 Secret annotation으로 넣는다.
#   ApplicationSet이 이 값을 앱 차트에 넘긴다. 화면에는 출력하지 않는다
#
# 사용: infra/scripts/bootstrap-demo-argocd.sh            (AWS 로그인 상태, envs/demo 적용 후)
#       PRINT_ONLY=1 infra/scripts/bootstrap-demo-argocd.sh   (노드에서 실행할 명령 미리 보기. 값은 자리표시자로 나온다)
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-2}"
REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/vsfirst/restella/main}"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

for cmd in aws jq terraform; do
  command -v "$cmd" > /dev/null || { echo "$cmd 명령이 필요하다" >&2; exit 1; }
done

# 클러스터 Secret에 넣을 값. 미리 보기에서는 자리표시자를 쓴다 (환경변수로 바꿔 넣을 수 있다: 로컬 테스트용)
if [ "${PRINT_ONLY:-}" = "1" ]; then
  ECR_REGISTRY="${ECR_REGISTRY:-<ecr-registry>}"
  DOMAIN="${DOMAIN:-<domain>}"
else
  tf_out() { terraform -chdir="$ROOT_DIR/infra/terraform/envs/demo" output -raw "$1"; }
  ECR_REGISTRY="${ECR_REGISTRY:-$(tf_out ecr_registry)}"
  DOMAIN="${DOMAIN:-$(tf_out domain)}"
  # 노드에서 실행할 스크립트와 YAML에 그대로 들어가므로 형식을 엄격히 확인한다
  [[ "$ECR_REGISTRY" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com$ ]] || { echo "ECR 레지스트리 주소 형식이 아니다" >&2; exit 1; }
  [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || { echo "도메인 형식이 아니다" >&2; exit 1; }
fi

# 노드에서 실행할 명령. 출력에 비밀값, 레지스트리 주소, 도메인은 없다 (Argo CD 초기 비밀번호도 출력하지 않는다)
read -r -d '' remote_script << EOF || true
set -euo pipefail
# k3s 설치 스크립트가 만든 kubectl 링크(/usr/local/bin)와 k3s의 관리자 kubeconfig를 쓴다
export PATH="/usr/local/bin:\$PATH" KUBECONFIG=/etc/rancher/k3s/k3s.yaml
base="${REPO_RAW}/infra/gitops/bootstrap/demo"

echo "[1/4] Argo CD 설치 (k3s HelmChart)"
kubectl apply -f "\$base/argocd.yaml"

echo "[2/4] Argo CD 기동 대기"
for i in \$(seq 1 60); do
  kubectl -n argocd get deploy argocd-server > /dev/null 2>&1 && break
  sleep 5
done
for d in argocd-server argocd-repo-server argocd-applicationset-controller argocd-redis; do
  kubectl -n argocd rollout status deploy/\$d --timeout=300s
done
kubectl -n argocd rollout status statefulset/argocd-application-controller --timeout=300s

echo "[3/4] 클러스터 정보 등록: Git에 없는 값을 ApplicationSet에 넘긴다"
kubectl apply -f - << 'YAML'
apiVersion: v1
kind: Secret
metadata:
  name: cluster-in-cluster
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: cluster
    restella.io/environment: demo # apps/demo의 ApplicationSet이 이 레이블로 고른다
  annotations:
    restella.io/ecr-registry: "${ECR_REGISTRY}"
    restella.io/domain: "${DOMAIN}"
stringData:
  name: in-cluster
  server: https://kubernetes.default.svc
  config: '{"tlsClientConfig":{"insecure":false}}'
YAML

echo "[4/4] 루트 Application 등록"
kubectl apply -f "\$base/root.yaml"
sleep 10
kubectl -n argocd get applications.argoproj.io
EOF

# 노드에서 실행할 명령만 보고 끝낸다 (미리 보기, 로컬 테스트용)
if [ "${PRINT_ONLY:-}" = "1" ]; then
  printf '%s\n' "$remote_script"
  exit 0
fi

instance_id=$(terraform -chdir="$ROOT_DIR/infra/terraform/envs/demo" output -raw instance_id)
params=$(jq -n --arg s "$remote_script" '{commands: [$s]}')
command_id=$(aws ssm send-command --region "$REGION" --instance-ids "$instance_id" \
  --document-name AWS-RunShellScript --comment "restella demo: bootstrap Argo CD" \
  --timeout-seconds 900 --parameters "$params" --query 'Command.CommandId' --output text)
echo "SSM 명령 실행: $command_id"

# 끝날 때까지 기다린다 (aws ssm wait는 최대 100초라 직접 확인한다)
while true; do
  status=$(aws ssm get-command-invocation --region "$REGION" --command-id "$command_id" \
    --instance-id "$instance_id" --query Status --output text 2> /dev/null || echo Pending)
  case "$status" in
    Pending | InProgress | Delayed) sleep 10 ;;
    *) break ;;
  esac
done

aws ssm get-command-invocation --region "$REGION" --command-id "$command_id" --instance-id "$instance_id" \
  --query '[StandardOutputContent, StandardErrorContent]' --output text
echo "결과: $status"
[ "$status" = "Success" ]
