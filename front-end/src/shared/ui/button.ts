// 목업(docs/2-design/ui/mockups)의 버튼 클래스를 그대로 쓴다
export const buttonClass = {
  primary: 'rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50',
  secondary: 'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50',
  danger: 'rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50',
  small: 'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300',
  smallDanger: 'rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50',
} as const;

export const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
