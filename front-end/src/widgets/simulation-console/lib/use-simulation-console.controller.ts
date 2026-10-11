import { useState } from 'react';
import type { RoomType, SimulationRun } from '@/shared/api';
import { addDays, monthDay } from '@/shared/lib';

/** 시뮬레이터 (REQ-19): 방금 실행한 결과가 있으면 그것을, 없으면 최근 결과를 보여준다 */
export function useSimulationConsoleController(roomTypes: RoomType[], runs: SimulationRun[]) {
  const [latest, setLatest] = useState<SimulationRun | null>(null);
  const shown = latest ?? runs.find((r) => r.result) ?? null;
  const codeOf = (id: number) => roomTypes.find((r) => r.id === id)?.code ?? `#${id}`;

  return {
    shown,
    shownRoomTypeCode: shown ? codeOf(shown.roomTypeId) : '',
    channelsHref: shown ? `/channels?roomTypeId=${shown.roomTypeId}&from=${shown.checkIn}` : null,
    onRunDone: setLatest,
    history: runs.map((r) => ({
      ...r,
      condition:
        `${codeOf(r.roomTypeId)} ${monthDay(r.checkIn)}` +
        (addDays(r.checkIn, 1) !== r.checkOut ? `~${monthDay(addDays(r.checkOut, -1))}` : '') +
        (r.prepareRemaining !== null ? ` · 남은 ${r.prepareRemaining}` : '') +
        ` · ${r.requestCount}건`,
    })),
  };
}
