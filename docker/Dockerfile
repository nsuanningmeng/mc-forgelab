FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make gcc g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile
RUN node node_modules/typescript/bin/tsc -b \
    packages/core packages/app-error packages/logger packages/config \
    packages/storage packages/target-registry packages/compatibility \
    packages/project-model packages/file-operation packages/toolchain-manager \
    packages/template-engine packages/build-orchestrator \
    packages/ai-provider-manager packages/ai-workflow-engine \
    packages/ai-agent packages/artifact-manager apps/web

FROM node:20-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates unzip tini && rm -rf /var/lib/apt/lists/*
RUN groupadd -g 1001 mcfl && useradd -m -u 1001 -g mcfl mcfl
WORKDIR /app
COPY --from=builder --chown=mcfl:mcfl /app/node_modules ./node_modules
COPY --from=builder --chown=mcfl:mcfl /app/packages ./packages
COPY --from=builder --chown=mcfl:mcfl /app/apps/web ./apps/web
RUN mkdir -p /data/workspace /data/cache /data/logs /data/db /opt/mc-forgelab/toolchains \
    && chown -R mcfl:mcfl /data /opt/mc-forgelab
USER mcfl
EXPOSE 3000
ENV MC_FORGELAB_MODE=docker \
    MC_FORGELAB_HOST=0.0.0.0 \
    MC_FORGELAB_PORT=3000 \
    MC_FORGELAB_WORKSPACE=/data/workspace \
    MC_FORGELAB_CACHE=/data/cache \
    MC_FORGELAB_LOGS=/data/logs \
    MC_FORGELAB_DB=/data/db/mc-forgelab.sqlite \
    MC_FORGELAB_TOOLCHAINS=/opt/mc-forgelab/toolchains
ENTRYPOINT ["tini", "--"]
CMD ["node", "apps/web/dist/server.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -f http://localhost:3000/api/health || exit 1
