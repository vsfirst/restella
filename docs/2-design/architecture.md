# 아키텍처

전체 구성도와 구성 요소별 역할은 [README](../../README.md#시스템-구성)에 있다. 이 문서는 여러 구성 요소에 걸친 흐름을 다룬다. 각 구성 요소의 설계는 해당 디렉토리의 README에 있다.

| 구성 요소 | 설계 문서 |
|---|---|
| front-end | [front-end/README.md](../../front-end/README.md) |
| back-end | [back-end/README.md](../../back-end/README.md) |
| infra | [infra/README.md](../../infra/README.md) |

도메인 모델, ERD, API 명세는 P1에서 별도 문서로 추가한다.

## 요청 흐름

- **운영자 인증:** 운영자가 로그인하면 back-end가 토큰을 발급하고, front-end가 이 토큰을 iron-session 암호화 쿠키에 보관한다. 브라우저 코드는 토큰을 볼 수 없다.
- **운영자 API 호출:** 브라우저의 TanStack Query 요청은 Next.js Route Handler(BFF)를 거쳐 back-end로 간다.
- **페이지 보호:** 세션 검사는 `proxy.ts`가 맡는다.
- **채널 API:** 채널은 back-end의 웹훅 API를 채널별 API 키로 호출한다. 운영자 API와 분리한다.
- **채널 시뮬레이터:** 데모의 채널은 back-end 안의 `simulator` 모듈이다. 실제 채널과 같은 HTTP 계약(예약 웹훅, 재고 동기화 수신)만 쓰고 내부 코드를 직접 부르지 않는다([back-end 설계](../../back-end/README.md#시뮬레이터의-경계)).

## 예약 한 건의 흐름

1. 채널이 back-end 웹훅 API로 예약을 보낸다.
2. back-end가 재고 원장에서 해당 날짜들을 잠그고 남은 수량을 확인한다.
3. 결과를 처리한다.
   - 재고가 있으면 차감하고 예약을 확정한다.
   - 매진이면 채널 유형에 따라 나눈다. 확인형 채널은 거절하고, 통보형 채널은 오버부킹 충돌로 기록한다.
4. 재고가 바뀌면 모든 채널에 남은 수량을 동기화한다.
5. 운영자 콘솔에 예약, 충돌, 이벤트가 반영된다.

동시성과 중복 요청 처리의 세부 설계는 [back-end/README.md](../../back-end/README.md#핵심-설계)에 있다.

## 관측

예약 확정·거절·충돌 건수와 동기화 지연을 Prometheus 지표로 내보내고 Grafana 대시보드로 본다. [문제 정의](../1-planning/problem.md#목표)의 목표 1(충돌 창 축소)과 3(즉시 감지)을 운영 지표로 추적한다.
