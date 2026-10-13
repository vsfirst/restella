# 요구사항 추적표

요구사항이 설계, 구현, 테스트로 어떻게 이어지는지 보여준다. 테스트 파일 이름은 `back-end/test/`, 단위 테스트는 `back-end/src/` 기준이다. 화면 테스트 `last-room`은 `front-end/e2e/last-room.spec.ts`다. "결과"는 [테스트 결과 보고서](test-report.md)의 마지막 실행 기준이다.

- **진행 상태:** back-end와 front-end를 구현하고 demo에 배포했다(2026-10-11). 남은 인프라 검증은 ⏳로 둔다.
- **표기:** 통과는 ✅, 해당 단계에서 검증 예정은 ⏳이다.

## 기능 요구사항

| 요구사항 | 설계 | 구현 | 테스트 | 결과 |
|---|---|---|---|---|
| REQ-01 숙박일 단위 재고 | [도메인 모델](../2-design/domain-model.md) inventory | `common/time/stay-dates.ts`, `inventory.service.ts` | `stay-dates.spec.ts` AC-01-1·2, `reservation-invariants` AC-01-1·2·3 | ✅ |
| REQ-02 재고 달력 | [API](../2-design/api.md) `GET /inventory`, 화면 S-02 | `inventory.controller.ts` `calendar`, 화면 `widgets/inventory-calendar` | `operator-console` AC-02-1·2 (API), `last-room` 매진 표시 | ✅ |
| REQ-03 총 재고 조정 | API `PATCH /inventory/...`, 화면 S-02a | `inventory.service.ts` `adjustTotal`, 화면 `widgets/inventory-calendar` | `operator-console` AC-03-1·2, `sync` "총 재고 조정도 동기화" (AC-03-3) | ✅ |
| REQ-04 예약 확정 (전부 아니면 전무) | 도메인 모델 "예약 수신" | `reservation.service.ts` `receive` | `reservation-invariants` AC-04-1·2 | ✅ |
| REQ-05 동시 요청에도 초과 판매 없음 | [ADR-0004](../adr/0004-reservation-consistency-and-sync.md) 결정 1 | `inventory.service.ts` `lockNights`(날짜순 `FOR UPDATE`), CHECK 제약 | `reservation-invariants` AC-05-1·2·3 | ✅ |
| REQ-06 확인형: 매진이면 거절 | API 409 `REJECTED` | `receive` | `reservation-invariants` AC-06-1·2 | ✅ |
| REQ-07 통보형: 매진이면 충돌 | API 200 `CONFLICT`, 도메인 모델 conflict | `receive` | `reservation-invariants` AC-07-1·2, `operator-console` AC-13-1 (AC-07-3) | ✅ |
| REQ-08 같은 예약은 한 번만 | ADR-0004 결정 2 | 유일키 + `replay`, `initial_result` 컬럼 | `reservation-invariants` AC-08-1·2·3, 내용이 다른 재전송 422 | ✅ |
| REQ-09 채널 인증 | API "요청 서명" | `common/crypto/signature.ts`, `channel-signature.guard.ts` | `signature.spec.ts`, `channel-auth` AC-09-1·2, 재전송 공격 | ✅ |
| REQ-10 예약 취소 | 도메인 모델 "취소" | `reservation.service.ts` `cancel` | `cancel` AC-10-1·2·3·4, 거절 예약 409, 없는 번호 404 | ✅ |
| REQ-11 모든 채널에 남은 수량 전송 | ADR-0004 결정 3, API "채널 동기화" | `availability-sync.writer.ts`, `sync-dispatcher.ts` | `sync` AC-11-1·2·3 | ✅ |
| REQ-12 동기화 실패 재시도 | ADR-0004 결정 3 | `sync-dispatcher.ts`, `sync-backoff.ts`, 가짜 채널 revision 검사 | `sync-backoff.spec.ts` AC-12-1, `sync` AC-12-1·2·3 | ✅ |
| REQ-13 충돌 처리함 (실시간) | ADR-0004 결정 4 (SSE), 화면 S-04 | `conflict.service.ts` `list`, `event-log.controller.ts` `stream`, 화면 `widgets/conflict-inbox`·`_app/providers/realtime-provider` | `operator-console` AC-13-1, `auth-and-observability` AC-13-2 (SSE), `last-room` 알림·배지 5초 | ✅ |
| REQ-14 충돌 처리 | API `/conflicts/:id/cancel·resolve` | `conflict.service.ts`, 화면 `widgets/conflict-inbox` | `operator-console` AC-14-1·2·3, `last-room` 해결됨(메모 필수)·취소 | ✅ |
| REQ-15 다른 객실타입으로 옮기기 (Could) | API `/conflicts/:id/move` | `reservation.service.ts` `moveConflict` | `operator-console` AC-15-1 | ✅ |
| REQ-16 예약 목록 | API `GET /reservations`, 화면 S-03 | `reservation.controller.ts`, 화면 `widgets/reservation-board` | `operator-console` AC-16-1, 상세 이력, `last-room` 상세 | ✅ |
| REQ-17 이벤트 로그 | 도메인 모델 event_log | `event-log.service.ts`, 화면 `widgets/event-log-table` | `operator-console` AC-17-1, `sync` AC-12-2 (실패 기록), `last-room` 이벤트 확인 | ✅ |
| REQ-18 운영자 로그인 | API `/auth/login`, front-end 인증 흐름 | `auth.service.ts`, `operator-auth.guard.ts`, `front-end/proxy.ts`, BFF `_app/api-routes` | `auth-and-observability` AC-18-1·2, 로그인 시도 제한 429, `last-room` AC-18-1·2·3 | ✅ |
| REQ-19 동시 예약 시뮬레이션 | API `/simulations`, 화면 S-06 | `simulator.service.ts`, 화면 `widgets/simulation-console` | `simulator` AC-19-1·2·3, `last-room` 결과 화면 | ✅ |
| REQ-20 채널별 재고 보기 | API `/channels/availability`, 화면 S-07 | `channel.controller.ts`, 화면 `widgets/channel-sync-board` | `sync` AC-20-1, `last-room` 5개 채널 판매 중지 | ✅ |

