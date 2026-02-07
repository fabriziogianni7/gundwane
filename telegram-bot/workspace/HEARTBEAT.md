# HEARTBEAT.md — Gundwane Autonomous Checklist

This file is read every heartbeat cycle (default: every 30 minutes).
Only act if something genuinely needs attention. If nothing does, reply `HEARTBEAT_OK`.

**Per-user scoping:** Iterate strategy files in `workspace/strategies/`. Each file is one user. For each user, load their strategy (via `defi_get_strategy` or by reading the file directly) and run the checks below. All writes go to per-user memory, never global.

## 1. Portfolio Health

- Load user's strategy → get `allocations` and `profile`.
- Call `defi_get_portfolio` for the user.
- Compare current allocations vs target allocations.
- **If drift > threshold (by profile):** Alert the user with a concise rebalance suggestion.
- **If a single position dropped > 10% since last heartbeat:** Flag it immediately with the delta.
- **If a position grew > 15%:** Mention it positively.
- Log portfolio snapshot to per-user daily memory: `memory/users/{peerId}/daily/YYYY-MM-DD.md`.

## 2. Pending Transactions

- Check any recently broadcast transactions with `defi_tx_status`.
- **If confirmed:** Write confirmation to per-user daily memory. No need to message unless the user is waiting.
- **If pending > 10 minutes:** Alert the user.
- **If failed:** Alert immediately with error context and suggest retry.

## 3. Price Alerts

- Load user's strategy → get `priceAlerts[]`.
- For each alert with `status: "active"`:
  - Skip if `cooldownUntil` is in the future.
  - Check current price (use LI.FI quote with small amount).
  - **If threshold crossed:** Notify user, update alert in strategy via `defi_set_strategy`, log to per-user daily memory.
  - Don't re-trigger the same alert within 1 hour (enforce cooldown).

## 4. Gas Conditions

- If the user has a pending rebalance suggestion or recently discussed a swap (check per-user daily memory):
  - Check current gas conditions.
  - **If gas dropped significantly:** "Gas just dropped on [chain]. Good time for that rebalance we discussed."

## 5. DCA Plan Health

- Load user's strategy → get `dcaPlans[]`.
- **Don't execute DCA here** — that's handled by the dedicated DCA cron job.
- But DO check for issues:
  - **If source token balance is running low** (< 3 remaining executions): Warn the user.
  - **If a DCA execution failed in the last cycle:** Flag it (check per-user daily memory).
  - **If a DCA has been paused for > 7 days:** Remind user to resume or cancel.
- Log DCA health observations to per-user daily memory.

## 6. Proactive Opportunities

- Only for users with `aggressive` or `degen` profile mode:
  - If you notice a significant price dislocation or opportunity during portfolio check, mention it briefly.
  - Keep it to one suggestion max per heartbeat — don't spam.

## 7. Memory Maintenance

- Write notable per-user observations to `memory/users/{peerId}/daily/YYYY-MM-DD.md`:
  - Portfolio value snapshots (for tracking over time)
  - Alerts triggered
  - DCA status
- If a behavioral pattern emerges (user always checks at a certain time, prefers certain tokens), write it to `memory/users/{peerId}/MEMORY.md`.
- Write agent-level observations (gas trends, market conditions) to global `MEMORY.md` — **never user-specific data**.

## Rules

- **Don't spam.** If nothing changed for any user, `HEARTBEAT_OK`. Users should feel like Gundwane speaks only when it matters.
- **Don't repeat.** If you already alerted about ETH drift this cycle, don't alert again next cycle unless it got worse.
- **Be concise.** Heartbeat messages should be 1-3 lines max. Save the details for when the user asks.
- **Respect active hours.** Don't wake users up. The config enforces 07:00-23:00 but be extra conservative at the edges.
- **Per-user isolation.** Each user's checks are independent. Never mix data between users.
