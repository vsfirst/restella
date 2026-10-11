#!/usr/bin/env bash
# 목업 HTML을 헤드리스 Chrome으로 열어 ../screenshots에 PNG로 저장한다.
# 사용법: docs/2-design/ui/mockups/capture.sh
set -euo pipefail

cd "$(dirname "$0")"
OUT="../screenshots"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p "$OUT"

# 페이지(쿼리 포함)  출력 파일 이름  창 높이
SHOTS=(
  "login.html                    S-01-login                 760"
  "inventory.html                S-02-inventory             640"
  "inventory.html?modal=adjust   S-02a-inventory-adjust     640"
  "reservations.html             S-03-reservations          720"
  "reservations.html?detail=101  S-03a-reservation-detail   720"
  "conflicts.html                S-04-conflicts             620"
  "conflicts.html?dialog=resolve S-04-conflicts-resolve     620"
  "events.html                   S-05-events                640"
  "simulator.html                S-06-simulator             860"
  "channels.html                 S-07-channels              720"
)

for shot in "${SHOTS[@]}"; do
  read -r page name height <<< "$shot"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size="1440,$height" \
    --virtual-time-budget=5000 \
    --screenshot="$PWD/$OUT/$name.png" "file://$PWD/$page" > /dev/null 2>&1
  echo "$OUT/$name.png"
done
