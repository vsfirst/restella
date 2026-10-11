import { useEffect } from 'react';

/** 화면을 그리다 실패했을 때: 오류를 기록하고, 서버 오류는 내용을 숨긴다 */
export function useRouteErrorController(error: Error & { digest?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return { message: error.digest ? '서버에서 오류가 발생했습니다. 잠시 뒤 다시 시도하세요.' : error.message };
}
