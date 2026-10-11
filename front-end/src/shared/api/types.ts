// 화면에서 쓰는 API 타입. back-end Swagger에서 생성한 타입(generated)에 짧은 이름을 붙인다
import type { endpoints, ParamsOf } from './endpoints';
import type {
  AdjustInventoryResponseDto,
  CancelReservationResponseDto,
  ChannelAvailabilityResponseDto,
  ChannelFaultResponseDto,
  ChannelResponseDto,
  ConflictCancelledResponseDto,
  ConflictItemResponseDto,
  ConflictListResponseDto,
  ConflictMovedResponseDto,
  ConflictResolvedResponseDto,
  EventLogListResponseDto,
  EventLogResponseDto,
  InventoryCalendarResponseDto,
  InventoryDayResponseDto,
  ReservationDetailResponseDto,
  ReservationListResponseDto,
  ReservationResponseDto,
  RoomTypeResponseDto,
  RunSimulationRequestDto,
  SimulationRunResponseDto,
} from './generated';

export type RoomType = RoomTypeResponseDto;

export type InventoryRow = InventoryCalendarResponseDto;
export type InventoryDay = InventoryDayResponseDto;
export type AdjustedInventory = AdjustInventoryResponseDto;

export type Channel = ChannelResponseDto;
export type ChannelType = Channel['type'];
export type ChannelAvailability = ChannelAvailabilityResponseDto;

export type Reservation = ReservationResponseDto;
export type ReservationDetail = ReservationDetailResponseDto;
export type ReservationStatus = Reservation['status'];
export type ReservationPage = ReservationListResponseDto;
/** 예약 목록 필터 (쿼리 문자열 중 페이지 관련 값 제외) */
export type ReservationFilters = Omit<ParamsOf<typeof endpoints.reservationList>, 'cursor' | 'limit'>;
export type CancelledReservation = CancelReservationResponseDto;

export type Conflict = ConflictItemResponseDto;
export type ConflictStatus = Conflict['status'];
export type ConflictList = ConflictListResponseDto;
export type ConflictResolved = ConflictResolvedResponseDto;
export type ConflictMoved = ConflictMovedResponseDto;
export type ConflictCancelled = ConflictCancelledResponseDto;

export type EventLog = EventLogResponseDto;
export type EventType = EventLog['type'];
export type EventPage = EventLogListResponseDto;

export type SimulationRun = SimulationRunResponseDto;
export type SimulationRequest = RunSimulationRequestDto;
export type ChannelFault = ChannelFaultResponseDto;
export type ChannelFaults = Record<string, ChannelFault>;
