// 훅이라 클라이언트 컴포넌트에서만 쓴다. 서버 컴포넌트도 쓰는 lib/index.ts에서는 내보내지 않는다
import { useEffect } from 'react';

/** Esc를 누르면 onClose를 부른다 (대화상자, 상세 패널) */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
