FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY scripts ./scripts

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "scripts/voice-wss-server.mjs"]
