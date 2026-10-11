import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BFF_PREFIX, endpoints, toUrl } from '@/shared/api';
import { FALLBACK_POLL_MS } from '@/shared/config';

/** 화면 데이터를 바꾸는 back-end SSE 주제 */
const TOPICS = ['conflict.created', 'reservation.changed', 'inventory.changed', 'sync.changed'];

/**
 * 실시간 갱신 (REQ-13, ADR-0004). BFF가 중계하는 SSE를 듣고, 이벤트가 오면 서버가 현재 화면을 다시 그리게 한다.
 * 연결이 끊기면 다시 붙을 때까지 10초마다 다시 그린다. 새 충돌 수는 알림(토스트)에 쓴다.
 */
export function useRealtimeController() {
  const router = useRouter();
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);
  const [newConflicts, setNewConflicts] = useState(0);
  const onConflictPage = pathname === '/conflicts';
  const onConflictPageRef = useRef(onConflictPage);
  const [lastPath, setLastPath] = useState(pathname);
  // 충돌 처리함에 들어가면 알림 수를 비운다 (렌더 중 상태 조정)
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (onConflictPage) setNewConflicts(0);
  }
  useEffect(() => {
    onConflictPageRef.current = onConflictPage;
  }, [onConflictPage]);

  useEffect(() => {
    const source = new EventSource(`${BFF_PREFIX}${toUrl(endpoints.eventStream)}`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    // 시뮬레이션처럼 이벤트가 몰리면 0.3초 동안 모아서 한 번만 다시 그린다
    const scheduleRefresh = () => {
      timer ??= setTimeout(() => {
        timer = undefined;
        router.refresh();
      }, 300);
    };

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false); // EventSource가 스스로 다시 연결한다
    for (const topic of TOPICS) {
      source.addEventListener(topic, (e) => {
        scheduleRefresh();
        if (topic === 'conflict.created' && !onConflictPageRef.current) {
          const ids = (JSON.parse((e as MessageEvent<string>).data) as { ids?: number[] }).ids ?? [];
          setNewConflicts((n) => n + Math.max(ids.length, 1));
        }
      });
    }
    return () => {
      source.close();
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  useEffect(() => {
    if (connected) return;
    const id = setInterval(() => router.refresh(), FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [connected, router]);

  return {
    newConflicts,
    showToast: newConflicts > 0 && !onConflictPage,
    dismissToast: () => setNewConflicts(0),
  };
}
