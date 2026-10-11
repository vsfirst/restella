export class SimulationNightResponseDto {
  /** 숙박일 (YYYY-MM-DD) */
  stayDate: string;

  total: number | null;
  sold: number | null;
  available: number | null;
}

export class SimulationResultResponseDto {
  confirmed: number;
  rejected: number;
  conflicts: number;

  /** 중복 요청이라 처음 결과를 다시 받은 수 */
  duplicates: number;

  /** 응답을 받지 못했거나 예상 밖의 응답 수 */
  errors: number;

  requests: number;
  uniqueRequests: number;
  notifyRequests: number;
  confirmRequests: number;

  /** 요청을 모두 보내고 응답을 받기까지 걸린 시간 */
  durationMs: number;

  /** 실행 후 모든 객실타입·숙박일에서 판매 수 ≤ 총 재고인지 (AC-19-2) */
  invariantOk: boolean;

  /** 판매 수가 총 재고를 넘은 숙박일 수. 0이어야 한다 */
  overbookedNights: number;

  /** 실행 후 대상 객실타입의 숙박일별 재고 */
  nights: SimulationNightResponseDto[];
}

export class SimulationRunResponseDto {
  id: number;
  roomTypeId: number;
  checkIn: string;
  checkOut: string;
  prepareRemaining: number | null;
  requestCount: number;
  notifyRatio: number;
  duplicateRatio: number;

  /** 실행 중이면 null */
  result: SimulationResultResponseDto | null;

  startedAt: Date;
  finishedAt: Date | null;
}

export class ChannelFaultResponseDto {
  /** 재고 동기화 수신을 실패(503)로 응답할 확률 (0~1) */
  failureRate: number;

  /** 응답 지연 (ms) */
  delayMs: number;
}
