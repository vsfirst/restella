import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// FSD 레이어 규칙 (front-end/README.md "디렉토리 구조")
// 위 레이어는 아래 레이어만 import한다: _app → _pages → widgets → shared (entities·features는 두지 않는다)
const LAYERS = ['_app', '_pages', 'widgets', 'shared'];
const layerZones = LAYERS.slice(1).map((layer, i) => ({
  target: `./src/${layer}`,
  from: LAYERS.slice(0, i + 1).map((upper) => `./src/${upper}`),
  message: `FSD: ${layer} 레이어는 위 레이어를 import할 수 없다`,
}));

// 같은 레이어의 다른 슬라이스는 import하지 않는다
const sameLayerRules = ['_pages', 'widgets'].map((layer) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: [`@/${layer}/*`], message: `FSD: 같은 레이어(${layer})의 다른 슬라이스는 import하지 않는다` },
          { group: ['@/*/*/*', '!@/*/*/index.server'], message: 'FSD: 슬라이스는 index.ts(서버 전용은 index.server.ts)로만 가져온다' },
        ],
      },
    ],
  },
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'import/no-restricted-paths': ['error', { zones: layerZones }],
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/*/*/*', '!@/*/*/index.server'], message: 'FSD: 슬라이스는 index.ts(서버 전용은 index.server.ts)로만 가져온다' }] },
      ],
    },
  },
  ...sameLayerRules,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/shared/api/generated/**', 'playwright-report/**', 'test-results/**']),
]);

export default eslintConfig;
