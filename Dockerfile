# syntax=docker/dockerfile:1.7
FROM node:26.5.1-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM node:26.5.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 homi && adduser --system --uid 1001 --ingroup homi homi
COPY --from=production-dependencies --chown=homi:homi /app/node_modules ./node_modules
COPY --from=builder --chown=homi:homi /app/.next/standalone ./
COPY --from=builder --chown=homi:homi /app/.next/static ./.next/static
COPY --from=builder --chown=homi:homi /app/public ./public
COPY --from=builder --chown=homi:homi /app/drizzle ./drizzle
COPY --from=builder --chown=homi:homi /app/scripts/migrate.mjs ./scripts/migrate.mjs
RUN mkdir -p /app/data/uploads && chown -R homi:homi /app
USER homi
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]

