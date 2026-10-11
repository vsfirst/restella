import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';

export const rootMetadata: Metadata = {
  title: { default: 'Restella 운영자 콘솔', template: '%s · Restella' },
  description: '여러 채널의 예약을 하나의 재고 원장으로',
  robots: { index: false, follow: false },
};

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">{children}</body>
    </html>
  );
}
