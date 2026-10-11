#!/usr/bin/env bash
# Secrets Manager의 restella-demo에 앱 비밀값을 채운다. 사람이 직접 실행한다 (docs/2-design/security.md).
#
# - 없는 키만 새로 만든다. 이미 있는 키는 바꾸지 않는다
#   (MariaDB는 처음 초기화할 때의 DB_PASSWORD를 계속 쓰므로, 값을 바꾸면 back-end가 DB에 접속하지 못한다)
# - 값은 화면, 셸 기록, 명령 인자에 남기지 않는다. 출력은 키 이름뿐이다
# - SEED_OPERATOR_PASSWORD(데모 운영자 로그인 비밀번호)만 입력받고, 나머지는 무작위로 만든다
#
# 사용: infra/scripts/put-demo-secrets.sh            (AWS 로그인 상태에서)
# 확인: aws secretsmanager get-secret-value --secret-id restella-demo --query SecretString --output text | jq 'keys'
set -euo pipefail

SECRET_ID="${SECRET_ID:-restella-demo}"
REGION="${AWS_REGION:-ap-northeast-2}"
CHANNELS=(DIRECT APPROVAL OTA_A OTA_B OTA_C) # back-end 시드의 채널 코드와 같다

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
echo "$current" | jq -e 'type == "object"' > /dev/null || { echo "현재 값이 JSON 객체가 아니다. 콘솔에서 확인한다" >&2; exit 1; }

random_hex() { openssl rand -hex 32; } # 64자. 앱의 최소 길이(32자)를 넘는다

channel_secrets() {
  local json='{}'
  for code in "${CHANNELS[@]}"; do
    json=$(jq -c --arg k "$code" --arg v "$(random_hex)" '. + {($k): $v}' <<< "$json")
  done
  echo "$json"
}

prompt_operator_password() {
  local first second
  while true; do
    read -rsp "데모 운영자(demo-operator) 비밀번호 (12자 이상): " first; echo >&2
    read -rsp "한 번 더: " second; echo >&2
    if [ "${#first}" -lt 12 ]; then echo "12자 이상이어야 한다" >&2; continue; fi
    if [ "$first" != "$second" ]; then echo "두 값이 다르다" >&2; continue; fi
    printf '%s' "$first"
    return
  done
}

# 키 → 값 만드는 방법. 키 목록과 쓰는 곳은 infra/README.md "비밀값 키"와 맞춘다
KEYS=(DB_PASSWORD JWT_SECRET OUTBOUND_SIGNING_SECRET CHANNEL_SECRETS_JSON SEED_OPERATOR_PASSWORD SESSION_SECRET GRAFANA_ADMIN_PASSWORD)

updated="$current"
added=()
for key in "${KEYS[@]}"; do
  if jq -e --arg k "$key" 'has($k)' <<< "$current" > /dev/null; then
    echo "유지: $key"
    continue
  fi
  case "$key" in
    CHANNEL_SECRETS_JSON) value=$(channel_secrets) ;;
    SEED_OPERATOR_PASSWORD) value=$(prompt_operator_password) ;;
    *) value=$(random_hex) ;;
  esac
  updated=$(jq -c --arg k "$key" --arg v "$value" '. + {($k): $v}' <<< "$updated")
  added+=("$key")
done
unset value

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
