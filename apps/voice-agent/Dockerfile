FROM python:3.11-slim-bullseye AS base

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends curl unzip build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack pnpm install turbo --global
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun

VOLUME /pnpm/store

FROM base AS python-builder
WORKDIR /app/apps/voice-agent
COPY apps/voice-agent/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip3 install -r requirements.txt

FROM base AS pnpm-builder
WORKDIR /app
COPY . .
RUN turbo prune "@voice-agent-example/voice-agent" --docker

FROM base AS pnpm-installer
WORKDIR /app
COPY --from=pnpm-builder /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

COPY --from=pnpm-builder /app/out/full/ .
RUN corepack pnpm turbo build
RUN pnpm deploy --filter="@voice-agent-example/voice-agent" --prod /prod/app

# Runner stage
FROM base AS runner
WORKDIR /app

COPY --from=pnpm-installer /app .
COPY --from=python-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
ENV PYTHONPATH="/usr/local/lib/python3.11/site-packages:$PYTHONPATH"

# Create a non-root user named 'bun'
RUN useradd -m -s /bin/bash bun
USER bun
WORKDIR /app/apps/voice-agent
ENV NODE_ENV=production
CMD ["bun", "run", "main.ts"]
