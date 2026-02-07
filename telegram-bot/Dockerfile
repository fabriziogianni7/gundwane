FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest pnpm

# Build the plugin inside the image (no pre-built dist/ needed)
COPY defi-agent-plugin/ /tmp/defi-agent-plugin/
RUN cd /tmp/defi-agent-plugin && pnpm install --frozen-lockfile && pnpm run build
RUN openclaw plugins install /tmp/defi-agent-plugin

ENV OPENCLAW_STATE_DIR=/root/.openclaw
ENV MOLTBOT_STATE_DIR=/root/.moltbot

COPY telegram-bot/openclaw.json /root/.openclaw/openclaw.json
COPY telegram-bot/workspace/ /root/.openclaw/workspace/
COPY telegram-bot/skills/ /root/.openclaw/workspace/skills/

EXPOSE 18789

# Set TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, LIFI_API_KEY, BOT_PRIVATE_KEY, DELEGATE_CONTRACT_ADDRESS, DEFI_AGENT_BACKEND_URL via env
CMD ["openclaw", "gateway", "--bind", "loopback"]
