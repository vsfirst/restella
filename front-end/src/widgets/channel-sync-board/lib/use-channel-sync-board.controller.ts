import type { ChannelAvailability, InventoryRow } from '@/shared/api';
import { addDays, enumerateDates } from '@/shared/lib';
import { SYNC_BOARD_DAYS } from '../config';

interface Params {
  roomTypeId: number;
  from: string;
  availability: ChannelAvailability[];
  calendar: InventoryRow[];
}

/** 채널별 재고 (REQ-20): 원장의 남은 재고와 각 채널이 마지막으로 받은 값을 맞대어 본다 */
export function useChannelSyncBoardController({ roomTypeId, from, availability, calendar }: Params) {
  const to = addDays(from, SYNC_BOARD_DAYS - 1);
  const ledger = calendar.find((r) => r.roomTypeId === roomTypeId);
  const cells = new Map(availability.map((a) => [`${a.channelCode}|${a.stayDate}`, a]));
  const pending = availability.filter((a) => !a.inSync).length;
  const href = (p: { roomTypeId?: number; from?: string }) => `/channels?roomTypeId=${p.roomTypeId ?? roomTypeId}&from=${p.from ?? from}`;

  return {
    to,
    dates: enumerateDates(from, to),
    ledgerAvailable: (date: string) => ledger?.days.find((d) => d.stayDate === date)?.available ?? null,
    cellOf: (channelCode: string, date: string) => cells.get(`${channelCode}|${date}`),
    summary: { synced: availability.length - pending, total: availability.length, pending },
    roomTypeHref: (id: number) => href({ roomTypeId: id }),
    prevHref: href({ from: addDays(from, -SYNC_BOARD_DAYS) }),
    nextHref: href({ from: addDays(from, SYNC_BOARD_DAYS) }),
  };
}
