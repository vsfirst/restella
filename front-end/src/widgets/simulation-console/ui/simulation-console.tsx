'use client';

import Link from 'next/link';
import type { RoomType, SimulationRun } from '@/shared/api';
import { formatDateTime, monthDay } from '@/shared/lib';
import { buttonClass, PageHeader } from '@/shared/ui';
import { useSimulationConsoleController } from '../lib/use-simulation-console.controller';
import { RunSimulationForm } from './run-simulation-form';

/** 동시 예약 시뮬레이터 (S-06, REQ-19) */
export function SimulationConsole({ today, roomTypes, runs }: { today: string; roomTypes: RoomType[]; runs: SimulationRun[] }) {
  const { shown, shownRoomTypeCode, channelsHref, onRunDone, history } = useSimulationConsoleController(roomTypes, runs);

  return (
    <>
      <PageHeader
        title="동시 예약 시뮬레이터"
        description='"마지막 1실"에 여러 채널의 예약을 동시에 보냅니다. 실제 채널과 같은 방식(서명된 HTTP 요청)으로 보냅니다.'
        actions={
          channelsHref && (
            <Link href={channelsHref} className={buttonClass.secondary}>
              채널별 재고 보기 →
            </Link>
          )
        }
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-[360px_1fr]">
        <RunSimulationForm roomTypes={roomTypes} defaultCheckIn={today} onDone={onRunDone} />

        <section className="rounded-xl border border-slate-200 bg-white p-5" aria-live="polite">
          {shown?.result ? (
            <RunResult run={shown} roomTypeCode={shownRoomTypeCode} />
          ) : (
            <p className="text-sm text-slate-500">아직 실행한 기록이 없습니다. 왼쪽에서 조건을 정하고 실행하세요.</p>
          )}

          <h3 className="mt-6 text-sm font-semibold">이전 실행</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                {['#', '조건', '확정', '거절', '충돌', '중복', '초과 판매'].map((h) => (
                  <th key={h} className="py-1.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.id}</td>
                  <td>{r.condition}</td>
                  <td>{r.result?.confirmed ?? '-'}</td>
                  <td>{r.result?.rejected ?? '-'}</td>
                  <td>{r.result?.conflicts ?? '-'}</td>
                  <td>{r.result?.duplicates ?? '-'}</td>
                  <td className={r.result?.invariantOk ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>{r.result ? r.result.overbookedNights : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function RunResult({ run, roomTypeCode }: { run: SimulationRun; roomTypeCode: string }) {
  const r = run.result!;
  const sold = r.nights.map((n) => `${monthDay(n.stayDate)} 판매 ${n.sold ?? '-'} / 총 ${n.total ?? '-'}`).join(', ');
  return (
    <div data-testid="simulation-result">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">
          실행 #{run.id} 결과 <span className="text-sm font-normal text-slate-500">{roomTypeCode}</span>
        </h2>
        <span className="text-xs text-slate-500">
          {formatDateTime(run.startedAt).slice(0, 19)} · 소요 {(r.durationMs / 1000).toFixed(2)}초
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label="확정" value={r.confirmed} className="bg-emerald-50 text-emerald-800" />
        <Count label="거절 (확인형)" value={r.rejected} className="bg-slate-100 text-slate-800" />
        <Count label="충돌 (통보형)" value={r.conflicts} className="bg-rose-50 text-rose-800" />
        <Count label="중복 요청" value={r.duplicates} className="bg-amber-50 text-amber-800" />
      </div>
      {r.invariantOk ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">초과 판매 0건 · {sold}</p>
            <p className="text-xs text-emerald-800">
              {r.requests}건 중 {r.confirmed}건만 확정. 통보형 채널이 이미 판매한 {r.conflicts}건은 거절하지 않고 충돌로 드러냈습니다.
              {r.errors > 0 && ` 응답을 받지 못한 요청 ${r.errors}건.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          초과 판매 {r.overbookedNights}박 발견 · {sold}
        </div>
      )}
    </div>
  );
}

function Count({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-lg p-4 ${className}`}>
      <p className="text-xs">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}
