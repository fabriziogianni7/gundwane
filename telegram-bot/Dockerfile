# ---- Build stage: compile the plugin ----
FROM node:22-slim AS builder

RUN npm install -g pnpm

COPY defi-agent-plugin/ /tmp/defi-agent-plugin/
RUN cd /tmp/defi-agent-plugin && pnpm install --frozen-lockfile && pnpm run build

# ---- Runtime stage: lean final image ----
FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest

# Copy only the built plugin artifacts from the builder stage
COPY --from=builder /tmp/defi-agent-plugin/package.json /tmp/defi-agent-plugin/openclaw.plugin.json /tmp/defi-agent-plugin/
COPY --from=builder /tmp/defi-agent-plugin/dist/ /tmp/defi-agent-plugin/dist/
COPY --from=builder /tmp/defi-agent-plugin/skills/ /tmp/defi-agent-plugin/skills/
RUN openclaw plugins install /tmp/defi-agent-plugin && rm -rf /tmp/defi-agent-plugin

ENV OPENCLAW_STATE_DIR=/root/.openclaw
ENV MOLTBOT_STATE_DIR=/root/.moltbot

COPY telegram-bot/openclaw.json /root/.openclaw/openclaw.json
COPY telegram-bot/workspace/ /root/.openclaw/workspace/
COPY telegram-bot/skills/ /root/.openclaw/workspace/skills/

EXPOSE 18789

# Set TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, LIFI_API_KEY, BOT_PRIVATE_KEY, DELEGATE_CONTRACT_ADDRESS, DEFI_AGENT_BACKEND_URL via env
CMD ["openclaw", "gateway", "--bind", "loopback"]
