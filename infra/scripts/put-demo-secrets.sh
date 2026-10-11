#!/usr/bin/env bash
# Secrets Manager의 restella-demo에 앱 비밀값을 채운다 (docs/2-design/security.md).
#
# 구조: 비밀값 1개(월 $0.40)에 앱별 키 2개를 둔다. 값은 앱이 받는 환경변수 이름 → 값의 JSON이다.
#   { "fe": { "SESSION_SECRET": "…" },
#     "be": { "DB_PASSWORD": "…", "JWT_SECRET": "…", "OUTBOUND_SIGNING_SECRET": "…",
#             "CHANNEL_SECRETS_JSON": "{\"DIRECT\":\"…\",…}", "SEED_OPERATOR_PASSWORD": "…" } }
#   gitops의 ExternalSecret은 property `be.DB_PASSWORD`처럼 경로로 꺼낸다.
#
# - 없는 키만 새로 만든다. 이미 있는 키는 바꾸지 않는다
#   (MariaDB는 처음 초기화할 때의 DB_PASSWORD를 계속 쓰므로, 값을 바꾸면 back-end가 DB에 접속하지 못한다)
# - 값은 화면, 셸 기록, 명령 인자에 남기지 않는다. 출력은 키 이름뿐이다
# - 모든 값을 무작위로 만든다. 데모 운영자 비밀번호는 아래 명령으로 사람이 직접 읽는다
#   aws secretsmanager get-secret-value --secret-id restella-demo --query SecretString --output text | jq -r .be.SEED_OPERATOR_PASSWORD
#
# 사용: infra/scripts/put-demo-secrets.sh            (AWS 로그인 상태에서)
# 확인: aws secretsmanager get-secret-value --secret-id restella-demo --query SecretString --output text | jq 'map_values(keys)'
set -euo pipefail

SECRET_ID="${SECRET_ID:-restella-demo}"
REGION="${AWS_REGION:-ap-northeast-2}"
CHANNELS=(DIRECT APPROVAL OTA_A OTA_B OTA_C) # back-end 시드의 채널 코드와 같다

# 앱 → 키 목록. 키 이름과 쓰는 곳은 infra/README.md "비밀값 키"와 맞춘다
FE_KEYS=(SESSION_SECRET)
BE_KEYS=(DB_PASSWORD JWT_SECRET OUTBOUND_SIGNING_SECRET CHANNEL_SECRETS_JSON SEED_OPERATOR_PASSWORD)

for cmd in aws jq openssl; do
  command -v "$cmd" > /dev/null || { echo "$cmd 명령이 필요하다" >&2; exit 1; }
done

if ! aws secretsmanager describe-secret --region "$REGION" --secret-id "$SECRET_ID" > /dev/null 2>&1; then
  echo "비밀값 $SECRET_ID 이 없거나 읽을 수 없다. envs/demo를 먼저 적용하고 AWS 로그인 상태를 확인한다" >&2
  exit 1
fi

# 현재 값. 아직 값이 한 번도 들어가지 않았으면 빈 객체에서 시작한다
current=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_ID" \
  --query SecretString --output text 2> /dev/null || echo '{}')
if ! jq -e 'type == "object" and (keys - ["fe", "be"] | length == 0) and ([.[] | type == "object"] | all)' <<< "$current" > /dev/null; then
  echo "현재 값이 {\"fe\":{…},\"be\":{…}} 구조가 아니다. 콘솔에서 확인한다 (값을 덮어쓰지 않았다)" >&2
  exit 1
fi

random_hex() { openssl rand -hex 32; } # 64자. 앱의 최소 길이(32자)를 넘는다

# 사람이 로그인할 때 입력하는 비밀번호라 기호 없이 20자로 만든다
random_password() {
  local out=''
  while [ "${#out}" -lt 20 ]; do
    out+=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9')
  done
  printf '%s' "${out:0:20}"
}

channel_secrets() {
  local json='{}'
  for code in "${CHANNELS[@]}"; do
    json=$(jq -c --arg k "$code" --arg v "$(random_hex)" '. + {($k): $v}' <<< "$json")
  done
  printf '%s' "$json" # 환경변수로 그대로 넘기므로 JSON 문자열로 둔다
}

make_value() {
  case "$1" in
    CHANNEL_SECRETS_JSON) channel_secrets ;;
    SEED_OPERATOR_PASSWORD) random_password ;;
    *) random_hex ;;
  esac
}

updated="$current"
added=()
fill() {
  local app="$1"; shift
  local key value
  for key in "$@"; do
    if jq -e --arg a "$app" --arg k "$key" '.[$a] // {} | has($k)' <<< "$updated" > /dev/null; then
      echo "유지: $app.$key"
      continue
    fi
    value=$(make_value "$key")
    updated=$(jq -c --arg a "$app" --arg k "$key" --arg v "$value" '.[$a] = ((.[$a] // {}) + {($k): $v})' <<< "$updated")
    added+=("$app.$key")
  done
}
fill fe "${FE_KEYS[@]}"
fill be "${BE_KEYS[@]}"

if [ "${#added[@]}" -eq 0 ]; then
  echo "추가할 키가 없다. 바꾸지 않았다"
  exit 0
fi

# 명령 인자로 넘기면 프로세스 목록에 보이므로 권한 600 임시 파일로 넘기고 바로 지운다
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"
printf '%s' "$updated" > "$tmp"
aws secretsmanager put-secret-value --region "$REGION" --secret-id "$SECRET_ID" \
  --secret-string "file://$tmp" > /dev/null

echo "추가: ${added[*]}"
echo "완료: $SECRET_ID 에 새 버전을 저장했다"
