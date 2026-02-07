# Gundwane — Non-Custodial DeFi Agent for Telegram
> Openclaw: we al are on the same bot

A conversational DeFi agent that lives in Telegram. Users interact with a bot that can check balances, execute swaps, bridge tokens, manage portfolio strategies, set price alerts, and run DCA plans — *all without ever giving up custody of their wallet*.

The agent uses **EIP-7702** delegation: users sign a one-time authorization (via a Telegram Mini App) that lets the bot's operator key execute transactions on their behalf through a delegate contract. The user can revoke at any time. 

Remember: Gundwane is an agentic deFi assistant, he can do everything, but he will always ask for your approval before executing any transaction.

---

## Table of Contents

- [Architecture](#architecture)
- [Components](#components)
  - [contracts/](#contracts)
  - [mini-app/](#mini-app)
  - [defi-agent-plugin/](#defi-agent-plugin)
  - [telegram-bot/](#telegram-bot)
- [LI.FI Integration](#lifi-integration)
- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Deploy Contracts](#1-deploy-contracts)
  - [2. Run the Mini App](#2-run-the-mini-app)
  - [3. Build the Plugin](#3-build-the-plugin)
  - [4. Run the Telegram Bot](#4-run-the-telegram-bot)
- [Environment Variables](#environment-variables)
- [Supported Chains](#supported-chains)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│   Telegram User   │────▶│  OpenClaw Gateway │────▶│  defi-agent-plugin   │
│   (chat with bot) │     │  (Telegram bot)   │     │  (tools: swap, bal..)│
└──────────────────┘     └──────────────────┘     └──────────┬───────────┘
                                                              │
                          ┌──────────────────┐                │  execute via
                          │   Mini App (Next) │                │  bot operator key
                          │   Privy embedded  │                ▼
                          │   wallet + 7702   │     ┌──────────────────────┐
                          │   auth signing    │     │  DeFiAgentDelegate   │
                          └────────┬─────────┘     │  (on-chain contract) │
                                   │ setup          └──────────────────────┘
                                   ▼
                          ┌──────────────────┐
                          │  EVM Chains       │
                          │  (Base, Ethereum, │
                          │   Arbitrum, etc.) │
                          └──────────────────┘
```

---

## Components

### `contracts/`

**Foundry/Solidity** — The `DeFiAgentDelegate` smart contract.
> Disclaimer: not audited!
- EIP-7702 delegate contract using ERC-7201 namespaced storage
- Operator pattern: the bot EOA is authorized as an operator and can call `execute()` / `executeBatch()` on behalf of the user's wallet
- Deployed on multiple chains (Sepolia, Base, Ethereum mainnet)
- Includes deployment scripts and CI via GitHub Actions


### `mini-app/`

**Next.js 16 + React 19 + Tailwind** — Telegram Mini App for onboarding.

- Authenticates users via **Privy** (Telegram login → embedded wallet)
- Signs **EIP-7702 authorization** per chain using Privy's `useSign7702Authorization` hook
- Broadcasts the delegation transactions to all supported chains
- After setup, the user's wallet is linked and the bot can operate on their behalf
- Designed to be opened from within Telegram as a Web App

### `defi-agent-plugin/`

**TypeScript (tsup)** — OpenClaw plugin that gives the bot its DeFi superpowers.

Registered tools:
| Tool | Description |
|------|-------------|
| `defi_get_wallet` | Resolve user's wallet address via Privy backend |
| `defi_get_balance` | Native ETH balance on a given chain |
| `defi_get_portfolio` | Multi-chain portfolio (native + ERC-20 tokens) |
| `defi_check_delegation` | Verify EIP-7702 delegation is active |
| `defi_execute` | Single call via delegate contract |
| `defi_execute_batch` | Batched calls (e.g. approve + swap atomically) |
| `defi_approve` | ERC-20 token approval via delegate |
| `defi_approve_and_send` | Approve + transaction in one batch |
| `defi_send_transaction` | Send a transaction (LI.FI format) |
| `defi_tx_status` | Check transaction receipt status |
| `defi_get_strategy` | Read user's saved DeFi strategy |
| `defi_set_strategy` | Store/update user preferences and allocations |

### `telegram-bot/` (OpenClaw Gateway)

**OpenClaw configuration** — Bot personality, skills, and deployment config.

- `workspace/SOUL.md` — Agent personality: concise, chain-abstracted, proactive
- `workspace/AGENTS.md` — Agent behavior rules and tool usage guidelines
- `workspace/HEARTBEAT.md` — Autonomous monitoring (portfolio drift, price alerts, DCA execution)
- `skills/` — Specialized skills: LI.FI swaps/bridges, price alerts, DCA, proactive DeFi monitoring
- `openclaw.json` — Plugin config, chain RPC URLs, LI.FI integration
- `Dockerfile` + `docker-compose.yml` — Production deployment

---

## LI.FI Integration

[LI.FI](https://li.fi) is the **sole routing and execution layer** for all swaps, bridges, and DeFi token operations. No manual DEX interactions — everything goes through LI.FI's aggregator, which finds the best route across 30+ DEXs and bridges.

### Why LI.FI

- **Multi-chain routing** — automatically picks the cheapest/fastest path, even if it involves bridging between chains
- **Single API** — one interface for swaps (same-chain) and bridges (cross-chain), simplifying the agent's logic
- **Aggregation** — compares routes across Uniswap, SushiSwap, 1inch, Stargate, Across, and many more

### How the agent uses it

```
User: "swap 0.1 ETH for USDC"
          │
          ▼
   ┌─────────────────┐
   │  defi_get_wallet │  ← resolve user's wallet address
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │  LI.FI /v1/quote │  ← get best route + tx data
   │  (skipSimulation │     (skipSimulation required for
   │   = true)        │      EIP-7702 delegated wallets)
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │  Present quote   │  ← show amount, fees, slippage
   │  to user         │     + Approve/Reject buttons
   └────────┬────────┘
            ▼ (user approves)
   ┌──────────────────────┐
   │ defi_send_transaction │  ← native ETH swaps
   │        OR             │
   │ defi_approve_and_send │  ← ERC-20 swaps (approve + swap
   └────────┬─────────────┘    in one atomic batch)
            ▼
   ┌─────────────────┐
   │  LI.FI /v1/status│  ← track tx confirmation
   └─────────────────┘
```

### Key endpoints used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/quote` | Get a swap/bridge quote with ready-to-send transaction data |
| `POST /v1/advanced/routes` | Compare multiple route options |
| `GET /v1/status` | Track transaction status after broadcast |
| `GET /v1/tokens` | Look up tokens on specific chains |
| `GET /v1/chains` | List supported chains |

### EIP-7702 compatibility

LI.FI's default transaction simulation breaks on EIP-7702 delegated wallets (because the EOA has on-chain code). The agent always passes `skipSimulation=true` in quote requests to work around this.

### Slippage

- **Default: 10%** — works for most tokens and market conditions
- Users can set custom slippage via their personal strategy (`defi_set_strategy`)
- The agent can also adjust dynamically per-transaction based on token volatility

### Where LI.FI appears in the codebase

- **`telegram-bot/skills/lifi/SKILL.md`** — full API reference and usage rules for the agent
- **`defi-agent-plugin/src/plugin.ts`** — `defi_send_transaction` and `defi_approve_and_send` accept LI.FI's `transactionRequest` format directly
- **`telegram-bot/workspace/HEARTBEAT.md`** — heartbeat monitoring uses minimal LI.FI quotes to check token prices for alerts
- **`telegram-bot/skills/dca/SKILL.md`** — DCA execution fetches LI.FI quotes each cycle

### SaaS Business Model

This architecture is designed from the ground up to work as a **SaaS product** — and LI.FI is the key to a sustainable revenue model.

#### How the revenue works

LI.FI supports **fee collection at the protocol level**: when building a quote, the integrator can pass a `fee` parameter that takes a percentage of each swap/bridge. The fee is deducted transparently on-chain before the output tokens reach the user — no custody, no separate billing system, no payment infrastructure needed.

```
User swaps 1 ETH → USDC
    │
    ▼
LI.FI routes the swap (best price across DEXs)
    │
    ├── 99.7% → User receives USDC
    └──  0.3% → Fee collector address (project revenue)
```

This means:
- **Zero marginal cost** per transaction — fees are embedded in the swap itself
- **No invoicing or payment rails** — revenue is collected on-chain, automatically
- **Fully transparent** — users see the fee in the quote before approving
- **Scales with usage** — more volume = more revenue, no infrastructure changes needed

#### Proposed pricing tiers

| Tier | Yearly Price | Tx Fee | Target User | Break-even Volume |
|------|-------------|--------|-------------|-------------------|
| **Starter** | Free | 0.30% | Casual users, trying it out | ~$1,000/mo in swaps |
| **Pro** | $49/yr | 0.10% | Active traders, DCA users | Covered by subscription |
| **Whale** | $199/yr | 0.05% | High-volume, power users | Covered by subscription |

#### Why these numbers work

- **Competitive**: Banana Gun charges 0.5–1%, most aggregators charge 0.1–0.3%. Our 0.30% free tier is at the low end of the market.
- **Clear upgrade path**: a user doing $5,000/mo in swaps pays ~$15/mo in fees on Starter. Pro at $49/yr (~$4/mo) + 0.10% saves them immediately.
- **Whale tier is a no-brainer**: for anyone doing $50k+/mo, the $199/yr is negligible and 0.05% is best-in-class.

#### Revenue projections

| Scenario | Monthly Active Users | Avg Monthly Volume/User | Monthly Revenue |
|----------|---------------------|------------------------|-----------------|
| Early (100 users) | 100 | $2,000 | ~$600 (fees) |
| Growth (1,000 users) | 1,000 | $5,000 | ~$10,000 (fees + subs) |
| Scale (10,000 users) | 10,000 | $8,000 | ~$120,000 (fees + subs) |

#### Why this is a natural SaaS fit

1. **Non-custodial = low regulatory overhead** — the bot never holds funds, it just signs transactions through the delegate contract
2. **Per-user isolation is already built in** — strategies, alerts, DCA plans, and memory are all scoped by Telegram ID
3. **Sticky product** — once a user sets up DCA plans, price alerts, and a portfolio strategy, switching costs are high
4. **Telegram distribution** — zero-install onboarding, viral sharing within group chats, bot discovery through Telegram's ecosystem
5. **LI.FI handles the hard parts** — DEX aggregation, bridge routing, chain support — we focus purely on the agent experience

---

## How It Works

1. **User opens the Mini App** from Telegram and logs in with their Telegram account
2. **Privy creates an embedded wallet** (or uses an existing one) for the user
3. **User taps "Activate"** → the app signs EIP-7702 authorizations for each supported chain, delegating to the `DeFiAgentDelegate` contract
4. **The bot broadcasts** these delegations on-chain and registers itself as the operator
5. **User chats with the bot** in Telegram — the bot uses LI.FI for swaps/bridges, checks balances, manages strategies, and executes transactions through the delegate contract
6. **The user stays in control** — funds remain in their wallet, they can revoke delegation at any time

---

## Prerequisites

- **Node.js** >= 22
- **pnpm** (for the plugin)
- **npm** (for the mini-app)
- **Foundry** ([install](https://book.getfoundry.sh/getting-started/installation))
- **Docker** (for the bot, optional for local dev)
- **OpenClaw** ([install](https://openclaw.ai))

API keys needed:
- [Privy](https://dashboard.privy.io) — app ID + secret
- [OpenAI](https://platform.openai.com) — GPT API key
- [LI.FI](https://li.fi) — API key for swaps/bridges
- RPC provider (e.g. [Alchemy](https://alchemy.com)) — for contract deployment and chain queries

---

## Getting Started

### 1. Deploy Contracts
> Please Patrick forgive me for how I use the private key here 

```bash
cd contracts
cp .env.example .env  # add your RPC URLs, deployer private key, and DEPLOY_SALT
source .env

# Build
forge build

# Test
forge test

# Deploy to multiple chains simultaneously (uses CREATE2 for deterministic addresses)
make deploy CHAINS="base ethereum"
```

Deployment uses **CREATE2** with a deterministic salt, so the `DeFiAgentDelegate` contract gets the **same address on every chain**. The Makefile loops through the specified chains and runs the Forge deploy script for each one. You can customize the target chains:

```bash
# Default: ethereum + base
make deploy

# Specific chains (must match rpc_endpoints in foundry.toml)
make deploy CHAINS="sepolia base ethereum arbitrum optimism polygon"
```

Note the deployed contract address (printed in the console) — you'll need it for the mini-app and bot.

### 2. Run the Mini App

```bash
cd mini-app
cp .env.example .env.local  # fill in Privy credentials, contract address, etc.
npm install
npm run dev
```

The app will be available at `http://localhost:3000`. For Telegram integration, you'll need to expose it via HTTPS (e.g. ngrok, Vercel, or Cloudflare Tunnel).

### 3. Build the Plugin

```bash
cd defi-agent-plugin
pnpm install
pnpm run build
```

This produces `dist/` which is referenced by the bot's Dockerfile and OpenClaw plugin system.

### 4. Run the Telegram Bot

**Option A: Docker (recommended)**

```bash
# From the repo root
cp telegram-bot/.env.example telegram-bot/.env
# Fill in all required env vars in telegram-bot/.env

docker compose -f telegram-bot/docker-compose.yml up -d
```

**Option B: Local with OpenClaw**

```bash
# Install the plugin globally
openclaw plugins install ./defi-agent-plugin

# Copy workspace files
cp -r telegram-bot/workspace/* ~/.openclaw/workspace/
cp telegram-bot/openclaw.json ~/.openclaw/openclaw.json
cp -r telegram-bot/skills/* ~/.openclaw/workspace/skills/

# Set env vars and start
export TELEGRAM_BOT_TOKEN=...
export OPENAI_API_KEY=...
export LIFI_API_KEY=...
export BOT_PRIVATE_KEY=...
export DELEGATE_CONTRACT_ADDRESS=...
export DEFI_AGENT_BACKEND_URL=http://localhost:3000

openclaw gateway
```

---

## Environment Variables

### Mini App (`mini-app/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy application ID |
| `PRIVY_APP_SECRET` | Privy server-side secret |
| `NEXT_PUBLIC_SUPPORTED_CHAIN_IDS` | Comma-separated chain IDs (e.g. `8453,1`) |
| `BOT_PRIVATE_KEY` | Bot operator EOA private key |
| `DELEGATE_CONTRACT_ADDRESS` | Deployed DeFiAgentDelegate address |
| `NEXT_PUBLIC_DELEGATE_CONTRACT` | Same address (client-side) |
| `*_RPC_URL` | Per-chain RPC endpoints |

### Telegram Bot (`telegram-bot/.env`)

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `OPENAI_API_KEY` | OpenAI API key |
| `LIFI_API_KEY` | LI.FI API key |
| `BOT_PRIVATE_KEY` | Bot operator EOA private key |
| `DELEGATE_CONTRACT_ADDRESS` | Deployed DeFiAgentDelegate address |
| `DEFI_AGENT_BACKEND_URL` | Mini App URL (for wallet resolution) |
| `*_RPC_URL` | Per-chain RPC endpoints (optional, falls back to public RPCs) |

---

## Supported Chains

| Chain | ID | Status |
|-------|----|--------|
| Ethereum | 1 | Mainnet |
| Base | 8453 | Mainnet |
| Arbitrum | 42161 | Mainnet |
| Optimism | 10 | Mainnet |
| Polygon | 137 | Mainnet |
| Sepolia | 11155111 | Testnet |

---

## Tech Stack

- **Smart Contracts**: Solidity 0.8.24, Foundry, EIP-7702, ERC-7201
- **Mini App**: Next.js 16, React 19, Tailwind CSS 4, Privy, viem
- **Plugin**: TypeScript, tsup, viem, OpenClaw Plugin SDK
- **Bot**: OpenClaw, GPT-5-mini, LI.FI SDK
- **Infra**: Docker, Docker Compose

---

## License

MIT
