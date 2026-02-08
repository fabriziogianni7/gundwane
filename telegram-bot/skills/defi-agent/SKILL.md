---
name: defi-agent
description: Use the DeFi Agent (EIP-7702) plugin to read the user's wallet, portfolio (multi-chain), strategy/preferences, and execute transactions on their behalf via a non-custodial delegate contract. The user's wallet is the Privy embedded wallet linked to their Telegram account after they complete setup in the Mini App.
homepage: https://github.com
metadata:
  openclaw:
    emoji: "🦾"
    requires: { env: [] }
---

# DeFi Agent (EIP-7702) – Plugin skill

## What this plugin does

The **defi-agent-plugin** connects the OpenClaw agent to a **non-custodial** DeFi flow:

1. **User wallet** is a **Privy embedded wallet** (EOA) linked to their Telegram account. The user creates/links it and activates the DeFi Agent once in the **Telegram Mini App** (EIP-7702 delegation to a shared delegate contract).
2. **Backend** (Mini App API) stores the mapping: Telegram user ID → wallet address. The plugin calls `GET {backendUrl}/api/wallet/{telegramUserId}` to resolve the current user's wallet.
3. **Execution**: The bot holds an **operator** key and the user's EOA has **delegated** its code to the **DeFiAgentDelegate** contract. The plugin sends transactions **to the user's address** with calldata that runs `execute` or `executeBatch` on the delegate contract, so the user's funds move without the bot ever holding keys to the user wallet.

## When to use

- User asks for "my wallet", "my address", "balance", "portfolio", "how much do I have", or anything about their funds.
- User wants to swap, bridge, send, or do any DeFi operation.
- User wants to set or check their strategy/preferences.
- Before running LI.FI (or any DeFi) flows: get the user's address with `defi_get_wallet`.

## Tools

| Tool | Purpose |
|------|---------|
| **defi_get_wallet** | Get the Telegram user's wallet address (from backend/Privy). Returns `{ address, suiAddress, ok }`. Use `address` for EVM, `suiAddress` for Sui. If both null, direct user to Mini App. |
| **defi_get_portfolio** | Get multi-chain portfolio: native + ERC-20 token balances across ALL configured chains (including Sui). No parameters needed. Use this for any balance query — it's chain-abstracted. |
| **defi_get_balance** | Native (ETH) balance for a single `chainId`. Prefer `defi_get_portfolio` for general queries. |
| **defi_get_sui_balance** | Get SUI and token balances for the user's Sui wallet. Use when user asks for Sui balance specifically. |
| **defi_get_strategy** | Read user's stored DeFi strategy. Returns the full strategy JSON including allocations, profile, slippage, preferences, `priceAlerts[]`, and `dcaPlans[]`. Call silently at session start. Returns null if no strategy set. |
| **defi_set_strategy** | Store/update user's strategy. Takes a JSON object that merges into the existing strategy. Use this for setting profile, allocations, slippage, preferences, AND for managing price alerts and DCA plans. |
| **defi_check_delegation** | Check if the user's wallet has active EIP-7702 delegation. |
| **defi_send_transaction** | Execute one call from the user's delegated wallet. For LI.FI `transactionRequest` (to, value, data) on **EVM** chains. Always pass gasLimit. |
| **defi_send_sui_transaction** | Sign and submit a **Sui** transaction (e.g. from LI.FI quote). Pass `transactionBytes` (hex). No approval step on Sui. Returns `txDigest` and explorer link. |
| **defi_approve_and_send** | Approve token + execute transaction atomically. For LI.FI ERC-20 swaps on EVM only. |
| **defi_execute** | Execute single arbitrary call via delegate. |
| **defi_execute_batch** | Execute multiple calls atomically (e.g. approve + swap). |
| **defi_tx_status** | Check transaction status by `chainId` and `txHash`. |

## Strategy JSON Schema

The strategy file (`workspace/strategies/{peerId}.json`) holds all per-user structured data:

```json
{
  "profile": "balanced",
  "allocations": { "ETH": 40, "WBTC": 30, "USDC": 30 },
  "slippage": 0.10,
  "preferences": {
    "name": "Fabri",
    "language": "en",
    "tone": "concise"
  },
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
    }
  ],
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

`defi_set_strategy` merges the provided object into the existing file, so you can update just one field (e.g. add an alert) without overwriting everything else.

## Rules

1. Call **defi_get_wallet** first when the user needs balance or wants a transaction. If no wallet, ask them to open the Mini App.
2. For balance queries, use **defi_get_portfolio** — it checks all chains automatically. Don't ask "which chain?"
3. Call **defi_get_strategy** silently at session start. No permission needed for any read operation.
4. For LI.FI quotes, use the wallet from **defi_get_wallet**: use `address` as `fromAddress` for EVM chains; use `suiAddress` for Sui. Execute EVM with **defi_send_transaction** or **defi_approve_and_send**; execute Sui with **defi_send_sui_transaction** (no approval step on Sui).
5. Confirm with the user before executing any transaction; use inline Approve/Reject on Telegram.
6. **Always provide block explorer links** after transaction broadcast: `[View tx](explorerUrl/tx/hash)`
7. Never expose private keys or claim to hold the user's keys.
