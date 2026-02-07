# Gundwane

Gundwane is an agentic DeFi assistant that lives in Telegram. It manages multi-chain wallets, executes swaps and bridges via [LI.FI](https://li.fi/), and proactively monitors your portfolio — all through a conversational interface powered by [OpenClaw](https://github.com/nichochar/openclaw).

## What Gundwane Can Do

| Feature | Description |
|---------|-------------|
| **Multi-chain portfolio** | Aggregated balances across Ethereum, Base, Arbitrum, Optimism, and Polygon. No "which chain?" — Gundwane figures it out. |
| **Swaps & bridges** | Same-chain and cross-chain token swaps via LI.FI. Best route picked automatically. |
| **Price alerts** | Natural language alerts — "tell me if ETH drops below $1800". Checked every 30 minutes. |
| **DCA (Dollar-Cost Averaging)** | Automated recurring buys — "buy $50 of ETH every day". Runs on a cron schedule. |
| **Portfolio rebalancing** | Compares current allocation vs your target, suggests trades to rebalance. |
| **Proactive monitoring** | Every 30 minutes: drift detection, risk alerts, opportunity surfacing, gas tracking. |
| **Morning briefings** | Daily portfolio summary delivered automatically via cron. |
| **Per-user strategy** | Set a risk profile (conservative / balanced / aggressive), target allocations, custom slippage, and preferences. |
| **Behavioral learning** | Adapts to your patterns over time — check-in times, approval habits, token preferences. |

All transactions require explicit approval via inline Telegram buttons (except DCA, which is pre-approved at creation).

## Architecture

```
User ──► Telegram ──► OpenClaw Gateway ──► AI Agent (GPT-5-mini)
                                              │
                            ┌─────────────────┼─────────────────┐
                            ▼                 ▼                 ▼
                     DeFi Agent Plugin    LI.FI API      Per-user Memory
                     (EIP-7702 wallets)   (swaps/bridges)  (strategy + logs)
```

- **Wallet model:** Users create a Privy embedded wallet linked to their Telegram account, then delegate execution to a shared `DeFiAgentDelegate` contract via EIP-7702. The bot submits transactions on the user's behalf without ever holding their keys.
- **Mini App:** A Telegram Mini App handles onboarding — wallet creation, Privy login, and delegation activation.

## Prerequisites

- **Docker** and Docker Compose (recommended), _or_ Node 22+ with [OpenClaw](https://github.com/nichochar/openclaw) installed globally
- A **Telegram bot token** from [@BotFather](https://t.me/BotFather)
- An **OpenAI API key**
- A **LI.FI API key** — get one at [li.fi](https://li.fi/)
- A **bot EOA private key** (operator key for submitting transactions)
- A deployed **DeFiAgentDelegate contract** address
- A running **Mini App backend** URL (for wallet resolution)

## Step-by-Step Setup

### 1. Clone the repo and enter the bot directory

```bash
cd telegram-bot
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Open `.env` and fill in all values:

| Variable | What it is |
|----------|-----------|
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `OPENAI_API_KEY` | OpenAI API key for GPT-5-mini |
| `LIFI_API_KEY` | LI.FI API key for swaps and bridges |
| `BOT_PRIVATE_KEY` | 64-char hex private key for the bot operator EOA |
| `DELEGATE_CONTRACT_ADDRESS` | Address of the deployed `DeFiAgentDelegate` contract |
| `DEFI_AGENT_BACKEND_URL` | Mini App backend URL (e.g. `https://your-app.vercel.app`) — no trailing slash |
| `SEPOLIA_RPC_URL` | (optional) Custom Sepolia RPC |
| `BASE_RPC_URL` | (optional) Custom Base RPC |
| `ETH_MAINNET_RPC_URL` | (optional) Custom Ethereum mainnet RPC |
| `OPTIMISM_RPC_URL` | (optional) Custom Optimism RPC |
| `POLYGON_RPC_URL` | (optional) Custom Polygon RPC |
| `ARBITRUM_RPC_URL` | (optional) Custom Arbitrum RPC |

If you leave the RPC URLs empty, the plugin falls back to public RPCs.

### 3. Build the DeFi Agent plugin

The plugin must be built on the host before Docker can use it:

```bash
cd ../defi-agent-plugin
pnpm install
pnpm run build
cd ../telegram-bot
```

### 4a. Run with Docker (recommended)

```bash
docker compose up --build
```

The gateway starts on port `18789`. State is persisted in the `wallet-data` Docker volume.

### 4b. Run without Docker

If you prefer to run directly:

```bash
# Install OpenClaw globally
npm install -g openclaw@latest

# Install the plugin
cd ../defi-agent-plugin && openclaw plugins install . && cd ../telegram-bot

# Copy config and workspace into OpenClaw's data directory
cp openclaw.json ~/.openclaw/openclaw.json
cp -r workspace/* ~/.openclaw/workspace/
cp -r skills/* ~/.openclaw/workspace/skills/

# Export env vars (or source .env)
export $(grep -v '^#' .env | xargs)

# Start the gateway
openclaw gateway --bind loopback
```

### 5. Set up the Mini App

Users onboard through the Telegram Mini App (see `../mini-app/`):

1. User opens the Mini App in Telegram.
2. Logs in with Privy (creates or links an embedded wallet).
3. Taps **"Activate your DeFi Agent"** — this signs an EIP-7702 delegation.
4. The bot can now resolve their wallet and execute transactions on their behalf.

### 6. Start chatting

Open a DM with your bot on Telegram. Try:

- **"What's my balance?"** — multi-chain portfolio overview
- **"Swap 0.01 ETH for USDC"** — get a LI.FI quote, approve with inline buttons
- **"Set up a DCA: buy $50 of ETH daily"** — automated recurring buys
- **"Alert me if ETH drops below $1800"** — autonomous price monitoring
- **"Set my strategy to aggressive, 50% ETH / 30% WBTC / 20% USDC"** — personalized portfolio management

## Project Structure

```
telegram-bot/
├── openclaw.json            # OpenClaw gateway config (model, heartbeat, channels, plugins)
├── .env.example             # Environment variable template
├── Dockerfile               # Container build
├── docker-compose.yml       # Docker Compose setup
├── workspace/
│   ├── SOUL.md              # Core personality, rules, and capabilities
│   ├── IDENTITY.md          # Name, vibe, avatar
│   ├── AGENTS.md            # Session boot sequence, tools, workflows
│   └── HEARTBEAT.md         # Autonomous monitoring checklist (runs every 30min)
└── skills/
    ├── defi-agent/SKILL.md  # Wallet & transaction plugin usage
    ├── lifi/SKILL.md        # LI.FI API integration
    ├── dca/SKILL.md         # Dollar-cost averaging
    ├── price-alerts/SKILL.md # Price & portfolio alerts
    └── proactive-defi/SKILL.md # Proactive monitoring & behavioral learning
```

## Customization

- **Personality:** Edit `workspace/SOUL.md` and `workspace/IDENTITY.md` to change tone, rules, and behavior.
- **Model:** Change `agents.defaults.model.primary` in `openclaw.json` (default: `openai/gpt-5-mini`).
- **Heartbeat interval:** Change `agents.defaults.heartbeat.every` in `openclaw.json` (default: `30m`).
- **Chains:** Add or remove chains in the `plugins.entries.defi-agent-plugin.config.chains` section of `openclaw.json`.
- **Per-user strategy:** Users set their own profile, allocations, and preferences in conversation — stored in `workspace/strategies/{telegramUserId}.json`.
