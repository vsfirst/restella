'use client';

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // 화면 데이터는 서버가 props로 넘긴다. 여기서는 사용자 행동 뒤의 요청(변경, 대화상자 조회)만 다룬다
      queries: { staleTime: 30_000, retry: 1 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
