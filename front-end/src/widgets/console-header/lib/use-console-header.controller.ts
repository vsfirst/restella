import { usePathname } from 'next/navigation';

/** 콘솔 상단: 현재 메뉴 */
export function useConsoleHeaderController() {
  const pathname = usePathname();
  return {
    // 채널별 재고는 시뮬레이터에서 들어가는 화면이라 시뮬레이터 메뉴로 표시한다
    isActive: (href: string) => pathname === href || (href === '/simulator' && pathname === '/channels'),
  };
}
