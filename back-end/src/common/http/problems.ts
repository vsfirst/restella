import { HttpStatus } from '@nestjs/common';

// 오류 유형 목록. 응답의 type은 urn:restella:problem:<유형>이다 (docs/2-design/api.md "오류 유형")
// 클라이언트는 문구(title·detail)가 아니라 type으로 분기한다. 유형을 추가·변경하면 API 명세의 표도 함께 고친다
export const PROBLEM_TYPES = {
  // 400 입력
  validation: { status: HttpStatus.BAD_REQUEST, title: '입력값이 올바르지 않다' },
  'unknown-room-type': { status: HttpStatus.BAD_REQUEST, title: '알 수 없는 객실타입이다' },
  'same-room-type': { status: HttpStatus.BAD_REQUEST, title: '같은 객실타입으로는 옮길 수 없다' },
  // 401 인증
  unauthorized: { status: HttpStatus.UNAUTHORIZED, title: '운영자 인증이 필요하다' },
  'invalid-credentials': { status: HttpStatus.UNAUTHORIZED, title: '아이디 또는 비밀번호가 올바르지 않다' },
  'invalid-signature': { status: HttpStatus.UNAUTHORIZED, title: '서명이 올바르지 않다' },
  'stale-request': { status: HttpStatus.UNAUTHORIZED, title: '요청 시각이 서버와 5분 넘게 차이 난다' },
  // 404
  'not-found': { status: HttpStatus.NOT_FOUND, title: '대상이 없다' },
  // 409 업무 규칙
  'reservation-not-cancellable': { status: HttpStatus.CONFLICT, title: '거절된 예약은 취소할 수 없다' },
  'reservation-not-in-conflict': { status: HttpStatus.CONFLICT, title: '충돌 상태 예약만 옮길 수 있다' },
  'conflict-already-handled': { status: HttpStatus.CONFLICT, title: '이미 처리된 충돌이다' },
  'insufficient-stock': { status: HttpStatus.CONFLICT, title: '모든 숙박일에 재고가 있지 않다' },
  'total-below-sold': { status: HttpStatus.CONFLICT, title: '판매 수보다 작게 줄일 수 없다' },
  // 422
  'reservation-mismatch': { status: HttpStatus.UNPROCESSABLE_ENTITY, title: '같은 예약번호로 다른 내용이 왔다' },
  // 429·5xx
  'too-many-requests': { status: HttpStatus.TOO_MANY_REQUESTS, title: '요청이 너무 많다' },
  internal: { status: HttpStatus.INTERNAL_SERVER_ERROR, title: '서버 오류' },
  'upstream-failed': { status: HttpStatus.BAD_GATEWAY, title: '내부 호출이 실패했다' },
  'service-unavailable': { status: HttpStatus.SERVICE_UNAVAILABLE, title: '일시적으로 처리할 수 없다' },
} as const satisfies Record<string, { status: HttpStatus; title: string }>;

export type ProblemType = keyof typeof PROBLEM_TYPES;

/** 입력 오류 항목. field는 중첩 필드면 점으로 잇는다 (예: faults.OTA_C) */
export interface FieldError {
  field: string;
  message: string;
}
