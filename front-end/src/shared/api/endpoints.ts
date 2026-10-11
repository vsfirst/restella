import type {
  AdjustInventoryRequestDto,
  ChannelControllerAvailabilityData,
  ConflictControllerListData,
  EventLogControllerListData,
  InventoryControllerCalendarData,
  MoveConflictRequestDto,
  ReservationControllerListData,
  ResolveConflictRequestDto,
  RunSimulationRequestDto,
  SetFaultsRequestDto,
  SimulatorControllerListData,
} from './generated';
import { toSearch } from './search';
import type {
  AdjustedInventory,
  CancelledReservation,
  Channel,
  ChannelAvailability,
  ChannelFaults,
  ConflictCancelled,
  ConflictList,
  ConflictMoved,
  ConflictResolved,
  EventPage,
  InventoryRow,
  ReservationDetail,
  ReservationPage,
  RoomType,
  SimulationRun,
} from './types';

// front-end가 부르는 경로를 모두 이곳에서 관리한다 (back-end 전체 목록: docs/3-development/api-reference.md)
// - path: 경로. 인자는 경로 변수(id, 날짜)만 받는다. back-end의 /api/v1 뒤에 붙는다
// - dto.Params: 쿼리 문자열로 보내는 값 / dto.Input: 요청 본문 / dto.Output: 응답
// - 타입은 back-end Swagger에서 생성한 타입(generated)을 쓴다. 손으로 다시 쓰지 않는다
// 서버는 serverFetch(endpoint, options)로 back-end를 직접, 브라우저는 clientFetch(endpoint, options)로 BFF(/api/bff)를 거쳐 부른다

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** 요청·응답 타입 묶음 */
export interface Dto {
  Params?: object;
  Input?: unknown;
  Output: unknown;
}

export interface Endpoint {
  method: Method;
  // 경로 변수는 엔드포인트마다 다르다
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  path: (...args: any[]) => string;
  dto: Dto;
}

/** 타입만 싣는 표시. 런타임에는 빈 객체다 */
export const dto = <T extends Dto>() => ({}) as T;

/** 생성된 요청 타입에서 쿼리 문자열 부분만 꺼낸다 */
type Query<T extends { query?: unknown }> = NonNullable<T['query']>;

export const endpoints = {
  roomTypeList: {
    method: 'GET',
    path: () => '/room-types',
    dto: dto<{ Output: RoomType[] }>(),
  },
  inventoryCalendar: {
    method: 'GET',
    path: () => '/inventory',
    dto: dto<{ Params: Query<InventoryControllerCalendarData>; Output: InventoryRow[] }>(),
  },
  inventoryAdjust: {
    method: 'PATCH',
    path: (roomTypeId: number, stayDate: string) => `/inventory/${roomTypeId}/${stayDate}`,
    dto: dto<{ Input: AdjustInventoryRequestDto; Output: AdjustedInventory }>(),
  },
  channelList: {
    method: 'GET',
    path: () => '/channels',
    dto: dto<{ Output: Channel[] }>(),
  },
  channelAvailability: {
    method: 'GET',
    path: () => '/channels/availability',
    dto: dto<{ Params: Query<ChannelControllerAvailabilityData>; Output: ChannelAvailability[] }>(),
  },
  reservationList: {
    method: 'GET',
    path: () => '/reservations',
    dto: dto<{ Params: Query<ReservationControllerListData>; Output: ReservationPage }>(),
  },
  reservationDetail: {
    method: 'GET',
    path: (id: number) => `/reservations/${id}`,
    dto: dto<{ Output: ReservationDetail }>(),
  },
  reservationCancel: {
    method: 'POST',
    path: (id: number) => `/reservations/${id}/cancel`,
    dto: dto<{ Output: CancelledReservation }>(),
  },
  conflictList: {
    method: 'GET',
    path: () => '/conflicts',
    dto: dto<{ Params: Query<ConflictControllerListData>; Output: ConflictList }>(),
  },
  conflictResolve: {
    method: 'POST',
    path: (id: number) => `/conflicts/${id}/resolve`,
    dto: dto<{ Input: ResolveConflictRequestDto; Output: ConflictResolved }>(),
  },
  conflictMove: {
    method: 'POST',
    path: (id: number) => `/conflicts/${id}/move`,
    dto: dto<{ Input: MoveConflictRequestDto; Output: ConflictMoved }>(),
  },
  conflictCancel: {
    method: 'POST',
    path: (id: number) => `/conflicts/${id}/cancel`,
    dto: dto<{ Output: ConflictCancelled }>(),
  },
  eventList: {
    method: 'GET',
    path: () => '/events',
    dto: dto<{ Params: Query<EventLogControllerListData>; Output: EventPage }>(),
  },
  /** SSE. 브라우저의 EventSource가 직접 연다 (fetch로 부르지 않는다) */
  eventStream: {
    method: 'GET',
    path: () => '/events/stream',
    dto: dto<{ Output: never }>(),
  },
  simulationList: {
    method: 'GET',
    path: () => '/simulations',
    dto: dto<{ Params: Query<SimulatorControllerListData>; Output: SimulationRun[] }>(),
  },
  simulationRun: {
    method: 'POST',
    path: () => '/simulations',
    dto: dto<{ Input: RunSimulationRequestDto; Output: SimulationRun }>(),
  },
  channelFaults: {
    method: 'GET',
    path: () => '/simulations/faults',
    dto: dto<{ Output: ChannelFaults }>(),
  },
  channelFaultsUpdate: {
    method: 'PUT',
    path: () => '/simulations/faults',
    dto: dto<{ Input: SetFaultsRequestDto; Output: ChannelFaults }>(),
  },
} satisfies Record<string, Endpoint>;

export type ParamsOf<E extends Endpoint> = E['dto'] extends { Params: infer P } ? P : never;
export type InputOf<E extends Endpoint> = E['dto'] extends { Input: infer I } ? I : never;
export type OutputOf<E extends Endpoint> = E['dto']['Output'];

/** 호출할 때 넘기는 값: path(경로 변수), params(쿼리 문자열), input(본문). 필요한 것만 요구한다 */
export type RequestOptions<E extends Endpoint> = (Parameters<E['path']> extends [] ? { path?: [] } : { path: Parameters<E['path']> }) &
  (E['dto'] extends { Params: infer P } ? (object extends P ? { params?: P } : { params: P }) : { params?: never }) &
  (E['dto'] extends { Input: infer I } ? { input: I } : { input?: never }) & { signal?: AbortSignal };

/** 넘길 값이 하나도 필수가 아니면 options를 생략할 수 있다 */
export type OptionsArg<E extends Endpoint> = object extends RequestOptions<E> ? [options?: RequestOptions<E>] : [options: RequestOptions<E>];

/** 경로 + 쿼리 문자열 (back-end의 /api/v1 뒤, BFF의 /api/bff 뒤) */
export function toUrl(endpoint: Endpoint, options: { path?: unknown[]; params?: object } = {}): string {
  return endpoint.path(...(options.path ?? [])) + toSearch((options.params ?? {}) as Record<string, unknown>);
}

/** 브라우저가 back-end 경로를 부를 때 붙이는 BFF 접두사 */
export const BFF_PREFIX = '/api/bff';

/** front-end BFF 자체 경로 (back-end로 중계하지 않는다) */
export const authRoutes = {
  login: '/api/auth/login', // POST
  logout: '/api/auth/logout', // POST
};
