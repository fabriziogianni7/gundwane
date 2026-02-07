---
name: proactive-defi
description: Proactive DeFi monitoring and autonomous portfolio management. Teaches Gundwane how to monitor positions, detect risks, surface opportunities, and act without being asked. Used during heartbeats and cron jobs.
homepage: https://github.com
metadata:
  openclaw:
    emoji: "📡"
    requires: { env: [] }
---

# Proactive DeFi Monitoring — Skill

## What this skill does

This skill transforms Gundwane from a reactive assistant into a **proactive portfolio manager**. It provides the reasoning framework for autonomous monitoring during heartbeats, cron jobs, and background checks.

## When to use

- During **heartbeat** cycles (read HEARTBEAT.md first, then apply this skill's reasoning).
- During **cron jobs** (morning briefings, weekly reviews).
- When the user asks for portfolio analysis or "what should I do?"
- When spawning **sub-agents** for research tasks.

## Data Storage — Hybrid Model

This skill uses both storage layers:

- **Strategy JSON** (per-user): read allocations, profile, DCA plans, alerts via `defi_get_strategy`.
- **Per-user memory** (narrative): write behavioral observations, portfolio snapshots, and daily notes to `memory/users/{peerId}/daily/YYYY-MM-DD.md` and `memory/users/{peerId}/MEMORY.md`.
- **Global memory** (shared): `MEMORY.md` at workspace root is for agent-level observations only — gas trends, market conditions, protocol news. Never write user-specific data here.

## Portfolio Drift Detection

### How to calculate drift

1. Load user strategy via `defi_get_strategy` → get `allocations` (e.g. `{ "ETH": 40, "WBTC": 30, "USDC": 30 }`).
2. Load portfolio via `defi_get_portfolio` → get current balances with USD values.
3. Calculate current allocation percentages.
4. Drift = `|current% - target%|` for each asset.

### Drift thresholds by profile

| Profile | Alert threshold | Suggest rebalance | Urgent |
|---------|----------------|-------------------|--------|
| Conservative | 3% drift | 5% drift | 8% drift |
| Balanced | 5% drift | 8% drift | 12% drift |
| Aggressive/Degen | 8% drift | 12% drift | 20% drift |

### Rebalance suggestion format

```
Portfolio drift detected:
• ETH: 47% (target 40%) — +7% over
• WBTC: 25% (target 30%) — 5% under
• USDC: 28% (target 30%) — 2% under

Suggested: Swap ~$X ETH → WBTC to rebalance.
Want me to quote it?
```

## Risk Detection

### Red flags to watch for

1. **Stablecoin depeg:** If USDC, USDT, or DAI deviates > 0.5% from $1.00, alert immediately regardless of profile.
2. **Flash crash:** If any held asset drops > 15% in a single heartbeat cycle (30min), alert with context.
3. **Gas spike:** If gas on any chain where user has pending operations spikes > 3x normal, warn about execution costs.
4. **Bridge delays:** If a cross-chain transfer is pending > 30 minutes, flag it.

### Risk alert format

Keep it short. Lead with the risk, then the impact, then the action:

```
⚠️ ETH dropped 12% in the last 30 min. Your portfolio is now ~$X,XXX (-$XXX).
Your strategy is [balanced] — this is within tolerance but worth watching.
```

## Opportunity Detection

Only surface opportunities that match the user's strategy profile:

### Conservative
- Only flag: unusually low gas (good for pending rebalances), stablecoin yield improvements.
- Never suggest: new tokens, high-risk plays, leverage.

### Balanced
- Flag: rebalance windows (low gas + drift), notable price movements on held assets.
- Suggest: cost-efficient swaps when conditions align.
- Don't suggest: tokens outside their current portfolio unless specifically asked.

### Aggressive / Degen
- Flag: everything balanced gets, plus notable market movements, new token listings on held chains.
- Suggest: rotation opportunities, yield plays, momentum trades.
- But still: never execute without approval. Surface the idea, let them decide.

## Morning Briefing Template

When running the morning cron job, produce this format:

```
☀️ Morning brief — [date]

Portfolio: $XX,XXX ([+/-X.X%] overnight)
• ETH: $X,XXX (XX%) [target XX%]
• WBTC: $X,XXX (XX%) [target XX%]
• USDC: $X,XXX (XX%) [target XX%]

[If drift detected:] Drift: [asset] is X% [over/under] target.
[If notable movement:] Overnight: ETH +X.X%, BTC -X.X%
[If DCA executed:] DCA: bought 0.024 ETH yesterday ($50)
[If pending items:] Pending: [describe]
[If opportunity:] Opportunity: [one-liner]
```

Load overnight data from the user's previous daily memory (`memory/users/{peerId}/daily/YYYY-MM-DD.md` for yesterday).

## Behavioral Learning

Track and adapt to user patterns. Write observations to the **user's own** long-term memory file:

- **File:** `memory/users/{peerId}/MEMORY.md`
- **Never** write user behavioral patterns to the global `MEMORY.md`.

Patterns to track:
- **Check-in times:** If user consistently messages at ~9am, front-load the morning brief.
- **Approval patterns:** If user auto-approves rebalances under $100, note it (but still ask).
- **Rejection patterns:** If user rejects aggressive suggestions 3x in a row, note preference drift.
- **Token preferences:** Track which tokens user favors — prefer those in suggestions.
- **Chain preferences:** Track which chains user operates on most — prefer those routes.

Format in `memory/users/{peerId}/MEMORY.md`:
```markdown
## Behavioral Patterns

- Typically checks in around 9am CET
- Approves rebalances under $100 quickly, hesitates over $200
- Prefers Base and Arbitrum over mainnet
- Rejected 3 degen suggestions in a row (Jan 15-20) — may be more conservative than stated profile
- Favorite tokens: ETH, WBTC, USDC
```

## Sub-Agent Research Tasks

When deeper analysis is needed, spawn sub-agents with specific tasks:

| Task | When to spawn | Prompt template |
|------|---------------|-----------------|
| Price trend analysis | User asks "should I buy/sell X?" | "Analyze [token] price action over 7 days. Current price, trend direction, support/resistance levels. Return a concise 3-line summary." |
| Route optimization | Before large swaps (>$500) | "Find the best swap route for [amount] [tokenA] → [tokenB]. Compare gas costs across Base, Arbitrum, Optimism, Polygon. Return the cheapest option." |
| Portfolio optimization | Weekly review | "Given portfolio [allocations] and strategy [profile], suggest optimal rebalancing trades minimizing gas and slippage." |

## Rules

1. **Never execute without approval.** Proactive means surfacing information and suggestions, not autonomous trading.
2. **Respect the profile.** Conservative users don't want degen suggestions. Degen users don't want hand-holding.
3. **One insight per heartbeat max.** Don't overwhelm. Pick the most important thing.
4. **Data before opinion.** Always lead with numbers, then your take.
5. **Remember across sessions.** Write observations to the user's per-user memory files.
6. **Per-user isolation.** Never write user-specific data to global `MEMORY.md`. Never read another user's memory files.
