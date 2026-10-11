# syntax=docker/dockerfile:1
# front-end 이미지 (arm64 demo 노드, 로컬 Docker 공용). 빌드: docker build -t restella/front-end .
# Next.js standalone 출력만 담는다. 환경변수(APP_ENV, BACKEND_URL, SESSION_SECRET)는 실행할 때 넣고 이미지에 굽지 않는다

ARG NODE_IMAGE=node:24.21.0-trixie-slim

# pnpm은 package.json의 packageManager와 같은 버전으로 고정한다
FROM ${NODE_IMAGE} AS build
RUN npm install -g pnpm@12.10.1 && npm cache clean --force
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 실행: standalone 서버와 정적 파일만 담고, root가 아닌 node 사용자로 실행한다
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
