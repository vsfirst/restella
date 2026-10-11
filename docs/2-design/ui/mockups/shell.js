// 목업 공통 틀: 상단 메뉴, 미처리 충돌 배지, 로그아웃, 알림(토스트).
// 실제 구현에서는 front-end의 src/_app 레이아웃과 widgets가 이 역할을 한다.
// 데이터는 모두 가짜 값이다 (docs/2-design/security.md).

const NAV = [
  { key: 'inventory', label: '재고', href: 'inventory.html' },
  { key: 'reservations', label: '예약', href: 'reservations.html' },
  { key: 'conflicts', label: '충돌', href: 'conflicts.html' },
  { key: 'events', label: '이벤트', href: 'events.html' },
  { key: 'simulator', label: '시뮬레이터', href: 'simulator.html' },
];

function renderShell(active, { screenId, screenName, openConflicts = 18 } = {}) {
  const nav = NAV.map(({ key, label, href }) => {
    const on = key === active;
    const badge =
      key === 'conflicts' && openConflicts > 0
        ? `<span class="ml-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">${openConflicts}</span>`
        : '';
    return `<a href="${href}" class="flex items-center rounded-md px-3 py-2 text-sm font-medium ${
      on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }">${label}${badge}</a>`;
  }).join('');

  document.getElementById('shell').innerHTML = `
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <div class="flex items-baseline gap-2">
          <span class="text-lg font-bold tracking-tight">Restella</span>
          <span class="text-xs text-slate-500">운영자 콘솔</span>
        </div>
        <nav class="flex gap-1">${nav}</nav>
        <div class="ml-auto flex items-center gap-3 text-sm">
          ${
            openConflicts > 0
              ? `<a href="conflicts.html" class="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-medium text-rose-700">
                   <span class="h-2 w-2 animate-pulse rounded-full bg-rose-500"></span>미처리 충돌 ${openConflicts}건
                 </a>`
              : ''
          }
          <span class="text-slate-500">데모 운영자</span>
          <button class="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700">로그아웃</button>
        </div>
      </div>
    </header>
    ${
      screenId
        ? `<div class="mx-auto max-w-7xl px-6 pt-3 text-right text-[11px] text-slate-400">목업 · ${screenId} ${screenName ?? ''}</div>`
        : ''
    }`;
}

function showToast(title, body, href) {
  const el = document.createElement('a');
  el.href = href;
  el.className =
    'fixed bottom-6 right-6 z-50 w-80 rounded-lg border border-rose-200 bg-white p-4 shadow-lg ring-1 ring-rose-100';
  el.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500"></span>
      <div>
        <p class="text-sm font-semibold text-slate-900">${title}</p>
        <p class="mt-1 text-sm text-slate-600">${body}</p>
        <p class="mt-2 text-sm font-medium text-rose-700">충돌 처리함 열기 →</p>
      </div>
    </div>`;
  document.body.appendChild(el);
}

// 공용 가짜 데이터
const ROOM_TYPES = [
  { id: 1, code: 'DLX-DBL', name: '디럭스 더블' },
  { id: 2, code: 'STD-TWN', name: '스탠다드 트윈' },
  { id: 3, code: 'FAM-STE', name: '패밀리 스위트' },
];

const CHANNELS = [
  { code: 'DIRECT', name: '자사 예약', type: 'CONFIRM' },
  { code: 'APPROVAL', name: '승인형 채널', type: 'CONFIRM' },
  { code: 'OTA_A', name: 'OTA A', type: 'NOTIFY' },
  { code: 'OTA_B', name: 'OTA B', type: 'NOTIFY' },
  { code: 'OTA_C', name: 'OTA C', type: 'NOTIFY' },
];

function channelBadge(code) {
  const ch = CHANNELS.find((c) => c.code === code);
  const confirm = ch.type === 'CONFIRM';
  return `<span class="inline-flex items-center gap-1.5">
    <span class="font-medium text-slate-800">${ch.name}</span>
    <span class="rounded px-1.5 py-0.5 text-[11px] font-medium ${
      confirm ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200'
    }">${confirm ? '확인형' : '통보형'}</span>
  </span>`;
}

const STATUS_STYLE = {
  CONFIRMED: ['확정', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  CONFLICT: ['충돌', 'bg-rose-50 text-rose-700 ring-rose-200'],
  REJECTED: ['거절', 'bg-slate-100 text-slate-600 ring-slate-200'],
  CANCELLED: ['취소', 'bg-white text-slate-500 ring-slate-200 line-through'],
};

function statusBadge(status) {
  const [label, cls] = STATUS_STYLE[status];
  return `<span class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}">${label}</span>`;
}
