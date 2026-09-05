FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG GA_MEASUREMENT_ID
RUN npm run build
RUN npx esbuild scripts/stats.ts --bundle --platform=node --format=cjs --outfile=/app/stats.cjs
RUN npx esbuild scripts/study-uploads.ts --bundle --platform=node --format=cjs --outfile=/app/study-uploads.cjs

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1 TEMP_STORE_DIR=/data/feedfix USAGE_LOG_PATH=/data/metrics/usage.json CORPUS_STORE_DIR=/data/study
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/data/walmart/compiled ./data/walmart/compiled
COPY --from=build /app/stats.cjs ./stats.cjs
COPY --from=build /app/study-uploads.cjs ./study-uploads.cjs
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/feedfix-entrypoint
EXPOSE 3000
ENTRYPOINT ["feedfix-entrypoint"]
CMD ["node", "server.js"]
