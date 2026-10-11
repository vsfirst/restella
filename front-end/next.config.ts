import type { NextConfig } from 'next';

// create-next-app 16.4 템플릿 설정을 따른다. 요청 시점 데이터(세션, searchParams)는 <Suspense> 안에서만 읽는다
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: 'standalone', // 컨테이너 이미지에 필요한 파일만 담는다 (infra)
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async redirects() {
    return [{ source: '/', destination: '/inventory', permanent: false }];
  },
};

export default nextConfig;
