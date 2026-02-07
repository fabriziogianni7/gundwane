---
name: price-alerts
description: Let users set custom price and portfolio alerts that Gundwane checks autonomously during heartbeats. Alerts are stored per-user in strategy JSON and evaluated every cycle.
homepage: https://github.com
metadata:
  openclaw:
    emoji: "🔔"
    requires: { env: [] }
---

# Price Alerts — Skill

## What this skill does

Allows users to set **price alerts** and **portfolio alerts** in natural language. Alerts are stored per-user in strategy JSON (via `defi_set_strategy`) and checked every heartbeat cycle. When a condition is met, Gundwane notifies the user proactively.

## When to use

- User says anything like: "tell me if ETH drops below 2000", "alert me when...", "notify me if...", "watch X for me"
- During heartbeats: read alerts from user's strategy and evaluate them
- When user asks "what alerts do I have?" or "remove my alerts"

## Alert Types

### Price alerts
Trigger when a token reaches a price threshold.

User says: "Alert me if ETH goes below $1800"
→ Store and check against current price each heartbeat.

### Portfolio alerts
Trigger based on total portfolio value or individual position changes.

User says: "Tell me if my portfolio drops below $10,000"
→ Store and check total portfolio value each heartbeat.

User says: "Alert me if my ETH position drops more than 20%"
→ Store baseline value, check for relative change each heartbeat.

### Drift alerts
Trigger when allocation drift exceeds a threshold (supplements the proactive-defi skill).

User says: "Let me know if any position drifts more than 10%"
→ Store and check allocation vs strategy targets.

### Gas alerts
Trigger when gas on a specific chain drops below a threshold.

User says: "Tell me when gas on Base is cheap"
→ Store and check gas prices each heartbeat.

## Data Storage — Hybrid Model

### Structured data → Strategy JSON (per-user)

Alert configuration lives in the user's strategy under `priceAlerts`:

```json
{
  "profile": "balanced",
  "allocations": { ... },
  "priceAlerts": [
    {
      "id": "alert-1",
      "type": "price",
      "token": "ETH",
      "condition": "below",
      "threshold": 1800,
      "created": "2026-02-07",
      "status": "active",
      "baseline": 2100,
      "lastChecked": "2026-02-07T14:30Z",
      "cooldownUntil": null,
      "triggerCount": 0
    },
    {
      "id": "alert-2",
      "type": "portfolio",
      "condition": "total_below",
      "threshold": 10000,
      "created": "2026-02-07",
      "status": "active",
      "baseline": 12340,
      "lastChecked": "2026-02-07T14:30Z",
      "cooldownUntil": null,
      "triggerCount": 0
    }
  ]
}
```

Read via `defi_get_strategy`, write via `defi_set_strategy`. Automatically per-user.

### Narrative data → Per-user memory files

Alert trigger history and observations go to daily memory:
- **File:** `memory/users/{peerId}/daily/YYYY-MM-DD.md`
- **Content:** "Alert triggered: ETH dropped below $1,800 (now $1,795). User notified."

## Setting Alerts

When user requests an alert:

1. Parse the natural language into alert components (type, token, condition, threshold).
2. Get the current price/value as a baseline.
3. Load strategy via `defi_get_strategy`.
4. Append the alert to `strategy.priceAlerts[]`.
5. Save via `defi_set_strategy`.
6. Confirm to user: "Alert set: I'll notify you if ETH drops below $1,800. Currently at $2,100."

### Parsing examples

| User says | Type | Token | Condition | Threshold |
|-----------|------|-------|-----------|-----------|
| "tell me if ETH hits 3000" | price | ETH | above | 3000 |
| "alert when BTC drops below 50k" | price | WBTC | below | 50000 |
| "watch my portfolio, tell me if it drops 15%" | portfolio | — | drop_percent | 15 |
| "notify me when gas is low on Base" | gas | — | below | auto (25th percentile) |
| "tell me if USDC depegs" | price | USDC | outside_range | [0.995, 1.005] |

## Checking Alerts (during heartbeats)

1. For the current user session, load strategy via `defi_get_strategy` → get `priceAlerts[]`.
2. For cron/heartbeat scanning all users: iterate strategy files in `workspace/strategies/`.
3. For each alert with `status: "active"`:
   a. Skip if `cooldownUntil` is in the future.
   b. Get current price/value (use LI.FI quote with minimal amount for price, or `defi_get_portfolio` for portfolio alerts).
   c. Evaluate condition.
   d. If triggered:
      - Notify the user with a concise message.
      - Update `lastChecked` timestamp.
      - Set `cooldownUntil` to 1 hour from now (prevent spam).
      - Increment `triggerCount`.
      - For one-shot alerts: set `status: "triggered"`.
      - For recurring alerts: keep `status: "active"` but enforce cooldown.
      - Save via `defi_set_strategy`.
      - Log to per-user daily memory.
   e. If not triggered: update `lastChecked` only, save via `defi_set_strategy`.

## Alert Notification Format

Keep it short — one message, no fluff:

```
🔔 Alert: ETH is now at $1,795 (below your $1,800 threshold).
Your ETH position: $X,XXX (XX% of portfolio).
```

For portfolio alerts:
```
🔔 Portfolio alert: Total value is $9,850 (below your $10,000 threshold).
Down X.X% from $XX,XXX when you set this alert.
```

## Managing Alerts

All management reads/writes `strategy.priceAlerts[]` via `defi_get_strategy`/`defi_set_strategy`.

### Listing
User asks "what alerts do I have?" → Load strategy, list all active alerts.

Format:
```
Active alerts:
1. ETH below $1,800 (set Feb 7) — not triggered
2. Portfolio below $10,000 (set Feb 7) — not triggered
3. Gas low on Base (set Feb 6) — triggered 1x, last 2h ago
```

### Removing
User says "remove my ETH alert" or "cancel alert 1" → Set `status: "cancelled"` via `defi_set_strategy`. Confirm removal.

### Modifying
User says "change my ETH alert to $1,700" → Update threshold and re-baseline via `defi_set_strategy`. Confirm change.

## Rules

1. **Max 10 active alerts per user.** If at limit, tell the user and suggest removing old ones.
2. **1-hour cooldown between re-triggers** for the same alert. Don't spam.
3. **Stablecoin depeg alerts are free.** If the user holds stablecoins and doesn't have a depeg alert, suggest one during onboarding.
4. **Don't auto-create alerts.** Only create when the user explicitly asks. Suggest during strategy setup.
5. **Baseline is important.** Always record the current price/value at alert creation for context when it triggers.
6. **Be honest about precision.** Heartbeat checks happen every ~30 minutes, so alerts won't trigger to-the-second. Mention this when setting price alerts on volatile assets.
7. **Per-user isolation.** Alerts live in the user's strategy JSON. Never read another user's alerts.
