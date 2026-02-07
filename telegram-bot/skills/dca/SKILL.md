---
name: dca
description: Dollar-Cost Averaging (DCA) strategy management. Lets users set up recurring automated buys that execute on a schedule via cron. Supports daily, weekly, and custom intervals. Auto-executes pre-approved swaps via LI.FI.
homepage: https://github.com
metadata:
  openclaw:
    emoji: "🔄"
    requires: { env: [] }
---

# DCA (Dollar-Cost Averaging) — Skill

## What this skill does

Allows users to set up **recurring automated token purchases** that execute on a cron schedule. The user defines what to buy, how much, and how often — Gundwane handles execution autonomously.

**This is the one exception to the "never execute without approval" rule.** When a user explicitly creates a DCA plan, they are pre-approving every future execution within the defined parameters. This is the approval.

## When to use

- User says: "buy $50 of ETH every day", "DCA into BTC weekly", "set up recurring buys", "auto-buy ETH"
- During cron execution: read active DCA plans and execute due entries
- When user asks: "what are my DCA plans?", "pause my DCA", "stop buying ETH"

## Data Storage — Hybrid Model

DCA uses **two storage layers**, each for the right kind of data:

### Structured data → Strategy JSON (per-user, via `defi_set_strategy`)

DCA plan config lives in the user's strategy under `dcaPlans`:

```json
{
  "profile": "balanced",
  "allocations": { "ETH": 40, "WBTC": 30, "USDC": 30 },
  "dcaPlans": [
    {
      "id": "dca-1",
      "status": "active",
      "fromToken": "USDC",
      "toToken": "ETH",
      "amountUsd": 50,
      "frequency": "daily",
      "preferredHour": "09:00",
      "timezone": "UTC",
      "chainPreference": "auto",
      "maxSlippage": 0.10,
      "created": "2026-02-07",
      "lastExecuted": "2026-02-07T09:02Z",
      "nextExecution": "2026-02-08T09:00Z",
      "stats": {
        "totalExecutions": 5,
        "totalSpentUsd": 250,
        "totalAcquired": "0.119",
        "averagePrice": 2100.84,
        "bestPrice": 1920,
        "worstPrice": 2280
      }
    }
  ]
}
```

This is automatically per-user (strategy files are at `workspace/strategies/{peerId}.json`). Read via `defi_get_strategy`, write via `defi_set_strategy`.

### Narrative data → Per-user memory files

DCA execution logs, observations, and history go to the user's daily memory:
- **File:** `memory/users/{peerId}/daily/YYYY-MM-DD.md`
- **Content:** "DCA executed: $50 USDC → 0.0238 ETH at $2,100 on Base. Tx: 0x..."

This keeps a human-readable audit trail that's searchable via `memory_search`.

## Setting Up a DCA Plan

When the user requests a DCA:

### 1. Parse the request

Extract:
- **From token:** What they're spending (usually USDC, USDT, or ETH). If not specified, default to USDC.
- **To token:** What they're buying.
- **Amount:** Dollar amount per execution. Must be explicit — never assume.
- **Frequency:** daily, weekly (which day?), or custom interval.
- **Time preference:** What hour to execute (default: 09:00 UTC).

### 2. Validate feasibility

- Check wallet exists (`defi_get_wallet`).
- Check delegation is active (`defi_check_delegation`).
- Check current balance of the source token (`defi_get_portfolio`).
- Verify the source token balance can cover at least 3-5 executions. If not, warn the user: "You have $120 USDC. At $50/day, this covers ~2 days. Want to proceed?"
- Get a test quote from LI.FI to confirm the route works.

### 3. Confirm with the user

Present a clear summary and get explicit approval:

```
DCA Plan:
• Buy $50 of ETH with USDC
• Every day at ~9:00 AM UTC
• Max slippage: 10%
• Best route across chains (auto)

This will auto-execute without asking each time.
I'll report each execution and you can pause/stop anytime.

Set up this DCA?
```

Show Approve/Reject inline buttons.

### 4. On approval

- Load current strategy via `defi_get_strategy`.
- Append the new plan to `strategy.dcaPlans[]` array.
- Save via `defi_set_strategy`.
- Create (or instruct the user to create) a cron job for the schedule:

```bash
openclaw cron add \
  --name "DCA: $50 USDC → ETH daily" \
  --cron "0 9 * * *" \
  --tz "UTC" \
  --session isolated \
  --message "Execute DCA plans. For each user with active strategies, load their strategy via defi_get_strategy. For each dcaPlan with status 'active' that is due: get wallet, get LI.FI quote, execute the swap, update plan stats via defi_set_strategy, log to per-user daily memory, and report the execution to the user." \
  --deliver \
  --channel telegram
```

- Confirm to user: "DCA set up. I'll buy $50 of ETH daily at ~9 AM UTC. You'll get a report after each execution."
- Log to per-user daily memory: `memory/users/{peerId}/daily/YYYY-MM-DD.md`.

## Executing a DCA (Cron Job)

When the cron job fires:

### 1. Load plans
- Iterate strategy files in `workspace/strategies/` (each file = one user).
- For each user: load strategy → check `dcaPlans[]` for active plans.

### 2. For each active plan that is due

a. **Check balance:** Get portfolio via `defi_get_portfolio`, verify enough source tokens exist.
   - If insufficient: **do NOT execute.** Message the user: "DCA skipped: only $X USDC remaining (need $50). Top up or adjust your DCA."
   - Update plan's `lastExecuted` to now (to avoid retry spam) via `defi_set_strategy`.

b. **Get quote:** Call LI.FI `/v1/quote` with:
   - `fromToken`: plan's source token
   - `toToken`: plan's target token
   - `fromAmount`: plan's amount in wei (convert from USD using current price)
   - `fromAddress`: user's wallet
   - `slippage`: plan's max slippage or user's strategy slippage
   - `skipSimulation=true`