## 품질 요구사항

| 요구사항 | 구현·근거 | 테스트 | 결과 |
|---|---|---|---|
| NFR-01 정확성 | `ck_inventory_sold` CHECK 제약 | `reservation-invariants` AC-N01-1 | ✅ |
| NFR-02 응답 시간 | 동기 시뮬레이션, 연결 풀 30 | `simulator` AC-N02-2 (50건 < 10초) | ✅ N02-2 / ⏳ N02-1 (demo 부하 측정) |
| NFR-03 보안 | HMAC 서명, 입력 검증(모르는 필드 거절), gitleaks, `.dockerignore`, 비밀값은 ESO로 실행 시점 주입, Traefik HTTPS 리디렉션 + cert-manager(Let's Encrypt) | `channel-auth` AC-N03-3, demo에서 HTTP 301·인증서 확인(2026-10-11) | ✅ N03-1(검토)·N03-2·N03-3 |
| NFR-04 개인정보 | 스키마에 이름만 있고 연락처 컬럼이 없다. 시드는 가짜 값 | 스키마·시드 검토 | ✅ (검토) |
| NFR-05 관측 | `/metrics` (prom-client), kube-prometheus-stack(Prometheus·Grafana), Restella 대시보드(`charts/monitoring-config`) | `auth-and-observability` AC-N05-1, demo Grafana 확인(2026-10-11) | ✅ 지표·대시보드 |
| NFR-06 배포 | `.github/workflows/demo-*.yaml`이 다이제스트를 `values/demo/*-image.yaml`에 커밋, 차트는 `@sha256:` 참조, Argo CD 자동 동기화(selfHeal) | 2026-10-11 CI 실행과 Argo CD 동기화 | ✅ N06-1 / ⏳ N06-2 (되돌리기) |
| NFR-07 복구 | 스팟 `persistent`·회수 시 `stop`, DLM 일일 스냅샷 7개 보관 (적용됨) | demo 부팅 기록·CloudTrail(49번 회수 후 자동 복구), 스냅샷 목록(2026-10-13) | ✅ N07-1 / ✅ N07-2 생성 · ⏳ 7개 보관 |
| NFR-08 날짜 기준 | DATE를 문자열로 다룸(`dateStrings`), 서울 기준 오늘 계산 | `stay-dates.spec.ts` "서버 시간대와 무관" | ✅ |
