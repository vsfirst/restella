'use client';

import type { Channel, ChannelFaults } from '@/shared/api';
import { ErrorText } from '@/shared/ui';
import { FAILURE_RATES, useChannelFaultsController } from '../lib/use-channel-faults.controller';

/** 가짜 채널 장애 주입 (시연용). 실패율을 주면 재고 동기화가 실패하고 다시 시도된다 (REQ-12) */
export function ChannelFaultsPanel({ channels, faults }: { channels: Channel[]; faults: ChannelFaults }) {
  const c = useChannelFaultsController(faults);

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold">장애 주입 (시연용)</h2>
      <p className="mt-1 text-xs text-slate-500">가짜 채널이 재고 동기화를 받을 때 일부러 실패합니다. Restella가 간격을 늘려 최대 5회 다시 보내는 것을 확인할 수 있습니다.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {channels.map((ch) => (
          <label key={ch.code} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <span>{ch.name}</span>
            <select
              aria-label={`${ch.name} 실패율`}
              value={c.rateOf(ch.code)}
              disabled={c.pending}
              onChange={(e) => c.setRate(ch.code, Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
            >
              {FAILURE_RATES.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? '정상' : `실패 ${r * 100}%`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <ErrorText>{c.error}</ErrorText>
    </section>
  );
}
