---
name: defi-agent
description: Use the DeFi Agent (EIP-7702) plugin to read the user's wallet, balances, and execute transactions on their behalf via a non-custodial delegate contract. The user's wallet is the Privy embedded wallet linked to their Telegram account after they complete setup in the Mini App.
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

So: **yes, the plugin uses your Privy wallet.** After you log in with Telegram in the Mini App and tap "Activate your DeFi Agent", the bot can read your wallet address and balances and execute swaps/transfers **on your behalf** through the delegate contract; your Privy wallet stays non-custodial (you hold the keys, the bot only has temporary delegation).

## When to use

- User asks for "my wallet", "my address", "what's my balance", "check delegation", or to perform a swap/transfer.
- Before running LI.FI (or any DeFi) flows: get the user's address with `defi_get_wallet` and use it as `fromAddress` in quotes; then use `defi_send_transaction` or `defi_execute_batch` to execute.

## Tools (use these, no others for this flow)

| Tool | Purpose |
|------|--------|
| **defi_get_wallet** | Get the Telegram user's wallet address (from backend/Privy). Returns `{ address, ok }`. If `address` is null, direct the user to complete setup in the Mini App. |
| **defi_get_balance** | Native (ETH) balance for the user's wallet on a given `chainId`. |
| **defi_check_delegation** | Check if the user's wallet has active EIP-7702 delegation to the DeFi agent contract. |
| **defi_send_transaction** | Execute one call from the user's delegated wallet. Params: `chainId`, `to`, `value` (optional), `data` (optional). Use for LI.FI `transactionRequest` (to, value, data). |
| **defi_execute_batch** | Execute multiple calls (e.g. approve + swap). Params: `chainId`, `calls`: `[{ target, value?, data? }, ...]`. |
| **defi_tx_status** | Check transaction status by `chainId` and `txHash`. |

## Rules

1. Always call **defi_get_wallet** first when the user asks for balance or wants to perform a transaction; if there is no wallet, ask them to open the Mini App and complete setup (login + "Activate your DeFi Agent").
2. For LI.FI (or similar) quotes, use the wallet from **defi_get_wallet** as `fromAddress`; then execute with **defi_send_transaction** (single step) or **defi_execute_batch** (e.g. approve + swap).
3. Confirm with the user before executing any **defi_send_transaction** or **defi_execute_batch**; on Telegram use inline Approve/Reject when possible.
4. Never expose private keys or claim to hold the user's keys; the user keeps custody via Privy; the bot only uses the delegate contract.
