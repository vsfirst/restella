# syntax=docker/dockerfile:1
# back-end 이미지 (arm64 demo 노드, 로컬 Docker 공용). 빌드: docker build -t restella/back-end .
# 실행 명령은 이미지 하나로 나눈다: API 서버(기본), 마이그레이션·시드(compose의 back-end-migrate, 운영의 PreSync Job)

ARG NODE_IMAGE=node:24.21.0-trixie-slim

# pnpm은 package.json의 packageManager와 같은 버전으로 고정한다
FROM ${NODE_IMAGE} AS pnpm
RUN npm install -g pnpm@12.10.1 && npm cache clean --force
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 빌드: 개발 의존성까지 설치하고 TypeScript를 컴파일한다
FROM pnpm AS build
RUN pnpm install --frozen-lockfile
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

# 실행용 의존성만 설치한다 (설치 스크립트는 pnpm-workspace.yaml의 allowBuilds에 있는 것만 실행)
FROM pnpm AS prod-deps
RUN pnpm install --frozen-lockfile --prod

# 실행: 컴파일 결과와 실행용 의존성만 담고, root가 아닌 node 사용자로 실행한다
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
