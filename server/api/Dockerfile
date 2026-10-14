# syntax=docker/dockerfile:1

# WcashScan Express API backend.
ARG NODE_IMAGE=node:22.14.0-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app/server/api
ENV NPM_CONFIG_PRODUCTION=true
COPY server/api/package.json server/api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE} AS runner
WORKDIR /app/server/api
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    NODE_PATH=/app/server/api/node_modules \
    COMPACT_BLOCK_CACHE_DIR=/var/cache/wcashscan/compact-blocks
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.title="wcashscan-api" \
      org.opencontainers.image.source="https://github.com/w-cash/wcashscan" \
      org.opencontainers.image.revision="${GIT_COMMIT}"

COPY --from=deps /app/server/api/node_modules ./node_modules
COPY server/api/ ./
COPY server/lib/ ../lib/
COPY server/signals/ ../signals/
COPY config/ /app/config/
COPY lib/ /app/lib/
COPY server/data/attestation-endpoints.json ../data/attestation-endpoints.json
COPY lib/attestation-status.js /app/lib/attestation-status.js
COPY lib/canary-status.js /app/lib/canary-status.js
COPY lib/mining-software.js /app/lib/mining-software.js
COPY server/canary/config.js /app/server/canary/config.js
COPY server/jobs/ /app/server/jobs/
COPY server/wcash-indexer/ /app/server/wcash-indexer/
COPY scripts/wcash-rpc-preflight.mjs /app/scripts/wcash-rpc-preflight.mjs
COPY scripts/verify-wcash-local.mjs /app/scripts/verify-wcash-local.mjs
RUN mkdir -p /var/cache/wcashscan/compact-blocks \
    && chown -R 1000:1000 /var/cache/wcashscan

USER 1000
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
