'use client';

import type { RoomType, SimulationRun } from '@/shared/api';
import { buttonClass, ErrorText, inputClass } from '@/shared/ui';
import { useRunSimulationController } from '../lib/use-run-simulation.controller';

interface Props {
  roomTypes: RoomType[];
  defaultCheckIn: string;
  onDone: (run: SimulationRun) => void;
}

/** "마지막 1실" 동시 예약 실행 조건 (S-06, REQ-19) */
export function RunSimulationForm(props: Props) {
  const { form, set, setRequestCount, datesValid, pending, error, submit } = useRunSimulationController(props);

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
      <h2 className="font-semibold">실행 조건</h2>
      <label className="mt-4 block text-xs text-slate-500" htmlFor="sim-room">
        객실타입
      </label>
      <select id="sim-room" value={form.roomTypeId} onChange={(e) => set('roomTypeId', Number(e.target.value))} className={`mt-1 ${inputClass}`}>
        {props.roomTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {rt.name} ({rt.code})
          </option>
        ))}
      </select>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500" htmlFor="sim-in">
            체크인
          </label>
          <input id="sim-in" type="date" value={form.checkIn} onChange={(e) => set('checkIn', e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label className="block text-xs text-slate-500" htmlFor="sim-out">
            체크아웃
          </label>
          <input id="sim-out" type="date" value={form.checkOut} onChange={(e) => set('checkOut', e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
      </div>
      <label className="mt-3 block text-xs text-slate-500" htmlFor="sim-prepare">
        실행 전 남은 재고 맞추기 (비우면 지금 재고 그대로)
      </label>
      <input
        id="sim-prepare"
        type="number"
        min={0}
        max={100}
        value={form.prepareRemaining}
        onChange={(e) => set('prepareRemaining', e.target.value)}
        className={`mt-1 ${inputClass}`}
      />
      <label className="mt-3 block text-xs text-slate-500" htmlFor="sim-count">
        요청 수 (1~100)
      </label>
      <input id="sim-count" type="number" min={1} max={100} value={form.requestCount} onChange={(e) => setRequestCount(e.target.value)} className={`mt-1 ${inputClass}`} />
      <Range label="통보형 채널 비율" id="sim-notify" value={form.notifyRatio} max={100} onChange={(v) => set('notifyRatio', v)} />
      <Range label="같은 예약 재전송 비율" id="sim-dup" value={form.duplicateRatio} max={50} onChange={(v) => set('duplicateRatio', v)} />
      {!datesValid && <ErrorText>체크아웃은 체크인보다 뒤여야 합니다.</ErrorText>}
      <ErrorText>{error}</ErrorText>
      <button type="submit" disabled={pending || !datesValid} className={`mt-5 w-full ${buttonClass.primary} py-2.5`}>
        {pending ? `${form.requestCount}건 보내는 중…` : `${form.requestCount}건 동시 실행`}
      </button>
    </form>
  );
}

function Range({ label, id, value, max, onChange }: { label: string; id: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <>
      <label className="mt-3 flex justify-between text-xs text-slate-500" htmlFor={id}>
        <span>{label}</span>
        <span className="font-medium text-slate-800">{value}%</span>
      </label>
      <input id={id} type="range" min={0} max={max} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-slate-900" />
    </>
  );
}
