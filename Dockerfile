FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm install

COPY client ./client
COPY server ./server

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

RUN addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json* ./
COPY server/package.json ./server/

RUN npm install --omit=dev --workspace=server && npm cache clean --force

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

RUN mkdir -p /data/uploads && chown -R app:app /data /app

USER app

# Coolify: bind a persistent volume to /data in the Storages tab
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c 'wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1'

CMD ["node", "--experimental-sqlite", "server/dist/index.js"]