c. **Validate quote:**
   - If slippage on the quote exceeds the plan's max slippage, skip and alert: "DCA paused for today: slippage is X% (your max is Y%). Will retry next cycle."
   - If the route involves an unusual or flagged token, skip and alert.

d. **Execute:**
   - If ERC-20 (source is not native ETH): use `defi_approve_and_send`
   - If native ETH: use `defi_send_transaction`
   - Always pass `gasLimit` from quote.

e. **Confirm execution:**
   - Wait a few seconds, then check `defi_tx_status`.
   - If confirmed: update plan stats in strategy JSON via `defi_set_strategy` (totalExecutions, totalSpentUsd, totalAcquired, averagePrice, lastExecuted, nextExecution).
   - If pending: note it, will be checked in next heartbeat.
   - If failed: alert user, don't update stats.

f. **Log to per-user memory:**
   Write to `memory/users/{peerId}/daily/YYYY-MM-DD.md`:
   ```
   ## DCA Execution — 09:02 UTC
   - Plan: $50 USDC → ETH (dca-1)
   - Acquired: 0.0238 ETH at $2,100
   - Tx: 0x... (Base)
   - Running total: 6 buys, $300 spent, 0.143 ETH acquired, avg $2,098
   ```

g. **Report to user:**
```
🔄 DCA executed: $50 USDC → 0.0238 ETH on Base
Avg price: $2,100.84 over 6 buys ($300 total)
[View tx](https://basescan.org/tx/0x...)
```

### 3. Edge cases

- **Gas too high:** If estimated gas > 20% of the DCA amount, skip and alert. "$50 DCA but gas would be $12. Skipping today."
- **Multiple plans due at same time:** Execute sequentially, not in parallel. Check balance before each.
- **Token no longer available:** If LI.FI can't find a route, pause the plan and alert the user.

## Managing DCA Plans

All management operations read/write `strategy.dcaPlans[]` via `defi_get_strategy`/`defi_set_strategy`.

### Listing
User asks "what are my DCAs?" or "show my recurring buys":

```
Active DCA plans:
1. $50 USDC → ETH daily at 9 AM · 6 executions · avg $2,100.84 · next: tomorrow
2. $100 USDC → WBTC weekly (Mon) · 3 executions · avg $68,450 · next: Mon Feb 10

Paused:
3. $25 USDC → LINK daily · paused (insufficient balance)
```

### Pausing
User says "pause my ETH DCA" or "stop DCA 1":
- Set `status: "paused"` in `strategy.dcaPlans[]` via `defi_set_strategy`.
- Confirm: "DCA paused: $50 USDC → ETH. Say 'resume' anytime."
- Cron job skips paused plans automatically.

### Resuming
User says "resume my ETH DCA":
- Set `status: "active"` via `defi_set_strategy`.
- Confirm: "DCA resumed. Next execution: [time]."

### Modifying
User says "change my ETH DCA to $75":
- Update `amountUsd` in strategy via `defi_set_strategy`.
- Confirm: "Updated: now buying $75 of ETH daily (was $50)."
- Previous stats are preserved.

### Cancelling
User says "cancel my ETH DCA" or "delete DCA 1":
- Set `status: "cancelled"` via `defi_set_strategy`.
- Confirm with final stats: "DCA cancelled. Over 6 executions you bought 0.119 ETH for $300 (avg $2,100.84)."

## Performance Tracking

When the user asks "how's my DCA doing?" or "DCA performance":

```
DCA Performance: USDC → ETH
• Running for: 30 days
• Total invested: $1,500
• Total acquired: 0.72 ETH
• Average buy price: $2,083.33
• Current ETH price: $2,200
• Unrealized P/L: +$84 (+5.6%)
• Best buy: $1,920 (Feb 3) · Worst buy: $2,280 (Jan 25)
```

Calculate using:
- `stats` from strategy JSON (totalSpentUsd, totalAcquired, averagePrice, bestPrice, worstPrice)
- Current value = totalAcquired × current price (from LI.FI quote)
- P/L = current value - totalSpentUsd

## USD to Token Amount Conversion

DCA amounts are specified in USD. To convert to token amounts for LI.FI:

1. Get current price: use a small LI.FI quote (e.g., 1 USDC → target token) to get the exchange rate.
2. Calculate: `tokenAmount = dcaAmountUSD / currentPrice`
3. Convert to wei: `amountInWei = tokenAmount × 10^decimals`
4. Alternatively: if source is USDC ($1 = 1 USDC), use `fromAmount = dcaAmountUSD × 10^6` directly.

For USDC/USDT source (6 decimals): `$50 DCA → fromAmount = 50000000 (50 × 10^6)`

## Rules

1. **Explicit opt-in required.** Never create a DCA without clear user approval via inline buttons.
2. **Auto-execution is the whole point.** Once approved, DCA runs without asking again. This is the user's intent.
3. **Report every execution.** The user should always know what happened. Short message + tx link.
4. **Fail safe.** If anything is wrong (low balance, high gas, bad quote, failed tx), skip and alert — never force an execution.
5. **Easy to stop.** "Pause", "stop", "cancel" should work immediately. No friction.
6. **Track everything.** Every execution updates stats in strategy JSON AND logs to per-user daily memory.
7. **Respect balance.** If the user can't afford the next execution, skip and tell them. Don't drain to zero.
8. **Gas check.** If gas exceeds 20% of the DCA amount, skip. Small DCA amounts on mainnet are wasteful — suggest Base/Arbitrum.
9. **Per-user isolation.** DCA plans are in the user's strategy JSON. Never cross-read another user's plans.
